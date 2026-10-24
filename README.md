# ExplainCanvas

Type anything you are stuck on. Understand it visually.

Chat-first visual learning product for any academic subject at any level, from school to research (English and Hinglish). The product thesis, pricing and plan live in [vision.md](./vision.md).

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind 4
- PostgreSQL: DigitalOcean Managed Postgres in production, Homebrew postgresql@17 locally (no Docker). Plain SQL migrations in `db/migrations`
- DigitalOcean Spaces (S3 API) for student photos; a local folder when not configured
- DigitalOcean App Platform: `web` service, `worker` service, `migrate` pre-deploy job (`.do/app.yaml`)
- Own auth: Sign in with Google (OAuth code flow, no SDK), database sessions in an httpOnly cookie; email links kept as a fallback
- Live updates over Server-Sent Events backed by Postgres
- Exact-question cache plus a concept library: the same question is generated once
- Light and dark themes, monochrome design system
- Claude: Opus 5.5 teaches and verifies, Haiku 5.5 routes and grades, Sonnet 5.5 for hard follow-ups
- Dodo Payments (merchant of record, hosted checkout, UPI and cards) for payments; mock provider locally

## Run it locally

```bash
pnpm install
pnpm db:setup                    # native PostgreSQL 17 via Homebrew (no Docker), role + database created
cp .env.example .env.local       # defaults already point at the local database
pnpm migrate                     # applies db/migrations
pnpm dev                         # http://localhost:3000
pnpm worker                      # optional: standalone worker. In dev the app also runs jobs in-process.
```

Sign in at `/login` with Google. Until `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set, the button signs you in as a local test parent (`dev-parent@explaincanvas.local`). Every new account gets 8 free credits, which is one diagram. The email-link sign-in remains available at `POST /api/auth/magic`.

Buy a plan at `/pricing`. Without Dodo keys the checkout uses a mock provider and applies the plan immediately.

`pnpm smoke` runs a question through the real HTTP path against the dev server. `pnpm test:int` runs the ledger and queue tests against the local Postgres.

## Credentials you will need

| Service | What for | Needed when |
| --- | --- | --- |
| DigitalOcean API token | `doctl apps create --spec .do/app.yaml`, managing the app | Deploy |
| DigitalOcean Managed PostgreSQL | `DATABASE_URL` (sslmode=require) and the cluster CA for `DATABASE_CA_CERT` | Deploy |
| DigitalOcean Spaces | `SPACES_KEY`, `SPACES_SECRET`, a private bucket, region `blr1` | Photo uploads in production |
| Google OAuth client id and secret (Web application, redirect URI `/auth/google/callback`) | Sign in with Google | Production sign-in. Without it, locally, the button signs in a test parent |
| Anthropic API key | `ANTHROPIC_API_KEY` for routing, teaching, verifying, follow-ups | Any real generation, local or production |
| Resend API key + verified sending domain | Sign-in emails, later the parent email digest | Production sign-in |
| Dodo API key, webhook signing secret, product ids | Hosted checkout, customer portal and the `/api/billing/webhook` signature | Taking money |
| fal.ai key | Video (Veo), illustrations (Flux or Imagen) and premium ElevenLabs voice through one queue API. Model ids are env config | Video format, pictures in steps and slides, premium narration |
| OpenAI API key | Narration (gpt-4o-mini-tts, the cheapest good voice) and dictation (transcription) | Narration audio and the mic button |
| ElevenLabs API key | Optional premium voice on Pro and Max | Optional |
| Google Gemini API key | Alternative to fal for Imagen and Veo when FAL_KEY is unset | Optional |

## How a question becomes an explanation

```
POST /api/chat
  -> one transaction: user message, empty assistant message, explanations row (queued); job enqueued
worker / in-process runner claims the job
  routing   Haiku 5.5 tags the concept, picks the format, decides explain / solve / follow-up / small talk
  library   a validated lesson for the same concept, class and format is served for 1 credit
  reserve   credits reserved in the ledger before any model work
  teaching  Opus 5.5 writes the scene document (structured output, validated by zod, SVG sanitised)
  verifying Opus 5.5 reviews it as a separate pass; a major issue triggers one revision; a second failure fails the job
  rendering narration (OpenAI by default, ElevenLabs premium on Pro and Max), illustrations and clips (fal, or Google direct) attach when keys are set; diagram, steps, slides, 3D and web animation render client-side in a sandbox
  ready     scene saved, credits settled, usage recorded, lesson stored as a library candidate
  failed    credits released, friendly message written
