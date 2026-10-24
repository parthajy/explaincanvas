# Vision

Product name: **ExplainCanvas**.

Tagline: **Type anything you are stuck on. Understand it visually.**

## What this is

A chat-first learning product for Indian school students, English only. The student types or photographs what they are stuck on. The system decides how to explain it (labelled diagram, numbered steps, narrated slides, animation, interactive 3D, or generated video), produces it in under a minute, asks one check question, and emails the parent that evening what was understood. Every validated explanation becomes a library asset, so the second student who asks costs 50 paise instead of ₹24.

Internal framing: BYJU'S with the cost structure inverted. Keep the parent as payer and the daily habit. Drop the sales army and the pre-built content library. Demand creates content, content becomes an asset, repeat demand is nearly free to serve.

Full business plan, model stack, unit economics and 18-month model: <https://claude.ai/artifact/1RYTxidR6jKBouWuNKEZDi>

## Fixed decisions

- **English only.** No vernacular generation or interface.
- **Chat first.** The chat is the only entry point. The visual player sits inside the chat. History in the left rail. Nothing else on the home screen.
- **Classes 6 to 10, Maths and Science, CBSE first.** Curriculum metadata underneath, no separate school or teacher module.
- **The router decides the format**, never the student. Correct and cheap beats cinematic.
- **In v1:** diagram, photo annotation, numbered steps, narrated slides, animation, interactive 3D, generative video. **Not in v1:** live tutors, leaderboards, test series, other languages, school dashboards.
- **60% gross margin per paid user is the floor.** Credits meter every output at roughly 1 credit per ₹1 of our cost; plans sell credits at ₹2.00 to ₹2.40.
- **Free never touches an expensive renderer.** Library is free. One diagram per verified account. Streak credits spend on library and follow-ups only.
- **Parent proof of learning is a day-one feature**, not a later one.
- **The agents are the operating team.** Evaluator, curator, developer, QA and growth analyst run from day one. No agent publishes or spends without approval until it has a clean 30-day record. No agent touches money.

## The three promises

1. Ask anything you are stuck on. Type it or photograph it.
2. See it the way it makes sense. The system picks the format.
3. Keep going until you understand. One check question after every explanation. Fail it and the system re-explains differently. Pass it and the parent hears about it that evening.

## Pricing

Credits are the billing unit. The credit cost is shown before every generation.

| Output | Credits | Our cost |
| --- | --- | --- |
| Library lesson | 1 | ₹0.50 |
| Follow-up question | 2 | ₹1.50 |
| Labelled diagram | 8 | ₹8 |
| Photo annotation | 10 | ₹10 |
| Interactive 3D | 20 | ₹20 |
| Narrated slides | 24 | ₹24 |
| Illustrated steps | 26 | ₹26 |
| Animation | 32 | ₹32 |
| Generative video | 65 | ₹65 |

Plans, ex-GST:

| Plan | Price | Credits | Includes |
| --- | --- | --- | --- |
| Free | ₹0 | Library only, 1 diagram, 1 streak credit a day | Parent report off |
| Student | ₹599 / month | 250 a month | 1 student profile, daily parent report by email, 1 month rollover |
| Pro | ₹1,999 / month | 900 a month | 2 student profiles, priority rendering, premium narration |
| Max | ₹4,999 / month | 2,500 a month | 4 student profiles, priority rendering, Veo Fast video, premium narration |
| Max Annual | ₹50,000 / year | 2,500 a month | Everything in Max, two months free |

Top-ups, like Claude's extra usage. Subscribers only. Never expire while subscribed. Optional auto top-up with a monthly cap the parent sets.

| Pack | Price | Credits |
| --- | --- | --- |
| Small | ₹199 | 80 |
| Medium | ₹499 | 220 |
| Large | ₹999 | 480 |

GST at 18% is added at checkout and shown before payment.

## Model stack

| Stage | Model or renderer |
| --- | --- |
| Routing, syllabus tagging, library lookup, grading | Claude Haiku 5.5 |
| Teaching script, scene plan, separate accuracy pass | Claude Opus 5.5, syllabus context prompt-cached |
| Follow-ups, re-explanations | Haiku 5.5, escalating to Sonnet 5.5 |
| Diagrams | LLM-written SVG, sanitised, rendered in the browser |
| Animation | Model-written web animation (SVG or canvas) run in a sandboxed frame; Manim or Remotion rendering to MP4 later |
| Interactive 3D | Three.js scene code, validated headless before it ships |
| Illustrations | Flux or Imagen through fal.ai (Google direct as fallback) |
| Narration | OpenAI gpt-4o-mini-tts by default; ElevenLabs premium voice on Pro and Max |
| Dictation | OpenAI transcription, mic button in the composer |
| Generated video | Veo 3.1 Lite through fal.ai; Veo 3.1 Fast on Max |

If Sonnet 5.5 passes the 100-question accuracy benchmark for the teaching pass, move it there and bank the margin.

## Infrastructure

Everything runs on DigitalOcean: App Platform for the web and worker services, Managed PostgreSQL 16, Spaces for student photos, all in the Bangalore region. Auth is our own (email sign-in links, database sessions). Live updates are Server-Sent Events backed by Postgres. No third-party backend-as-a-service.

## Architecture principles

- **One scene document.** Every explanation is a versioned JSON document: script, scenes, assets, narration, check question. Renderers are swappable. The library stores the document and its assets, not just an output file.
- **The pipeline is durable.** Every generation is a job row in Postgres with an idempotency key, a state machine, retries with backoff, and a dead-letter state. The UI streams progress; the job survives a dropped connection.
- **Credits are a ledger.** Append-only entries. Reserve before work, settle or release after, all inside one database transaction, all idempotent on the request id. Balance is derived, never stored as a mutable number.
- **Validate at every boundary.** Zod on environment, request bodies, model outputs, scene documents, webhook payloads.
- **Accuracy is a separate pass.** A second model call with the syllabus source and the scene plan, asked only to find errors. Failed scenes regenerate before anything renders.
- **Fallbacks on.** Server-side refusal fallback on every Claude call so a safety decline never fails a student.
- **Private by default.** A generation is private until the curator promotes it. Promotion strips personal content from uploads. Children's data follows the DPDP Act.

## Milestones

- 17 Nov 2026: benchmark run 1, 100 questions. Continue at 90% accurate, 80% format suitable, under ₹30 a generation.
- 15 Dec 2026: private beta, 50 students.
- 18 Jan 2027: public launch.
- 25 Jan 2027: kill or continue review.

## UI references

- Chat home: "Ready when you are." with one large composer (type, dictate, photo), suggestion chips; after the first message the composer sits at the bottom. Left rail: New chat, Library, Progress, history grouped by day. Monochrome, light and dark.
- Visual player: full width inside the assistant turn. Scenes play in sequence. Check question after the last scene. "I didn't get it" with four reasons.
- Pricing: four cards, credits per month and what that buys in plain words, GST shown.
- Everything minimal and monochrome: black, white, greys, one quiet accent for status. Landing page is dark with large type; the app has a light and dark toggle.
