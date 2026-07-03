# Job Notifier

Polls **Adzuna**, **Reed**, and **Jooble** for jobs, matches new listings against
each user's saved preferences, and sends **email / SMS / push** notifications
when something fits. Includes a minimal web UI to save preferences and trigger
a manual check.

---

## Quick start

```bash
cd job-notifier
npm install
cp .env.example .env
```

Now open **`.env`** (not `.env.example`) in a text editor and fill in your keys
(see [Getting API keys](#getting-api-keys) below). Then:

```bash
npm start
```

Open **http://localhost:3000**, fill in the form, click **Save preferences**,
then click **Check now** to run an immediate check instead of waiting for the
schedule.

---

## How it works

```
public/ (frontend)  →  routes/api.js  →  services/pipeline.js
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                   ▼                   ▼
                 fetchers/adzuna.js   fetchers/reed.js    fetchers/jooble.js
                          │                   │                   │
                          └─────────► normalized jobs ◄───────────┘
                                              │
                                     services/matcher.js  (filter by keywords / location / salary)
                                              │
                                     services/notifier.js (email via SMTP, SMS via Twilio, push via ntfy.sh)
```

- `services/db.js` — a flat JSON file (`data/db.json`) storing subscribers and
  which job IDs have already been seen/notified, so people aren't re-notified
  about the same listing.
- `server.js` — starts the web server and a `node-cron` job that runs the
  pipeline automatically on a schedule (default: every 30 minutes).
- The frontend (`public/`) is a single static page: a preferences form and a
  "Check now" button that runs one pipeline cycle on demand and shows new
  matches.

---

## Getting API keys

You don't need all of these to get started — anything left blank is simply
skipped (you'll see a `Skipped: ... not set` warning in the terminal, not a
crash).

### Job sources

| Variable(s) | Sign up here | Notes |
|---|---|---|
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | [developer.adzuna.com](https://developer.adzuna.com) | Free, instant. Also set `ADZUNA_COUNTRY` (e.g. `gb`, `us`, `in`). |
| `REED_API_KEY` | [reed.co.uk/developers](https://www.reed.co.uk/developers) | Free, single key. |
| `JOOBLE_API_KEY` | [jooble.org/api/about](https://jooble.org/api/about) | Free, single key via request form. |

### Email — `SMTP_*`

Don't sign up for a "notification API" — use SMTP credentials from an email
provider.

**Gmail** (works, but fussy — see [Troubleshooting](#troubleshooting) below):
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=youraddress@gmail.com
SMTP_PASS=your16charapppassword   # NOT your normal Gmail password
SMTP_FROM="Job Notifier <youraddress@gmail.com>"
```
Requires 2-Step Verification turned on first, then generate an app password at
[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).

**Easier alternative — [Resend](https://resend.com)** (recommended):
```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=your_resend_api_key
SMTP_FROM="Job Notifier <onboarding@resend.dev>"
```
Free tier, no 2FA setup, works out of the box with their test sender address.
Mailgun and SendGrid work the same way if you'd rather use those.

### SMS — `TWILIO_*` (optional)

1. Sign up at [twilio.com/try-twilio](https://www.twilio.com/try-twilio) (free trial credit included)
2. From the [Twilio Console](https://console.twilio.com), copy your **Account SID** and **Auth Token**
3. Claim a trial phone number → that's `TWILIO_FROM_NUMBER`

Trial accounts can only text phone numbers you've manually verified in the
console.

### Push — `NTFY_BASE_URL` (optional)

No signup needed. Leave the default:
```bash
NTFY_BASE_URL=https://ntfy.sh
```
Each subscriber just picks a private topic name (e.g. `jn-priya-8821`) in the
frontend form, then subscribes to that same topic in the free
[ntfy app](https://ntfy.sh/app) or at `https://ntfy.sh/their-topic-name` in a
browser.

---

## Troubleshooting

**Terminal shows `Skipped: ... not set` for keys you already filled in**
This almost always means the file isn't actually named `.env`. Check with:
```bash
ls -a
```
Common causes:
- You edited `.env.example` instead of `.env` — rename or copy it:
  ```bash
  cp .env.example .env
  ```
- A text editor saved it as `.env.txt` (Windows hides real extensions by
  default) — rename it:
  ```bash
  mv .env.txt .env
  ```
- You're not in the `job-notifier` folder. Confirm with `pwd`; `.env` must sit
  next to `package.json`.

After any fix, **restart the server** — env vars are only read at startup:
```bash
# Ctrl+C to stop, then:
npm start
```

**Gmail: "The setting you are looking for is not available for your account"**
App passwords require 2-Step Verification to be enabled first — turn it on at
[myaccount.google.com/security](https://myaccount.google.com/security), then
retry the app password page. If it still doesn't appear, the account may be a
Workspace/school account with app passwords disabled by an admin, or have
Advanced Protection enabled. Easiest fix: switch to
[Resend](https://resend.com) instead (see above).

**`npm install` shows "N vulnerabilities"**
Normal — npm's standard audit summary, not an error. Do **not** run
`npm audit fix --force`; it can upgrade dependencies to breaking versions.
Safe to ignore for local use.

**"Check now" runs but nothing happens / no email arrives**
- Check the terminal for `[notifier:email] failed for ...` lines — the error
  message there says what went wrong (bad credentials, wrong port, etc).
- Check your spam folder.
- Confirm your saved preferences actually match live job listings — try
  broadening keywords/location temporarily to confirm the pipeline works.

---

## Extending

- **Matching logic** lives entirely in `services/matcher.js` — add things
  like job-type or remote-only filters there.
- **More sources**: add a new file under `services/fetchers/`, normalize its
  output to `{ id, source, title, company, location, salaryMin, salaryMax,
  description, url, postedAt }`, and wire it into
  `services/pipeline.js#fetchAllJobsForTerms`.
- **Swap storage**: `services/db.js` is the only file that touches
  persistence — replace it with a real database without touching the rest of
  the app.