```

The browser holds one SSE connection per open chat (`/api/chats/:id/events`) and receives message, explanation and chat rows as they change, so a dropped connection or a page reload never loses progress.

## Guarantees worth knowing

- **Idempotent everywhere.** `POST /api/chat` takes a client `requestId`; jobs, ledger entries and webhook events all carry unique keys. Retries never double-charge or double-generate.
- **Credits are a ledger.** Grants are allocated FIFO by expiry; reservations and releases are entries, never mutations. Balance is derived. See the `credits_*` functions in `db/migrations/0001_init.sql`.
- **Queue survives crashes.** `SELECT ... FOR UPDATE SKIP LOCKED` claims, heartbeats, exponential backoff, dead-letter after three attempts, stale-job reaping.
- **Nothing untrusted reaches the browser unchecked.** Model SVG goes through an allowlist sanitiser; all request bodies and model outputs are zod-validated.
- **One database role, ownership checked in code.** Every query that touches a user's rows is scoped by account id in `src/lib/repo.ts`.
- **Sessions are revocable.** The cookie is an opaque id; deleting the row signs the device out.
- **Rate limited.** Per-account limits on chat, uploads, dictation and reports; per-IP on sign-in. Three explanations in flight per account at most.
- **Reports pull lessons.** "Report a mistake" records the report, removes the lesson from the shared library until reviewed, and emails the support address.
- **Deletion is real.** Account deletion cascades to chats, photos, explanations and sessions; payment rows are kept, detached.
- **Retention.** Uploaded photos are deleted after 90 days by a daily job. The database is dumped to Spaces nightly (`deploy/backup.sh`, cron on the Droplet).

## Deploy to DigitalOcean

1. Create a Spaces bucket `explaincanvas-uploads` (private) in `blr1` and a Spaces access key.
2. Push the repo to GitHub and edit `.do/app.yaml` with the repo name.
3. `doctl apps create --spec .do/app.yaml`. The spec provisions a Managed Postgres cluster, runs `pnpm migrate` before every deploy, and starts the `web` and `worker` services.
4. Set the SECRET env values: Spaces key and secret, Anthropic, Resend, Dodo.
5. In Dodo (Developer > Webhooks) add `https://explaincanvas.com/api/billing/webhook`, subscribe to payment.* and subscription.*, and copy its signing secret into `DODO_WEBHOOK_SECRET`.

## Scripts

| Command | What |
| --- | --- |
| `pnpm dev` | Next dev server |
| `pnpm worker` | Job worker with file watching |
| `pnpm db:setup` / `db:start` / `db:stop` | Local Postgres via Homebrew services |
| `pnpm migrate` | Apply pending SQL migrations (`--status` to list) |
| `pnpm test` | Unit tests (schema, pricing, sanitiser, scene building) |
| `pnpm test:int` | Ledger and queue tests against the local Postgres |
| `pnpm smoke` | End-to-end request through the dev server |
| `pnpm grant <email> <n>` | Give an account credits in development |
| `pnpm typecheck` | `tsc --noEmit` |

## Layout

```
src/app            routes and pages (chat, c/[chatId], login, pricing, account, library, api/*)
src/components     Sidebar, TopBar, Composer, ChatView, Player, SandboxFrame, LessonView, CheckoutButton
src/lib/providers  fal, tts, images, video
src/lib/ai         Claude client, router, teach, verify, follow-up, prompts
src/lib/auth       sessions, magic links, mail
src/lib/scene      the scene document schema (the one format every renderer reads)
src/lib/pipeline   the explanation pipeline
src/lib/queue      job queue client, handlers, in-process runner
src/lib/credits    ledger wrapper
src/lib/billing    plans, Dodo adapter, fulfilment, subscriptions
src/lib/repo.ts    every SQL query, grouped by table
src/lib/db.ts      pg pool, query helpers, transactions
src/lib/storage.ts Spaces / local storage
src/worker         standalone worker entry
db/migrations      SQL migrations
scripts            migrate, smoke, grant
.do/app.yaml       App Platform spec
tests              vitest
```

## Admin dashboard

`/admin` is visible only to emails in `ADMIN_EMAILS` (comma-separated). It shows users, explanations, library hit rate, provider cost vs credits used, generation time (p50/p90), failures by code, queue depth, dead jobs (retry button), open mistake reports (republish / retire / dismiss) and the last 40 explanations with cost and timing. Actions go through `POST /api/admin`.

## Student-facing extras

- **Keep going** chips: every explanation ends with three follow-up questions the model wrote; one tap asks it.
- **Share**: `/api/share` mints a stable token; `/s/<token>` is a read-only public page (noindex) with a "Start free" path.
- **Installable**: `manifest.ts` lets students add it to the home screen as a full-screen app.
- **Class-aware suggestions** on the empty state; keyboard: `/` focuses the composer, `Cmd/Ctrl+K` starts a new chat.

## Lifecycle emails

All through Resend (`src/lib/lifecycle.ts`, templates in `src/lib/email/templates.ts`), every send keyed in `email_log` so nothing double-sends:

| Email | When | Respects |
| --- | --- | --- |
| Welcome | one minute after first sign-in | tips and offers |
| Tips (3 emails) | days 3, 6 and 9 after sign-up | tips and offers |
| Win-back, 50 credits | after 10 quiet days; at most once per 30 days, twice ever | tips and offers |
| Streak at risk | 18:00–22:00 IST when a 2+ day streak has not been extended | daily report |
| Weekly recap | Sunday evening for accounts active that week | daily report |

