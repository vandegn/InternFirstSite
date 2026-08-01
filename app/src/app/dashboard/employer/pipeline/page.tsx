'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  supabase,
  getEmployerByUserId,
  getEmployerApplications,
  getEmployerListings,
  getListingStages,
  createStage,
  updateStage,
  deleteStage,
  reorderStages,
  updateApplicationStage,
  type PipelineStage,
} from '@/lib/supabase';

type Application = {
  id: string;
  status: string;
  stage_id: string | null;
  applied_at: string;
  resume: { id: string; name: string; file_url: string } | null;
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

const APPLIED_DISPLAY_LIMIT = 10;

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

export default function EmployerPipelinePage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [selectedListing, setSelectedListing] = useState('');
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Stage management modal — all edits stage into draftStages /
  // pendingDeletes and only persist on Save changes.
  const [editingStages, setEditingStages] = useState(false);
  const [draftStages, setDraftStages] = useState<PipelineStage[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<Array<{ id: string; reassignTo: string | null }>>([]);
  const [savingStages, setSavingStages] = useState(false);
  const [newStageLabel, setNewStageLabel] = useState('');
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

      const [appsData, listingsData] = await Promise.all([
        getEmployerApplications(employer.id),
        getEmployerListings(employer.id, 1, 100),
      ]);

      const normalizedApps = appsData.map((app: any) => ({
        ...app,
        listing: Array.isArray(app.listing) ? app.listing[0] : app.listing,
        resume: Array.isArray(app.resume) ? app.resume[0] || null : app.resume,
        student: (() => {
          const s = Array.isArray(app.student) ? app.student[0] : app.student;
          return s ? { ...s, profile: Array.isArray(s.profile) ? s.profile[0] : s.profile } : s;
        })(),
      }));

      setApplications(normalizedApps as Application[]);
      const ls = listingsData.data.map((l: any) => ({ id: l.id, title: l.title }));
      setListings(ls);
      if (ls.length > 0) setSelectedListing(ls[0].id);
      setLoading(false);
    }
    fetchData();
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

  const handleDrop = useCallback(async (e: React.DragEvent, newStageId: string) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData('text/plain');
    if (!appId) return;

    const app = applications.find(a => a.id === appId);
    if (!app || app.stage_id === newStageId) {
      setDraggingId(null);
      return;
    }

    const newStage = stages.find(s => s.id === newStageId);
    setApplications(prev => prev.map(a =>
      a.id === appId
        ? { ...a, stage_id: newStageId, status: newStage?.label ?? a.status }
        : a
    ));
    setDraggingId(null);

    try {
      await updateApplicationStage(appId, newStageId);
    } catch {
      setApplications(prev => prev.map(a =>
        a.id === appId ? { ...a, stage_id: app.stage_id, status: app.status } : a
      ));
    }
  }, [applications, stages]);

  function openEditModal() {
    setDraftStages(stages.map(s => ({ ...s })));
    setPendingDeletes([]);
    setNewStageLabel('');
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
    setNewStageLabel('');
    setNewStageColorIdx(0);
  }

  function draftAddStage() {
    if (!newStageLabel.trim() || !selectedListing) return;
    const color = COLOR_PRESETS[newStageColorIdx];
    const tmpId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newStage: PipelineStage = {
      id: tmpId,
      listing_id: selectedListing,
      label: newStageLabel.trim(),
      color_bg: color.bg,
      color_text: color.text,
      position: 0, // normalized on save
      stage_type: 'reviewing',
      locked: false,
    };
    setDraftStages(prev => {
      const offeredIdx = prev.findIndex(s => s.stage_type === 'offered');
      if (offeredIdx === -1) return [...prev, newStage];
      const next = [...prev];
      next.splice(offeredIdx, 0, newStage);
      return next;
    });
    setNewStageLabel('');
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
    const normalizedApps = appsData.map((app: any) => ({
      ...app,
      listing: Array.isArray(app.listing) ? app.listing[0] : app.listing,
      resume: Array.isArray(app.resume) ? app.resume[0] || null : app.resume,
      student: (() => {
        const s = Array.isArray(app.student) ? app.student[0] : app.student;
        return s ? { ...s, profile: Array.isArray(s.profile) ? s.profile[0] : s.profile } : s;
      })(),
    }));
    setApplications(normalizedApps as Application[]);
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
      setNewStageLabel('');
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
            const colApps = isAppliedAnchor
              ? sortedColApps.slice(0, APPLIED_DISPLAY_LIMIT)
              : sortedColApps;
            const overflowCount = isAppliedAnchor
              ? Math.max(0, allColApps.length - APPLIED_DISPLAY_LIMIT)
              : 0;
            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                style={{
                  flex: '1 1 0', minWidth: '240px', display: 'flex',
                  flexDirection: 'column', background: 'var(--bg)',
                  borderRadius: 'var(--radius)', border: '1px solid var(--border)',
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
                    return (
                      <div
                        key={app.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, app.id)}
                        onClick={() => setExpandedId(isExpanded ? null : app.id)}
                        style={{
                          background: 'var(--surface)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          padding: '12px',
                          cursor: 'grab',
                          opacity: draggingId === app.id ? 0.5 : 1,
                          transition: 'box-shadow 0.15s, opacity 0.15s',
                          boxShadow: draggingId === app.id ? '0 4px 12px rgba(0,0,0,0.15)' : 'var(--shadow)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <img
                            src={app.student.profile.avatar_url || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png'}
                            alt={app.student.profile.full_name}
                            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {app.student.profile.full_name}
                            </p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                              {app.student.major || 'No major'}
                            </p>
                          </div>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          {app.listing.title}
                        </p>
                        <p style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>
                          Applied {timeAgo(app.applied_at)}
                        </p>

                        {isExpanded && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                            <div style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
                              <span style={{ color: 'var(--text-light)' }}>Email: </span>
                              <span>{app.student.profile.email}</span>
                            </div>
                            {app.student.graduation_year && (
                              <div style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
                                <span style={{ color: 'var(--text-light)' }}>Class of </span>
                                <span>{app.student.graduation_year}</span>
                              </div>
                            )}
                            {app.student.bio && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
                                {app.student.bio}
                              </p>
                            )}
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {app.resume && (
                                <a
                                  href={app.resume.file_url}
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
                              <Link
                                href="/dashboard/employer/inbox"
                                style={{
                                  fontSize: '0.72rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border)', color: 'var(--text)',
                                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
                                }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                Message
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
                        onChange={(e) => draftRenameStage(s.id, e.target.value)}
                        onBlur={(e) => {
                          // Don't allow empty labels — revert if blank.
                          if (!e.target.value.trim()) draftRenameStage(s.id, 'Untitled');
                        }}
                        style={{
                          flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: 6,
                          border: '1px solid var(--border)', fontSize: '0.85rem',
                          background: 'var(--surface)',
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
                <input
                  placeholder="Column name (e.g., Phone Screen)"
                  value={newStageLabel}
                  onChange={e => setNewStageLabel(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.88rem' }}
                />
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
                    disabled={!newStageLabel.trim()}
                    className="btn-primary"
                    style={{
                      fontSize: '0.85rem', padding: '7px 16px',
                      marginLeft: 'auto',
                      opacity: newStageLabel.trim() ? 1 : 0.5,
                      cursor: newStageLabel.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Add column
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0 }}>
                  New columns are inserted between Applied and Offered.
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
    </div>
  );
}
