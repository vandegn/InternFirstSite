# Supabase Auth email templates

Auth emails (confirm signup, reset password) are sent by Supabase, not the app,
so the templates live in the Supabase dashboard. This folder keeps the source of
truth in git. There is no `supabase/config.toml` in this repo, so nothing here is
applied automatically: every change has to be pasted into the dashboard by hand.

## Reset Password (`reset-password.html`)

Where it goes: **Supabase dashboard → Authentication → Email Templates → Reset Password**
(newer dashboards: Authentication → Emails → Templates → Reset password).

1. **Subject:** `Reset your InternFirst password`
2. **Message body:** paste the whole of `reset-password.html`, then save.
3. Check **Authentication → URL Configuration → Site URL** is `https://www.intern-first.com`.
   The link is built from `{{ .SiteURL }}`, not from the `redirectTo` the app sends.
4. Send yourself a reset from `/forgot-password`, then send a second one, and check both in Gmail.

The link has the same `/auth/confirm?token_hash=…&type=…` shape as the confirm-signup
template, with `type=recovery`. `/auth/confirm` shows a button, `POST /api/auth/confirm`
verifies the token and sends the user to `/reset-password`. The link is never opened
on page load, so mail scanners can't use up the single-use token.

"Expires in 1 hour" matches Supabase's default email OTP expiry (3600s). If
**Authentication → Providers → Email → Email OTP Expiration** is set to something
else, update that sentence.

### Why the second email was getting collapsed

Gmail puts emails with the same sender and subject in one thread. Then it hides
any part of a new message that matches an earlier one and shows "…" instead.
Supabase's default template has no visible text that changes between sends: the
token is only in the `href`, which Gmail doesn't compare. So the whole second
email matched the first and got hidden, which made it look empty or suspicious.

The template makes each send's visible text different:

- A **request reference** (`{{ slice .TokenHash 0 8 }}`, the first 8 characters of
  that send's token hash) appears in the hidden preheader and in the footer. It
  changes every time and doesn't give away anything you couldn't already see in the
  link. Gmail trims repeated text at the *end* of a message, so having it in the
  footer matters most.
- The **plain-text fallback link** shows the full URL, including the token hash,
  so that line is different every time as well.

The subject doesn't change, so a user's reset emails still group into one tidy
thread. It's specific ("Reset your InternFirst password") rather than a generic
"Reset Your Password", which looks better in the inbox and to spam filters.

If the dashboard rejects `slice` (it's a built-in Go template function, so it
shouldn't), delete the two "Request ref …" fragments. The fallback link alone still
makes each email's visible text different.

## Confirm signup (`confirm-signup.html`)

Where it goes: **Supabase dashboard → Authentication → Email Templates → Confirm signup**.

1. **Subject:** `Confirm your InternFirst account`
2. **Message body:** paste the whole of `confirm-signup.html`, then save.
3. Sign up with a fresh `.edu` address and a Gmail address and check which folder each lands in.

It's built the same way as the reset template: plain text, one button, a fallback link,
and a per-send request reference. The link is
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, which
`POST /api/auth/confirm` already accepts. The same 1-hour expiry note applies.

## Keeping auth emails out of spam

The template only helps once the email comes from our own domain. Supabase's built-in
mailer sends from a shared server that isn't authorized for intern-first.com, which
spam filters (especially university ones) distrust. Turn on **Authentication → Emails →
SMTP Settings → Custom SMTP** with Resend, which already has DKIM set up on intern-first.com:

- Host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key
- Sender email `noreply@intern-first.com`, sender name `InternFirst`