The hourly `lifecycle.sweep` job (scheduled by the worker) decides who is due and enqueues `email.send` jobs. Win-back links go to `/claim/<token>`, which grants the credits to the signed-in owner (promo bucket, 30-day expiry) and sends them into the chat. Every tips email carries a one-click unsubscribe (`/api/email/unsubscribe?t=`); both preferences are switches on the Account page.

## Payments (Dodo)

Checkout: `POST /api/billing/checkout` records a `payments` row and returns a hosted Dodo checkout URL (metadata carries our payment id). Webhooks (`POST /api/billing/webhook`, Standard Webhooks signature, idempotent per `webhook-id`):

| Event | What we do |
| --- | --- |
| `payment.succeeded` | mark the payment paid; packs grant credits immediately |
| `subscription.active` | create the subscription (period from Dodo's billing dates) and grant the first month |
| `subscription.renewed` | extend `period_end`, grant the next month (keyed on the renewal payment, replay-safe) |
| `subscription.past_due` | keep access until `past_due_ends_at` |
| `subscription.cancelled` | access until period end if cancel-at-period-end, else ends now |
| `subscription.on_hold/paused/expired/failed` | expire locally |
| `subscription.plan_changed` | switch plan code |

Monthly Dodo plans are granted only by renewals; the hourly billing job grants monthly credits on annual plans. `POST /api/billing/portal` returns a customer-portal link (cancel, card, invoices). Prices are GST-inclusive because Dodo is merchant of record. Local dev without keys uses a mock provider; `tests/dodo.test.ts` covers signature verification.

## NCERT mapping, photos, Hinglish, safety

- **NCERT mapping.** `src/lib/ncert.ts` holds the chapter index (Curiosity books for 6 to 8, rationalised 9 to 10). The router picks `ncertChapter` from the student's class index; "Ex 4.2 Q3" references are parsed from the question. Stored on `explanations.ncert_chapter/ncert_ref` and `library_lessons.ncert_chapter`, shown as "Class 9 · Ch 4 Structure of the Atom · Ex 4.2 Q3" on the player, lesson and share pages. Every chapter has a page at `/learn/<class-subject>/chapter-<n>-<name>`.
- **Whole-page photos.** When a photo arrives with little or no text, `src/lib/ai/pagereader.ts` (Haiku vision) lists the questions on the page. One question: it is used directly. Several: the assistant replies with tappable options (stored as an `options` attachment on the message); tapping sends the question with the photo again. Unsafe images are refused and logged.
- **Hinglish.** `language` on `/api/chat` (`english` default) flows through `hints.language` to teach, verify and follow-ups. Hinglish explanations skip the shared library and the question cache is keyed by language. The composer has an English / Hinglish switch; every explanation has "Hinglish mein samjhao" and "Explain it simpler" one-tap buttons (both are fresh explanations of the same concept).
- **WhatsApp share** on the player, share page and library lessons (`wa.me` links).
- **Parent emails.** Daily report at `PARENT_REPORT_HOUR_IST` on study days (with chapter names and struggled concepts); a check-in with one suggested question after two quiet days, at most every second day; Sunday recap with understood, struggled, weak chapters and suggestions; streak reminders.
- **Safety.** `src/lib/safety.ts`: local profanity screen (English and Hinglish spellings, leetspeak and spacing tricks) on chat text, student names and chat titles; router `unsafe` intent and page-reader `unsafe` flag; age-appropriate rules in the teaching prompts; every event in `safety_events` (admin shows counts, log and per-user flags); five events in 24 hours pauses questions for a day.
- **Generation feed.** `GenerationFeed.tsx` shows stage, rotating detail lines, elapsed time and an estimate while an explanation is made.
- **Schema size.** Anthropic rejects structured-output grammars above a size limit. The teach schema is at that limit: do not add fields to `TeachOutput`; put new small outputs on the router or verify schemas (follow-ups live on verify for this reason).

## Spend ceiling

`MONTHLY_BUDGET_INR` (default 25,000) caps provider spend per calendar month in IST. `src/lib/budget.ts` sums `usage_events`, which now includes narration, images and video at the unit prices in `COST_*` env vars, not just model calls. At 70% of the ceiling free accounts lose fresh generations (library, follow-ups and photos still work); at 105% every fresh generation pauses until the 1st. Paid plans keep going in between because they earn more than they cost. The admin dashboard shows spend, the month-end projection and the current status.

Cost levers already applied: teaching and verification run on Sonnet 5.5 (`TEACHING_MODEL`, `VERIFY_MODEL`), Opus only on the revision pass (`TEACHING_RETRY_MODEL`); free accounts get no narration; the win-back gift is 16 credits once for never-paid accounts and 50 for past payers.
