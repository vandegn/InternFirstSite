'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  supabase,
  getEmployerByUserId,
  getEmployerApplications,
  getEmployerListings,
  getEmployerInterviews,
  getListingStages,
  createStage,
  updateStage,
  deleteStage,
  reorderStages,
  updateApplicationStage,
  createInterview,
  rescheduleInterview,
  deleteApplication,
  requestInterviewTimes,
  getEmployerAvailabilityRequests,
  confirmInterviewTime,
  withdrawInterviewRequest,
  type PipelineStage,
} from '@/lib/supabase';
import Avatar from '@/components/Avatar';
import ScheduleInterviewModal from '@/components/ScheduleInterviewModal';
import type { ScheduleInterviewFormData } from '@/components/ScheduleInterviewModal';
import RequestTimesModal from '@/components/RequestTimesModal';
import type { RequestTimesFormData } from '@/components/RequestTimesModal';
import SelectInterviewTimeModal from '@/components/SelectInterviewTimeModal';
import {
  isLiveAvailabilityStatus,
  EMPLOYER_STATUS_LABELS,
  STATUS_CHIP,
  type AvailabilityRequest,
  type AvailabilityStatus,
} from '@/lib/interview-availability';
import { PIPELINE_STAGE_PRESETS, type PipelineStagePreset } from '@/lib/constants';

type ApplicationAnswer = {
  id: string;
  answer_text: string | null;
  answer_options: string[] | null;
  storage_path: string | null;
  question: { id: string; prompt: string; question_type: string; position: number } | null;
};

type Application = {
  id: string;
  status: string;
  stage_id: string | null;
  match_score: number | null;
  flagged_knockout: boolean | null;
  applied_at: string;
  resume: { id: string; name: string } | null;
  answers: ApplicationAnswer[];
  listing: { id: string; title: string };
  student: {
    id: string;
    major: string | null;
    graduation_year: number | null;
    bio: string | null;
    user_id: string;
    profile: { full_name: string; email: string; avatar_url: string | null };
  };
};

type Interview = {
  id: string;
  application_id: string;
  scheduled_at: string;
  duration_minutes: number;
  employer_notes: string | null;
  status: string;
};

const APPLIED_DISPLAY_LIMIT = 10;

// An interview that still needs to happen — the card shows it and the
// schedule action becomes "Reschedule" instead of opening a second invite.
const LIVE_INTERVIEW_STATUSES = ['pending', 'accepted', 'reschedule_requested'];

