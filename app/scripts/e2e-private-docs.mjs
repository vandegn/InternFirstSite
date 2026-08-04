// End-to-end verification for the private applicant-docs rollout
// (docs/private-applicant-docs-plan.md step 7). Exercises the real Supabase
// project and the running dev server on :3000.
//
// The CLAUDE.md test accounts no longer exist, so this creates its own
// throwaway fixtures — a student, two approved employers, a paused listing,
// an application, a file question/answer — and deletes every one of them in
// the finally block. Run: node scripts/e2e-private-docs.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = 'http://localhost:3000';
const PASSWORD = 'e2e-temp-pass-1';

const admin = createClient(URL_, SERVICE);

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

// Sign in with the same @supabase/ssr client the app uses, capturing the auth
// cookies it writes so we can replay them against the dev server.
async function login(email) {
  const jar = new Map();
  const client = createServerClient(URL_, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  const cookie = [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
  return { client, cookie };
}

const cleanup = [];
async function makeUser(label, role, extraRow) {
  const email = `e2e-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw new Error(`create ${label}: ${error.message}`);
  const uid = data.user.id;
  cleanup.push(() => admin.auth.admin.deleteUser(uid)); // cascades profile -> role rows -> listings -> applications
  const { error: pErr } = await admin.from('profiles').insert({ user_id: uid, role, full_name: `E2E ${label}`, email });
  if (pErr) throw new Error(`profile ${label}: ${pErr.message}`);
  const table = role === 'student' ? 'students' : 'employers';
  const { data: row, error: rErr } = await admin.from(table).insert({ user_id: uid, ...extraRow }).select().single();
  if (rErr) throw new Error(`${table} ${label}: ${rErr.message}`);
  return { uid, email, rowId: row.id, ...(await login(email)) };
}

async function route(kind, id, cookie) {
  return fetch(`${APP}/api/files/${kind}/${id}`, { redirect: 'manual', headers: cookie ? { cookie } : {} });
}

try {
  // ---- throwaway fixtures ----
  const student = await makeUser('student', 'student', { major: 'Finance' });
  const bystander = await makeUser('bystander', 'student', {});
  const listingEmployer = await makeUser('employer-a', 'employer', { company_name: 'E2E Listing Co', verification_status: 'approved' });
  const otherEmployer = await makeUser('employer-b', 'employer', { company_name: 'E2E Other Co', verification_status: 'approved' });
  const studentId = student.rowId;

  // Paused so it never shows up in the student browse page while the test runs.
  const { data: listing, error: lErr } = await admin.from('internship_listings')
    .insert({ employer_id: listingEmployer.rowId, title: 'E2E Private Docs Listing', description: 'e2e', status: 'paused', industry: 'Financial Services & Insurance' })
    .select().single();
  if (lErr) throw new Error(`listing: ${lErr.message}`);

  // ---- storage INSERT policy ----
  const bytes = new Blob([`e2e private docs test ${Date.now()}`], { type: 'text/plain' });
  const ownPath = `resumes/${studentId}/e2e-test.txt`;
  const { error: upOwn } = await student.client.storage.from('applicant-docs').upload(ownPath, bytes, { upsert: false });
  check('student uploads into own folder', !upOwn, upOwn?.message);
  cleanup.push(() => admin.storage.from('applicant-docs').remove([ownPath]));

  const { error: upOther } = await student.client.storage.from('applicant-docs')
    .upload(`resumes/${bystander.rowId}/e2e-steal.txt`, bytes, { upsert: false });
  check('student CANNOT upload into another student folder', !!upOther);

  const { error: upWeird } = await student.client.storage.from('applicant-docs')
    .upload(`whatever/${studentId}/e2e.txt`, bytes, { upsert: false });
  check('student CANNOT upload outside resumes/application-files', !!upWeird);

  const { error: upEmp } = await listingEmployer.client.storage.from('applicant-docs')
    .upload(`resumes/${studentId}/e2e-emp.txt`, bytes, { upsert: false });
  check('employer CANNOT upload at all', !!upEmp);

  const { data: dl, error: dlErr } = await student.client.storage.from('applicant-docs').download(ownPath);
  check('bucket not directly readable even by owner', !!dlErr && !dl, dlErr?.message ?? 'download succeeded');

  // ---- resume row + route auth matrix ----
  const { data: resumeRow, error: insErr } = await student.client
    .from('student_resumes')
    .insert({ student_id: studentId, name: 'E2E Test Resume', storage_path: ownPath })
    .select().single();
  if (insErr) throw new Error(`resume insert: ${insErr.message}`);

  let res = await route('resume', resumeRow.id, null);
  check('unauthenticated -> 401', res.status === 401, `got ${res.status}`);

  res = await route('resume', resumeRow.id, student.cookie);
  check('owner student -> 302', res.status === 302, `got ${res.status}`);
  if (res.status === 302) {
    const signed = await fetch(res.headers.get('location'));
    const body = await signed.text();
    check('signed URL serves the actual bytes', signed.status === 200 && body.startsWith('e2e private docs test'), `status ${signed.status}`);
  }

  res = await route('resume', resumeRow.id, listingEmployer.cookie);
  check('employer WITHOUT application -> 404', res.status === 404, `got ${res.status}`);
  res = await route('resume', resumeRow.id, bystander.cookie);
  check('unrelated student -> 404', res.status === 404, `got ${res.status}`);
  res = await route('resume', resumeRow.id, otherEmployer.cookie);
  check('unrelated approved employer -> 404', res.status === 404, `got ${res.status}`);
  res = await route('avatar', resumeRow.id, student.cookie);
  check('unknown kind -> 404', res.status === 404, `got ${res.status}`);

  // ---- attach resume to an application -> the listing employer gains access ----
  const { data: app, error: appErr } = await admin.from('applications')
    .insert({ student_id: studentId, listing_id: listing.id, resume_id: resumeRow.id })
    .select().single();
  if (appErr) throw new Error(`application: ${appErr.message}`);

  res = await route('resume', resumeRow.id, listingEmployer.cookie);
  check('employer WITH application -> 302', res.status === 302, `got ${res.status}`);
  res = await route('resume', resumeRow.id, otherEmployer.cookie);
  check('other employer still -> 404', res.status === 404, `got ${res.status}`);

  // ---- application-answer kind ----
  const { data: question, error: qErr } = await admin.from('listing_questions')
    .insert({ listing_id: listing.id, prompt: 'E2E file question', question_type: 'file' })
    .select().single();
  if (qErr) throw new Error(`question: ${qErr.message}`);

  const { data: answer, error: aErr } = await admin.from('application_answers')
    .insert({ application_id: app.id, question_id: question.id, storage_path: ownPath })
    .select().single();
  if (aErr) throw new Error(`answer: ${aErr.message}`);

  res = await route('application-answer', answer.id, student.cookie);
  check('answer: owning student -> 302', res.status === 302, `got ${res.status}`);
  res = await route('application-answer', answer.id, listingEmployer.cookie);
  check('answer: listing employer -> 302', res.status === 302, `got ${res.status}`);
  res = await route('application-answer', answer.id, bystander.cookie);
  check('answer: unrelated student -> 404', res.status === 404, `got ${res.status}`);
  res = await route('application-answer', answer.id, otherEmployer.cookie);
  check('answer: unrelated employer -> 404', res.status === 404, `got ${res.status}`);

  // ---- backfilled objects all exist in the private bucket ----
  const { data: backfilled } = await admin.from('student_resumes')
    .select('id, storage_path').not('storage_path', 'is', null).neq('id', resumeRow.id);
  for (const r of backfilled ?? []) {
    const { data: s, error: sErr } = await admin.storage.from('applicant-docs').createSignedUrl(r.storage_path, 60);
    let ok = false;
    if (!sErr && s?.signedUrl) ok = (await fetch(s.signedUrl)).status === 200;
    check(`backfilled object present: ${r.storage_path}`, ok, sErr?.message);
  }

  // ---- direct public access to the private bucket ----
  const pub = await fetch(`${URL_}/storage/v1/object/public/applicant-docs/${ownPath}`);
  check('direct public URL to private bucket denied', pub.status >= 400, `got ${pub.status}`);
} finally {
  for (const fn of cleanup.reverse()) {
    try { await fn(); } catch (e) { console.error('cleanup error:', e.message); }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