function formatInterviewWhen(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// Same thresholds as the applications list: >= 70 is the PPA-qualifying band.
function matchPill(score: number) {
  if (score >= 70) return { bg: '#dcfce7', color: 'var(--success-fg)' };
  if (score >= 40) return { bg: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)' };
  return { bg: '#f3f4f6', color: 'var(--chip-neutral-ink)' };
}

// PostgREST returns embedded rows as arrays or objects depending on the
// relationship it infers, so flatten every nesting level once here rather than
// guarding at each read site.
function normalizeApp(app: Record<string, unknown>): Application {
  const one = <T,>(v: unknown): T => (Array.isArray(v) ? v[0] : v) as T;
  const student = one<Record<string, unknown> | null>(app.student);
  return {
    ...app,
    listing: one(app.listing),
    resume: one(app.resume) ?? null,
    answers: ((app.answers ?? []) as Record<string, unknown>[]).map((a) => ({
      ...a,
      question: one(a.question) ?? null,
    })),
    student: student ? { ...student, profile: one(student.profile) } : student,
  } as unknown as Application;
}

function answerText(a: ApplicationAnswer): string {
  if (a.answer_options?.length) return a.answer_options.join(', ');
  if (a.answer_text) return a.answer_text;
  if (a.storage_path) return 'File attached';
  return '—';
}

const COLOR_PRESETS: { bg: string; text: string }[] = [
  { bg: 'var(--chip-indigo-bg)', text: 'var(--chip-indigo-ink)' },
  { bg: 'var(--chip-amber-bg)', text: 'var(--chip-amber-ink)' },
  { bg: 'var(--chip-blue-bg)', text: 'var(--chip-blue-ink)' },
  { bg: 'var(--chip-green-bg)', text: 'var(--chip-green-ink)' },
  { bg: 'var(--danger-bg-strong)', text: 'var(--danger-fg)' },
  { bg: 'var(--chip-violet-bg)', text: 'var(--chip-violet-ink)' },
  { bg: 'var(--chip-orange-bg)', text: 'var(--chip-orange-ink)' },
  { bg: 'var(--info-bg)', text: 'var(--chip-blue-ink)' },
];

// Left-to-right order of the canonical buckets, used to slot a newly added
// column into the flow rather than always dropping it before "Offered".
const STAGE_TYPE_ORDER: Record<PipelineStage['stage_type'], number> = {
  applied: 0,
  reviewing: 1,
  interviewing: 2,
  offered: 3,
  rejected: 4,
};

// Where a stage preset's suggested color sits in COLOR_PRESETS, so choosing a
// stage pre-selects its swatch and the employer can still recolor from there.
function colorIdxForPreset(preset: PipelineStagePreset) {
  const idx = COLOR_PRESETS.findIndex(c => c.bg === preset.colorBg && c.text === preset.colorText);
  return idx === -1 ? 0 : idx;
}

function EmployerPipelineInner() {
  // Deep link from a "new applicant" notification: ?listing= picks the board
  // and ?application= points at one candidate's card, which is what the
  // employer actually wants to see when they click the bell.
  const params = useSearchParams();
  const focusListingId = params.get('listing') ?? '';
  const focusApplicationId = params.get('application') ?? '';

  const [applications, setApplications] = useState<Application[]>([]);
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [selectedListing, setSelectedListing] = useState('');
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [employerId, setEmployerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Every drop is staged here and only written once the employer confirms —
  // a drag is too easy to fire by accident for a change the candidate sees.
  const [pendingMove, setPendingMove] = useState<{ app: Application; toStage: PipelineStage } | null>(null);
  const [movingApp, setMovingApp] = useState(false);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // Trash drop-zone: dropping a card here proposes a permanent delete.
  const [trashTarget, setTrashTarget] = useState<Application | null>(null);
  const [trashHover, setTrashHover] = useState(false);
  const [deletingApp, setDeletingApp] = useState(false);
  const [removeError, setRemoveError] = useState('');

  // Schedule / reschedule an interview straight from a card.
  const [scheduleApp, setScheduleApp] = useState<Application | null>(null);
  const [scheduleInterview, setScheduleInterview] = useState<Interview | null>(null);

  // Interview availability handshake: ask for a window, then pick a final time
  // out of what the candidate offered. See lib/interview-availability.ts.
  const [availabilityRequests, setAvailabilityRequests] = useState<AvailabilityRequest[]>([]);
  const [requestTimesApp, setRequestTimesApp] = useState<Application | null>(null);
  const [pickTimeApp, setPickTimeApp] = useState<Application | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');

  // Stage management modal — all edits stage into draftStages /
  // pendingDeletes and only persist on Save changes.
  const [editingStages, setEditingStages] = useState(false);
  const [draftStages, setDraftStages] = useState<PipelineStage[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Array<{ id: string; reassignTo: string | null }>>([]);
  const [savingStages, setSavingStages] = useState(false);
  // Columns are chosen from PIPELINE_STAGE_PRESETS by label, not free-typed.
  const [newStagePreset, setNewStagePreset] = useState('');
  const [newStageColorIdx, setNewStageColorIdx] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<PipelineStage | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('');
  const [stageDragId, setStageDragId] = useState<string | null>(null);
  const [stageDragOverId, setStageDragOverId] = useState<string | null>(null);

  function isDraftDirty() {
    if (pendingDeletes.length > 0) return true;
    if (draftStages.length !== stages.length) return true;
    for (let i = 0; i < draftStages.length; i++) {
      const d = draftStages[i];
      if (d.id.startsWith('tmp_')) return true;
      const original = stages.find(s => s.id === d.id);
      if (!original) return true;
      if (original.id !== stages[i]?.id) return true; // order change
      if (original.label !== d.label) return true;
      if (original.color_bg !== d.color_bg) return true;
      if (original.color_text !== d.color_text) return true;
    }
    return false;
  }

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const employer = await getEmployerByUserId(user.id);
      if (!employer) return;
      setEmployerId(employer.id);

      const [appsData, listingsData, interviewsData, availabilityData] = await Promise.all([
        getEmployerApplications(employer.id),
        getEmployerListings(employer.id, 1, 100),
        getEmployerInterviews(employer.id),
        getEmployerAvailabilityRequests(employer.id),
      ]);

      const apps = appsData.map(normalizeApp);
      setApplications(apps);
      setInterviews(interviewsData as unknown as Interview[]);
      setAvailabilityRequests(availabilityData);
      const ls = listingsData.data.map((l: any) => ({ id: l.id, title: l.title }));
      setListings(ls);

      // The candidate we were linked to wins over the ?listing= param, which
      // could be stale if the posting was re-created — the card is the target.
      const focusApp = focusApplicationId
        ? apps.find(a => a.id === focusApplicationId)
        : undefined;
      const wanted = focusApp?.listing.id ?? focusListingId;
      if (wanted && ls.some((l: { id: string }) => l.id === wanted)) setSelectedListing(wanted);
      else if (ls.length > 0) setSelectedListing(ls[0].id);
      if (focusApp) setExpandedId(focusApp.id);
      setLoading(false);
    }
    fetchData();
    // Deliberately runs once: re-reading the params later would yank an
    // employer who has since switched listings back to the linked card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bring the linked card into view once, the first time it renders. A ref
  // callback rather than an effect because the card mounts inside its column's
  // scroller, which only exists after the stages have loaded.
  const focusScrolled = useRef(false);
  const focusCardRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || focusScrolled.current) return;
    focusScrolled.current = true;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Refetch stages whenever the selected listing changes.
  useEffect(() => {
    if (!selectedListing) {
      setStages([]);
      return;
    }
    getListingStages(selectedListing).then(setStages);
  }, [selectedListing]);

  const filteredApps = selectedListing
    ? applications.filter(a => a.listing.id === selectedListing)
    : [];

  const handleDragStart = useCallback((e: React.DragEvent, appId: string) => {
    setDraggingId(appId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // A drop only *proposes* the move. Nothing is written until the employer
  // confirms in the dialog, because the candidate is notified of every stage
  // change (see updateApplicationStage) and a mis-drag is otherwise silent.
  const handleDrop = useCallback((e: React.DragEvent, newStageId: string) => {
    e.preventDefault();
    setDragOverStageId(null);
    const appId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    if (!appId) return;

    const app = applications.find(a => a.id === appId);
    const newStage = stages.find(s => s.id === newStageId);
    if (!app || !newStage || app.stage_id === newStageId) return;

    setPendingMove({ app, toStage: newStage });
  }, [applications, stages, draggingId]);

  async function confirmMove() {
    if (!pendingMove || movingApp) return;
    const { app, toStage } = pendingMove;
    setMovingApp(true);
    // Optimistic: the board updates as soon as the dialog closes, and rolls
    // back to the card's original column if the write fails.
    setApplications(prev => prev.map(a =>
      a.id === app.id ? { ...a, stage_id: toStage.id, status: toStage.label } : a
    ));
    setPendingMove(null);
    try {
      await updateApplicationStage(app.id, toStage.id);
    } catch (err) {
      console.error('[confirmMove] failed', err);
      setApplications(prev => prev.map(a =>
        a.id === app.id ? { ...a, stage_id: app.stage_id, status: app.status } : a
      ));
      if (typeof window !== 'undefined') {
        window.alert(`Couldn't move ${app.student.profile.full_name} to "${toStage.label}". Please try again.`);
      }
    } finally {
      setMovingApp(false);
    }
  }

  function handleTrashDrop(e: React.DragEvent) {
    e.preventDefault();
    setTrashHover(false);
    const appId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    if (!appId) return;
    const app = applications.find(a => a.id === appId);
    if (!app) return;
    setRemoveError('');
    setTrashTarget(app);
  }

  async function confirmRemove() {
    if (!trashTarget || deletingApp) return;
    setDeletingApp(true);
    setRemoveError('');
    try {
      await deleteApplication(trashTarget.id);
      setApplications(prev => prev.filter(a => a.id !== trashTarget.id));
      // Its interview invites went with it (cascade), so drop them locally too.
      setInterviews(prev => prev.filter(i => i.application_id !== trashTarget.id));
      if (expandedId === trashTarget.id) setExpandedId(null);
      setTrashTarget(null);
    } catch (err) {
      console.error('[confirmRemove] failed', err);
      setRemoveError(err instanceof Error ? err.message : 'Removing the candidate failed. Please try again.');
    } finally {
      setDeletingApp(false);
    }
  }

  function activeInterviewForApp(applicationId: string): Interview | undefined {
    return interviews.find(i =>
      i.application_id === applicationId && LIVE_INTERVIEW_STATUSES.includes(i.status)
    );
  }

  function openScheduleModal(app: Application) {
    setScheduleInterview(activeInterviewForApp(app.id) ?? null);
    setScheduleApp(app);
  }

  function closeScheduleModal() {
    setScheduleApp(null);
    setScheduleInterview(null);
  }

  async function handleScheduleSubmit(data: ScheduleInterviewFormData) {
    if (!scheduleApp || !employerId) return;
    if (scheduleInterview) {
      const updated = await rescheduleInterview(scheduleInterview.id, {
        scheduledAt: data.scheduledAt,
        durationMinutes: data.durationMinutes,
        notes: data.notes,
      });
      setInterviews(prev => prev.map(i => i.id === updated.id ? (updated as Interview) : i));
    } else {
      const created = await createInterview({
        applicationId: scheduleApp.id,
        employerId,
        studentId: scheduleApp.student.id,
        listingId: scheduleApp.listing.id,
        scheduledAt: data.scheduledAt,
        durationMinutes: data.durationMinutes,
        notes: data.notes,
      });
      setInterviews(prev => [...prev, created as Interview]);
      // trg_sync_stage_on_interview_created may have advanced the candidate to
      // the Interviewing column, so pull the board's real state back down
      // rather than guessing where the card should now sit.
      const appsData = await getEmployerApplications(employerId);
      setApplications(appsData.map(normalizeApp));
    }
    closeScheduleModal();
  }

  // ---- Interview availability handshake ----

  // The open negotiation on a card, if any. Terminal rows (scheduled,
  // no_availability, cancelled) are still shown as a chip, so grab the newest
  // row for the application and let the caller decide what it means.
  function latestRequestForApp(applicationId: string): AvailabilityRequest | undefined {
    return availabilityRequests.find(r => r.application_id === applicationId);
  }

  function liveRequestForApp(applicationId: string): AvailabilityRequest | undefined {
    const latest = latestRequestForApp(applicationId);
    return latest && isLiveAvailabilityStatus(latest.status) ? latest : undefined;
  }

  function upsertRequest(request: AvailabilityRequest) {
    setAvailabilityRequests(prev => {
      const rest = prev.filter(r => r.id !== request.id);
      // Newest first, matching getEmployerAvailabilityRequests' ordering, so
      // latestRequestForApp keeps returning the right row.
      return [request, ...rest];
    });
  }

  // Step 1 — send the window to the candidate.
  async function handleRequestTimes(data: RequestTimesFormData) {
    if (!requestTimesApp) return;
    const created = await requestInterviewTimes({
      applicationId: requestTimesApp.id,
      windowStart: data.windowStart,
      windowEnd: data.windowEnd,
      durationMinutes: data.durationMinutes,
      note: data.note,
    });
    upsertRequest(created);
    setRequestTimesApp(null);
    // Requesting times advances the candidate to Interviewing via
    // trg_sync_stage_on_availability_requested, so re-read where the board
    // actually put the card rather than guessing.
    if (employerId) {
      const appsData = await getEmployerApplications(employerId);
      setApplications(appsData.map(normalizeApp));
    }
  }

  // Step 3 — lock in one of the offered times.
  async function handleConfirmTime(data: { scheduledAt: string; durationMinutes: number; notes: string }) {
    const request = pickTimeApp ? latestRequestForApp(pickTimeApp.id) : null;
    if (!request || !employerId) return;
    const updated = await confirmInterviewTime(request.id, {
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes,
      notes: data.notes,
    });
    upsertRequest({ ...request, ...updated });
    setPickTimeApp(null);
    // A real interview row now exists; refresh both it and the board, since
    // its insert trigger may have moved the card too.
    const [interviewsData, appsData] = await Promise.all([
      getEmployerInterviews(employerId),
      getEmployerApplications(employerId),
    ]);
    setInterviews(interviewsData as unknown as Interview[]);
    setApplications(appsData.map(normalizeApp));
  }

  // Off-ramp — none of the offered times work, or the candidate had none at
  // all. Withdraw so a fresh window can be requested; the board immediately
  // offers "Request Times" again.
  async function handleRequestNewWindow() {
    const app = pickTimeApp;
    const request = app ? latestRequestForApp(app.id) : null;
    if (!request || !app) return;
    setAvailabilityError('');
    try {
      const updated = await withdrawInterviewRequest(request.id);
      upsertRequest({ ...request, ...updated });
      setPickTimeApp(null);
      // Straight into the next ask — that's the whole point of withdrawing.
      setRequestTimesApp(app);
    } catch (e) {
      setAvailabilityError(e instanceof Error ? e.message : 'Could not withdraw the request');
    }
  }

  function openEditModal() {
    setDraftStages(stages.map(s => ({ ...s })));
    setPendingDeletes([]);
    setNewStagePreset('');
    setNewStageColorIdx(0);
    setEditingStages(true);
  }

  function closeEditModal() {
    if (savingStages) return;
    if (isDraftDirty()) {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Discard unsaved column changes?')
        : true;
      if (!ok) return;
    }
    setEditingStages(false);
    setDraftStages([]);
    setPendingDeletes([]);
    setDeleteTarget(null);
    setReassignTo('');
    setNewStagePreset('');
    setNewStageColorIdx(0);
  }

  function draftAddStage() {
    const preset = PIPELINE_STAGE_PRESETS.find(p => p.label === newStagePreset);
    if (!preset || !selectedListing) return;
    if (draftStages.some(s => s.label.toLowerCase() === preset.label.toLowerCase())) return;
    const color = COLOR_PRESETS[newStageColorIdx];
    const tmpId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newStage: PipelineStage = {
      id: tmpId,
      listing_id: selectedListing,
      label: preset.label,
      color_bg: color.bg,
      color_text: color.text,
      position: 0, // normalized on save
      stage_type: preset.stageType,
      locked: false,
    };
    // Slot the column where its stage_type says it belongs — a screening step
    // lands after Applied, "Hired" after Offered — so the board reads as the
    // real flow without the employer having to drag it there. They still can.
    setDraftStages(prev => {
      const rank = STAGE_TYPE_ORDER[newStage.stage_type];
      let insertAt = 0;
      prev.forEach((s, i) => {
        if (STAGE_TYPE_ORDER[s.stage_type] <= rank) insertAt = i + 1;
      });
      const next = [...prev];
      next.splice(insertAt, 0, newStage);
      return next;
    });
    setNewStagePreset('');
    setNewStageColorIdx(0);
  }

  function draftRenameStage(id: string, label: string) {
    setDraftStages(prev => prev.map(s => s.id === id ? { ...s, label } : s));
  }

  function draftRecolorStage(id: string, bg: string, text: string) {
    setDraftStages(prev => prev.map(s =>
      s.id === id ? { ...s, color_bg: bg, color_text: text } : s
    ));
  }

  function draftReorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const from = draftStages.find(s => s.id === fromId);
    const to = draftStages.find(s => s.id === toId);
    if (!from || !to) return;
    if (from.locked || to.locked) return;
    const fromIdx = draftStages.findIndex(s => s.id === fromId);
    const toIdx = draftStages.findIndex(s => s.id === toId);
    const next = [...draftStages];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setDraftStages(next);
  }

  function startDelete(stage: PipelineStage) {
    setDeleteTarget(stage);
    const candidate = draftStages.find(s => s.id !== stage.id);
    setReassignTo(candidate?.id ?? '');
  }

  // Stage the delete in pendingDeletes (or just drop it if the stage
  // was never persisted) and remove from draft. Actual DB delete
  // happens in handleSaveStages.
  function draftConfirmDelete(action: 'reassign' | 'delete-with-candidates') {
    if (!deleteTarget) return;
    const reassignId = action === 'reassign' ? reassignTo : null;
    const isTemp = deleteTarget.id.startsWith('tmp_');
    if (!isTemp) {
      setPendingDeletes(prev => [
        ...prev.filter(d => d.id !== deleteTarget.id),
        { id: deleteTarget.id, reassignTo: reassignId },
      ]);
    }
    setDraftStages(prev => prev.filter(s => s.id !== deleteTarget.id));
    setDeleteTarget(null);
    setReassignTo('');
  }

  async function refetchAppsAndStages() {
    if (!selectedListing) return;
    const fresh = await getListingStages(selectedListing);
    setStages(fresh);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const employer = await getEmployerByUserId(user.id);
    if (!employer) return;
    const appsData = await getEmployerApplications(employer.id);
    setApplications(appsData.map(normalizeApp));
  }

  async function handleSaveStages() {
    if (!selectedListing || savingStages) return;
    setSavingStages(true);
    try {
      // 1. Apply staged deletes (always before creates / reorders so
      //    the reassign targets still exist).
      for (const d of pendingDeletes) {
        await deleteStage(d.id, d.reassignTo);
      }

      // 2. Persist new stages, mapping their tmp ids to the real ones.
      const tmpToReal: Record<string, string> = {};
      for (const draft of draftStages) {
        if (!draft.id.startsWith('tmp_')) continue;
        const created = await createStage({
          listingId: selectedListing,
          label: draft.label,
          colorBg: draft.color_bg,
          colorText: draft.color_text,
          stageType: draft.stage_type,
        });
        tmpToReal[draft.id] = created.id;
      }

      // 3. Update label / color changes on existing stages.
      for (const draft of draftStages) {
        if (draft.id.startsWith('tmp_')) continue;
        const original = stages.find(s => s.id === draft.id);
        if (!original) continue;
        const patch: Partial<PipelineStage> = {};
        if (original.label !== draft.label) patch.label = draft.label;
        if (original.color_bg !== draft.color_bg) patch.color_bg = draft.color_bg;
        if (original.color_text !== draft.color_text) patch.color_text = draft.color_text;
        if (Object.keys(patch).length > 0) {
          await updateStage(draft.id, patch);
        }
      }

      // 4. Normalize ordering: positions 0..n-1 in draft order.
      const finalIds = draftStages.map(d => tmpToReal[d.id] ?? d.id);
      await reorderStages(finalIds);

      await refetchAppsAndStages();
      setEditingStages(false);
      setDraftStages([]);
      setPendingDeletes([]);
      setNewStagePreset('');
      setNewStageColorIdx(0);
    } catch (e) {
      console.error('[handleSaveStages] failed', e);
      if (typeof window !== 'undefined') {
        window.alert('Saving column changes failed. See console for details.');
      }
    } finally {
      setSavingStages(false);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="dash-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="dash-main" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Candidate Pipeline</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {filteredApps.length} candidate{filteredApps.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedListing}
            onChange={(e) => setSelectedListing(e.target.value)}
            style={{
              padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              fontSize: '0.85rem', background: 'var(--surface)', minWidth: '220px',
            }}
          >
            <option value="" disabled>Select a listing…</option>
            {listings.map(l => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
          <button
            onClick={openEditModal}
            disabled={!selectedListing}
            className="btn-secondary"
            style={{
              fontSize: '0.82rem', padding: '6px 14px',
              opacity: selectedListing ? 1 : 0.5,
              cursor: selectedListing ? 'pointer' : 'not-allowed',
            }}
          >
            Edit columns
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
            Drag and drop candidates between columns to update status
          </span>

          {/* Trash drop-zone. Only meaningful while a card is in flight, so it
              stays muted until then and lights up red on hover. */}
          {selectedListing && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!trashHover) setTrashHover(true);
              }}
              onDragLeave={() => setTrashHover(false)}
              onDrop={handleTrashDrop}
              title="Drag a candidate here to remove them from this pipeline"
              aria-label="Remove candidate drop zone"
              style={{
                marginLeft: 'auto',
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                border: `2px dashed ${trashHover ? 'var(--danger-fg)' : 'var(--border)'}`,
                background: trashHover ? 'var(--danger-bg)' : 'transparent',
                color: trashHover ? 'var(--danger-fg)' : 'var(--text-light)',
                opacity: draggingId ? 1 : 0.6,
                transform: trashHover ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 0.15s',
                pointerEvents: 'auto',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                {trashHover ? 'Release to remove' : 'Drag here to remove'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Empty state when nothing selected */}
      {!selectedListing ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px', color: 'var(--text-secondary)', textAlign: 'center',
        }}>
          <div>
            <p style={{ fontSize: '1.05rem', fontWeight: 500, marginBottom: 6 }}>
              {listings.length === 0 ? 'No listings yet' : 'Select a listing to view its candidate pipeline'}
            </p>
            <p style={{ fontSize: '0.9rem' }}>
              {listings.length === 0
                ? 'Create a listing to start receiving applications.'
                : 'Each listing has its own customizable pipeline columns.'}
            </p>
          </div>
        </div>
      ) : (
        /* Kanban Board */
        <div style={{
          flex: 1, display: 'flex', gap: '12px', padding: '16px 24px',
          overflowX: 'auto', overflowY: 'hidden',
        }}>
          {stages.map(col => {
            const allColApps = filteredApps.filter(a => a.stage_id === col.id);
            // The Applied anchor caps at 10 cards (oldest first = FCFS).
            // Other columns render every candidate.
            const isAppliedAnchor = col.stage_type === 'applied';
            const sortedColApps = isAppliedAnchor
              ? [...allColApps].sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime())
              : allColApps;
            const cappedColApps = isAppliedAnchor
              ? sortedColApps.slice(0, APPLIED_DISPLAY_LIMIT)
              : sortedColApps;
            // A notification links to one specific candidate, so that card is
            // rendered even when it falls past the Applied cap — otherwise the
            // link lands on a board where the candidate isn't drawn.
            const focusedBeyondCap = focusApplicationId
              && sortedColApps.some(a => a.id === focusApplicationId)
              && !cappedColApps.some(a => a.id === focusApplicationId);
            const colApps = focusedBeyondCap
              ? [...cappedColApps, sortedColApps.find(a => a.id === focusApplicationId)!]
              : cappedColApps;
            const overflowCount = isAppliedAnchor
              ? Math.max(0, allColApps.length - colApps.length)
              : 0;
            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  handleDragOver(e);
                  if (dragOverStageId !== col.id) setDragOverStageId(col.id);
                }}
                onDragLeave={(e) => {
                  // Only clear when the cursor actually leaves the column, not
                  // when it crosses onto a child card.
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                  if (dragOverStageId === col.id) setDragOverStageId(null);
                }}
                onDrop={(e) => handleDrop(e, col.id)}
                style={{
                  flex: '1 1 0', minWidth: '240px', display: 'flex',
                  flexDirection: 'column', background: 'var(--bg)',
                  borderRadius: 'var(--radius)',
                  border: `1px solid ${dragOverStageId === col.id && draggingId ? 'var(--primary)' : 'var(--border)'}`,
                  boxShadow: dragOverStageId === col.id && draggingId ? '0 0 0 3px var(--primary-light)' : 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '2px solid ' + col.color_bg,
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', background: 'var(--surface)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: col.color_text,
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{col.label}</span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                    background: col.color_bg, color: col.color_text,
                  }}>
                    {allColApps.length}
                  </span>
                </div>

                <div style={{
                  flex: 1, overflowY: 'auto', padding: '8px',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  {allColApps.length === 0 && (
                    <div style={{
                      padding: '24px 12px', textAlign: 'center', color: 'var(--text-light)',
                      fontSize: '0.8rem', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                      margin: '4px',
                    }}>
                      Drop here
                    </div>
                  )}
                  {colApps.map(app => {
                    const isExpanded = expandedId === app.id;
                    const liveInterview = activeInterviewForApp(app.id);
                    const availability = latestRequestForApp(app.id);
                    const availabilityStatus = availability?.status as AvailabilityStatus | undefined;
                    // Only one handshake can be open at a time, so the card's
                    // primary action is unambiguous: ask, or pick.
                    const awaitingPick = availabilityStatus === 'awaiting_employer';
                    const handshakeOpen = Boolean(liveRequestForApp(app.id));
                    // The card a notification pointed at: opened and outlined
                    // until the employer collapses it.
                    const isFocused = app.id === focusApplicationId && isExpanded;
                    return (
                      <div
                        key={app.id}
                        ref={app.id === focusApplicationId ? focusCardRef : undefined}
                        draggable
                        onDragStart={(e) => handleDragStart(e, app.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverStageId(null); setTrashHover(false); }}
                        onClick={() => setExpandedId(isExpanded ? null : app.id)}
                        style={{
                          background: 'var(--surface)',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${isFocused ? 'var(--primary)' : 'var(--border)'}`,
                          padding: '12px',
                          cursor: 'grab',
                          opacity: draggingId === app.id ? 0.5 : 1,
                          transition: 'box-shadow 0.15s, opacity 0.15s, border-color 0.15s',
                          boxShadow: draggingId === app.id
                            ? '0 4px 12px rgba(0,0,0,0.15)'
                            : isFocused ? '0 0 0 3px var(--primary-light)' : 'var(--shadow)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          {/* Avatar and name open the candidate's profile. The
                              card itself is draggable and toggles details, so
                              stop propagation to keep both gestures usable. */}
                          <Link
                            href={`/dashboard/employer/students/${app.student.id}`}
                            onClick={(e) => e.stopPropagation()}
                            draggable={false}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                          >
                            <Avatar src={app.student.profile.avatar_url} name={app.student.profile.full_name} size={32} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {app.student.profile.full_name}
                              </p>
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {app.student.major || 'No major'}
                                {app.student.graduation_year ? ` · '${String(app.student.graduation_year).slice(-2)}` : ''}
                              </p>
                            </div>
                          </Link>
                          {app.match_score != null && (
                            <span
                              title={`${app.match_score}% match to this listing`}
                              style={{
                                flexShrink: 0, fontSize: '0.68rem', fontWeight: 700,
                                padding: '3px 7px', borderRadius: 10,
                                background: matchPill(app.match_score).bg,
                                color: matchPill(app.match_score).color,
                              }}
                            >
                              {app.match_score}%
                            </span>
                          )}
                        </div>

                        {/* At-a-glance signals, so the board is usable without
                            opening every card. */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                          {app.resume && (
                            <span style={{
                              fontSize: '0.63rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                              background: 'var(--chip-blue-bg)', color: 'var(--chip-blue-ink)',
                            }}>
                              Resume
                            </span>
                          )}
                          {app.answers?.length > 0 && (
                            <span style={{
                              fontSize: '0.63rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                              background: 'var(--chip-indigo-bg)', color: 'var(--chip-indigo-ink)',
                            }}>
                              {app.answers.length} answer{app.answers.length === 1 ? '' : 's'}
                            </span>
                          )}
                          {app.flagged_knockout && (
                            <span
                              title="Answered a knockout question outside your stated requirements"
                              style={{
                                fontSize: '0.63rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                                background: 'var(--danger-bg)', color: 'var(--danger-fg)',
                              }}
                            >
                              Knockout
                            </span>
                          )}
                          {liveInterview && (
                            <span
                              title={`Interview ${liveInterview.status === 'accepted' ? 'confirmed' : 'invite sent'} for ${formatInterviewWhen(liveInterview.scheduled_at)}`}
                              style={{
                                fontSize: '0.63rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                                background: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)',
                              }}
                            >
                              {formatInterviewWhen(liveInterview.scheduled_at)}
                            </span>
                          )}
                          {/* Where the availability handshake currently sits.
                              Dropped once a real interview exists — the
                              confirmed time above says it better. */}
                          {availabilityStatus && availabilityStatus !== 'scheduled' && availabilityStatus !== 'cancelled' && (
                            <span
                              title={`Interview times: ${EMPLOYER_STATUS_LABELS[availabilityStatus]}`}
                              style={{
                                fontSize: '0.63rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                                background: STATUS_CHIP[availabilityStatus].bg,
                                color: STATUS_CHIP[availabilityStatus].color,
                              }}
                            >
                              {EMPLOYER_STATUS_LABELS[availabilityStatus]}
                            </span>
                          )}
                        </div>

                        <p style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>
                          Applied {timeAgo(app.applied_at)} · {isExpanded ? 'click to collapse' : 'click for details'}
                        </p>

                        {isExpanded && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                            <div style={{ fontSize: '0.78rem', marginBottom: '6px', wordBreak: 'break-word' }}>
                              <span style={{ color: 'var(--text-light)' }}>Email: </span>
                              <span>{app.student.profile.email}</span>
                            </div>
                            {app.student.graduation_year && (
                              <div style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
                                <span style={{ color: 'var(--text-light)' }}>Class of </span>
                                <span>{app.student.graduation_year}</span>
                              </div>
                            )}
                            <div style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
                              <span style={{ color: 'var(--text-light)' }}>Applied to: </span>
                              <span>{app.listing.title}</span>
                            </div>
                            {app.match_score != null && (
                              <div style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
                                <span style={{ color: 'var(--text-light)' }}>Match score: </span>
                                <span style={{ fontWeight: 600, color: matchPill(app.match_score).color }}>
                                  {app.match_score}%
                                </span>
                                <span style={{ color: 'var(--text-light)' }}>
                                  {' '}— skills, industry, experience, and preference fit
                                </span>
                              </div>
                            )}
                            {app.student.bio && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '8px 0', lineHeight: 1.4 }}>
                                {app.student.bio}
                              </p>
                            )}
                            {app.answers?.length > 0 && (
                              <div style={{ margin: '8px 0' }}>
                                {[...app.answers]
                                  .sort((x, y) => (x.question?.position ?? 0) - (y.question?.position ?? 0))
                                  .map(ans => (
                                    <div key={ans.id} style={{ marginBottom: 6 }}>
                                      <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-light)' }}>
                                        {ans.question?.prompt ?? 'Question'}
                                      </p>
                                      <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        {answerText(ans)}
                                      </p>
                                    </div>
                                  ))}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {/* Step 1 / step 3 of the availability handshake.
                                  While we're waiting on the candidate the
                                  button stays visible but inert, so the card
                                  explains itself instead of going blank. */}
                              {awaitingPick ? (
                                <button
                                  onClick={() => { setAvailabilityError(''); setPickTimeApp(app); }}
                                  style={{
                                    fontSize: '0.72rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--chip-amber-ink)', background: 'var(--chip-amber-bg)',
                                    color: 'var(--chip-amber-ink)', fontWeight: 700, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  Pick interview time
                                </button>
                              ) : !handshakeOpen && (
                                <button
                                  onClick={() => { setAvailabilityError(''); setRequestTimesApp(app); }}
                                  style={{
                                    fontSize: '0.72rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--primary)', background: 'var(--surface)',
                                    color: 'var(--primary)', fontWeight: 600, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  Request Times
                                </button>
                              )}
                              {handshakeOpen && !awaitingPick && (
                                <span style={{
                                  fontSize: '0.7rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                  border: '1px dashed var(--border)', color: 'var(--text-light)',
                                  display: 'inline-flex', alignItems: 'center',
                                }}>
                                  Waiting on candidate’s availability
                                </span>
                              )}
                              <button
                                onClick={() => openScheduleModal(app)}
                                style={{
                                  fontSize: '0.72rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--primary)', background: 'var(--primary)',
                                  color: 'var(--on-primary)', fontWeight: 600, cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                {liveInterview ? 'Reschedule interview' : 'Schedule interview'}
                              </button>
                              {app.resume && (
                                <a
                                  href={`/api/files/resume/${app.resume.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: '0.72rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--primary)', color: 'var(--primary)',
                                    textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  Resume
                                </a>
                              )}
                              {/* Deep-link straight into the thread with this
                                  student: Inbox reads ?to= to pre-select the
                                  conversation (creating a draft row if they've
                                  never been messaged) and focuses the composer. */}
                              <Link
                                href={`/dashboard/employer/inbox?to=${app.student.user_id}&name=${encodeURIComponent(app.student.profile.full_name)}`}
                                style={{
                                  fontSize: '0.72rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border)', color: 'var(--text)',
                                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
                                }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                Message
                              </Link>
                              <Link
                                href={`/dashboard/employer/applications?listing=${app.listing.id}`}
                                style={{
                                  fontSize: '0.72rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border)', color: 'var(--text)',
                                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
                                }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                Full application
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {overflowCount > 0 && (
                    <Link
                      href={`/dashboard/employer/pipeline/all?listing=${selectedListing}&stage=${col.id}`}
                      style={{
                        display: 'block',
                        textAlign: 'center',
                        padding: '10px 8px',
                        margin: '4px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px dashed ${col.color_text}`,
                        background: col.color_bg,
                        color: col.color_text,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      +{overflowCount} more — view all →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit-columns modal */}
      {editingStages && (
        <div
          onClick={closeEditModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 'var(--radius)', width: 'min(560px, 92vw)',
              maxHeight: '85vh', overflowY: 'auto', overflowX: 'hidden', padding: '24px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Edit pipeline columns</h3>
              <button
                onClick={closeEditModal}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}
                aria-label="Close"
              >×</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              These columns are visible to candidates as their application status.
              Changes are previewed below and only take effect when you click <strong>Save changes</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {draftStages.map((s) => {
                // Candidate count is based on the persisted apps state —
                // shows current truth until the employer saves.
                const count = applications.filter(a => a.stage_id === s.id).length;
                const isNew = s.id.startsWith('tmp_');
                const isDragging = stageDragId === s.id;
                const isDragOver = !s.locked && stageDragOverId === s.id && stageDragId && stageDragId !== s.id;
                return (
                  <div
                    key={s.id}
                    draggable={!s.locked}
                    onDragStart={(e) => {
                      if (s.locked) return;
                      setStageDragId(s.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', s.id);
                    }}
                    onDragOver={(e) => {
                      if (s.locked) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (stageDragOverId !== s.id) setStageDragOverId(s.id);
                    }}
                    onDragLeave={() => {
                      if (stageDragOverId === s.id) setStageDragOverId(null);
                    }}
                    onDrop={(e) => {
                      if (s.locked) return;
                      e.preventDefault();
                      const fromId = e.dataTransfer.getData('text/plain') || stageDragId;
                      if (fromId) draftReorder(fromId, s.id);
                      setStageDragId(null);
                      setStageDragOverId(null);
                    }}
                    onDragEnd={() => {
                      setStageDragId(null);
                      setStageDragOverId(null);
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 8, padding: 10,
                      border: `1px solid ${isDragOver ? 'var(--primary)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      background: isDragOver ? 'var(--primary-light)' : (s.locked ? 'var(--surface-hover)' : 'var(--surface)'),
                      opacity: isDragging ? 0.4 : 1,
                      transition: 'opacity 0.15s, background 0.15s, border-color 0.15s',
                    }}
                  >
                    {/* Row 1: drag handle, color dot, name input, delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {s.locked ? (
                        <span
                          title="Locked column"
                          style={{
                            color: 'var(--text-light)',
                            fontSize: 13,
                            lineHeight: 1,
                            padding: '0 4px',
                            userSelect: 'none',
                          }}
                        >🔒</span>
                      ) : (
                        <span
                          title="Drag to reorder"
                          style={{
                            cursor: 'grab',
                            color: 'var(--text-light)',
                            fontSize: 16,
                            lineHeight: 1,
                            padding: '0 4px',
                            userSelect: 'none',
                          }}
                        >⋮⋮</span>
                      )}
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color_text, flexShrink: 0 }} />
                      <input
                        value={s.label}
                        // Applied and Offered are the board's fixed endpoints —
                        // stage_type drives the dashboard stats and the student's
                        // status label, so their titles aren't editable. A DB
                        // trigger rejects the rename too (trg_guard_locked_stage).
                        disabled={s.locked}
                        title={s.locked ? `"${s.label}" is a fixed column and can't be renamed` : undefined}
                        onChange={(e) => draftRenameStage(s.id, e.target.value)}
                        onBlur={(e) => {
                          // Don't allow empty labels — revert if blank.
                          if (!e.target.value.trim()) draftRenameStage(s.id, 'Untitled');
                        }}
                        style={{
                          flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: 6,
                          border: '1px solid var(--border)', fontSize: '0.85rem',
                          background: s.locked ? 'var(--bg)' : 'var(--surface)',
                          color: s.locked ? 'var(--text-secondary)' : 'var(--text)',
                          cursor: s.locked ? 'not-allowed' : 'text',
                          fontWeight: s.locked ? 600 : 400,
                        }}
                      />
                      {isNew && (
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px',
                          borderRadius: 4, background: '#dcfce7', color: 'var(--success-fg)',
                          flexShrink: 0,
                        }}>NEW</span>
                      )}
                      {!s.locked && (
                        <button
                          onClick={() => startDelete(s)}
                          style={{
                            border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger-fg)',
                            borderRadius: 6, padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    {/* Row 2: color swatches + candidate count */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 28, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {COLOR_PRESETS.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => draftRecolorStage(s.id, c.bg, c.text)}
                            aria-label={`Color ${i + 1}`}
                            style={{
                              width: 18, height: 18, borderRadius: '50%',
                              background: c.bg, border: s.color_bg === c.bg ? `2px solid ${c.text}` : '1px solid var(--border)',
                              cursor: 'pointer', padding: 0,
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginLeft: 'auto' }}>
                        {isNew ? '0 candidates' : `${count} candidate${count === 1 ? '' : 's'}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add new stage */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 10 }}>Add a column</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select
                  value={newStagePreset}
                  onChange={e => {
                    const label = e.target.value;
                    setNewStagePreset(label);
                    const preset = PIPELINE_STAGE_PRESETS.find(p => p.label === label);
                    if (preset) setNewStageColorIdx(colorIdxForPreset(preset));
                  }}
                  style={{
                    padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
                    fontSize: '0.88rem', background: 'var(--surface)',
                  }}
                >
                  <option value="">Choose a stage…</option>
                  {PIPELINE_STAGE_PRESETS.map(p => {
                    // A stage already on the board stays listed but inert, so the
                    // dropdown always shows the whole flow.
                    const alreadyUsed = draftStages.some(
                      s => s.label.toLowerCase() === p.label.toLowerCase()
                    );
                    return (
                      <option key={p.label} value={p.label} disabled={alreadyUsed}>
                        {p.label}{alreadyUsed ? ' — already on the board' : ''}
                      </option>
                    );
                  })}
                </select>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {COLOR_PRESETS.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setNewStageColorIdx(i)}
                        style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: c.bg,
                          border: newStageColorIdx === i ? `2px solid ${c.text}` : '1px solid var(--border)',
                          cursor: 'pointer', padding: 0,
                        }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={draftAddStage}
                    disabled={!newStagePreset}
                    className="btn-primary"
                    style={{
                      fontSize: '0.85rem', padding: '7px 16px',
                      marginLeft: 'auto',
                      opacity: newStagePreset ? 1 : 0.5,
                      cursor: newStagePreset ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Add column
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0 }}>
                  Columns come from a standard recruitment flow so candidates read the
                  same status everywhere, and each one slots into the board where its
                  step belongs. Applied and Offered are fixed — they anchor the board
                  and can&apos;t be renamed or removed.
                </p>
              </div>
            </div>

            {/* Save / Cancel footer */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 8,
              borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 20,
              flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: '0.78rem', color: 'var(--text-light)',
                alignSelf: 'center', marginRight: 'auto',
              }}>
                {pendingDeletes.length > 0 && (
                  <>{pendingDeletes.length} column{pendingDeletes.length === 1 ? '' : 's'} marked for deletion · </>
                )}
                {isDraftDirty() ? 'Unsaved changes' : 'No changes'}
              </span>
              <button
                onClick={closeEditModal}
                disabled={savingStages}
                className="btn-secondary"
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStages}
                disabled={savingStages || !isDraftDirty()}
                className="btn-primary"
                style={{
                  fontSize: '0.85rem', padding: '8px 16px',
                  opacity: (savingStages || !isDraftDirty()) ? 0.5 : 1,
                  cursor: (savingStages || !isDraftDirty()) ? 'not-allowed' : 'pointer',
                }}
              >
                {savingStages ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (() => {
        const candidateCount = applications.filter(a => a.stage_id === deleteTarget.id).length;
        // Reassign targets come from the draft (so a column already
        // marked for deletion isn't listed as a destination).
        const otherStages = draftStages.filter(s => s.id !== deleteTarget.id);
        return (
          <div
            onClick={() => setDeleteTarget(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--surface)', borderRadius: 'var(--radius)', width: 'min(440px, 92vw)', padding: '24px',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 10 }}>
                Delete &ldquo;{deleteTarget.label}&rdquo;?
              </h3>
              {candidateCount > 0 ? (
                <>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    There {candidateCount === 1 ? 'is' : 'are'} <strong>{candidateCount}</strong>{' '}
                    candidate{candidateCount === 1 ? '' : 's'} in this column. Where would you like to move them?
                  </p>
                  {otherStages.length > 0 ? (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
                        Move candidates to:
                      </label>
                      <select
                        value={reassignTo}
                        onChange={e => setReassignTo(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 6,
                          border: '1px solid var(--border)', fontSize: '0.88rem',
                        }}
                      >
                        {otherStages.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                      This is the last column, so candidates can only be removed entirely.
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '7px 14px' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => draftConfirmDelete('delete-with-candidates')}
                      style={{
                        fontSize: '0.85rem', padding: '7px 14px', borderRadius: 6,
                        border: '1px solid var(--danger-border)', background: 'var(--danger-bg)', color: 'var(--danger-fg)', cursor: 'pointer',
                      }}
                    >
                      Delete candidates too
                    </button>
                    {otherStages.length > 0 && (
                      <button
                        onClick={() => draftConfirmDelete('reassign')}
                        className="btn-primary"
                        style={{ fontSize: '0.85rem', padding: '7px 14px' }}
                      >
                        Move &amp; delete column
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    This column is empty. Delete it?
                  </p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setDeleteTarget(null)}
                      className="btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '7px 14px' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => draftConfirmDelete('delete-with-candidates')}
                      className="btn-primary"
                      style={{ fontSize: '0.85rem', padding: '7px 14px' }}
                    >
                      Delete column
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Confirm a stage move */}
      {pendingMove && (() => {
        const fromStage = stages.find(s => s.id === pendingMove.app.stage_id);
        return (
          <div
            onClick={() => { if (!movingApp) setPendingMove(null); }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--surface)', borderRadius: 'var(--radius)',
                width: 'min(420px, 92vw)', padding: '24px',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 10 }}>
                Move {pendingMove.app.student.profile.full_name} to &ldquo;{pendingMove.toStage.label}&rdquo;?
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                {fromStage
                  ? <>They&apos;ll move from <strong>{fromStage.label}</strong> to <strong>{pendingMove.toStage.label}</strong>.</>
                  : <>They&apos;ll be placed in <strong>{pendingMove.toStage.label}</strong>.</>}
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: 18 }}>
                Pipeline columns are visible to candidates, so {pendingMove.app.student.profile.full_name.split(' ')[0]} will
                be notified that their application status changed.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setPendingMove(null)}
                  disabled={movingApp}
                  className="btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '7px 14px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMove}
                  disabled={movingApp}
                  className="btn-primary"
                  style={{
                    fontSize: '0.85rem', padding: '7px 14px',
                    opacity: movingApp ? 0.6 : 1,
                    cursor: movingApp ? 'not-allowed' : 'pointer',
                  }}
                >
                  {movingApp ? 'Moving…' : 'Yes, move candidate'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirm permanent removal (trash drop-zone) */}
      {trashTarget && (
        <div
          onClick={() => { if (!deletingApp) { setTrashTarget(null); setRemoveError(''); } }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)', borderRadius: 'var(--radius)',
              width: 'min(440px, 92vw)', padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 10 }}>
              Remove {trashTarget.student.profile.full_name} from this pipeline?
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              This permanently deletes their application to{' '}
              <strong>{trashTarget.listing.title}</strong>, along with their answers
              and any scheduled interviews. <strong>This can&apos;t be undone.</strong>
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: 18 }}>
              The application also disappears from the candidate&apos;s tracker, and they
              become free to apply to this listing again. To reject someone without
              deleting their record, move them to a column instead.
            </p>
            {removeError && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, marginBottom: 14,
                background: 'var(--danger-bg)', color: 'var(--danger-fg)',
                fontSize: '0.8rem', border: '1px solid var(--danger-border)',
              }}>
                {removeError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setTrashTarget(null); setRemoveError(''); }}
                disabled={deletingApp}
                className="btn-secondary"
                style={{ fontSize: '0.85rem', padding: '7px 14px' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                disabled={deletingApp}
                style={{
                  fontSize: '0.85rem', padding: '7px 14px', borderRadius: 6,
                  border: '1px solid var(--danger-border)', background: 'var(--danger-bg)',
                  color: 'var(--danger-fg)', fontWeight: 600,
                  opacity: deletingApp ? 0.6 : 1,
                  cursor: deletingApp ? 'not-allowed' : 'pointer',
                }}
              >
                {deletingApp ? 'Removing…' : 'Yes, remove permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ScheduleInterviewModal
        open={scheduleApp !== null}
        onClose={closeScheduleModal}
        onSubmit={handleScheduleSubmit}
        candidateName={scheduleApp?.student.profile.full_name}
        listingTitle={scheduleApp?.listing.title}
        mode={scheduleInterview ? 'reschedule' : 'create'}
        initialData={scheduleInterview ? {
          scheduledAt: scheduleInterview.scheduled_at,
          durationMinutes: scheduleInterview.duration_minutes,
          notes: scheduleInterview.employer_notes || '',
        } : null}
      />

      {/* Step 1 — ask the candidate for times. */}
      <RequestTimesModal
        open={requestTimesApp !== null}
        onClose={() => setRequestTimesApp(null)}
        onSubmit={handleRequestTimes}
        candidateName={requestTimesApp?.student.profile.full_name}
        listingTitle={requestTimesApp?.listing.title}
      />

      {/* Step 3 — pick a final time from what they offered. */}
      <SelectInterviewTimeModal
        open={pickTimeApp !== null}
        onClose={() => setPickTimeApp(null)}
        request={pickTimeApp ? latestRequestForApp(pickTimeApp.id) ?? null : null}
        candidateName={pickTimeApp?.student.profile.full_name}
        listingTitle={pickTimeApp?.listing.title}
        onConfirm={handleConfirmTime}
        onRequestNewWindow={handleRequestNewWindow}
      />

      {availabilityError && (
        <div
          role="alert"
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10000, padding: '10px 16px', borderRadius: 8,
            background: 'var(--danger-bg)', color: 'var(--danger-fg)',
            border: '1px solid var(--danger-border)', fontSize: '0.82rem', fontWeight: 600,
          }}
        >
          {availabilityError}
        </div>
      )}
    </div>
  );
}

export default function EmployerPipelinePage() {
  return (
    <Suspense fallback={
      <div className="dash-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    }>
      <EmployerPipelineInner />
    </Suspense>
  );
}
