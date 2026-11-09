# Student Academic Resource Sharing Platform

This repository contains a MERN starter with independent `frontend` and
`backend` workspaces. It includes a Vite/React UI, Tailwind CSS, an Express API,
MongoDB/Mongoose, student and admin authentication, Nodemailer email
notifications, password recovery, and private handwritten-note upload and OCR
workflows.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- MongoDB running locally, or a MongoDB connection string

## Run locally

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `MONGODB_URI` if needed and generate a private `JWT_SECRET` of at least
   32 characters (for example, `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
3. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
   `SMTP_PASSWORD`, and `EMAIL_FROM` in `backend/.env` for email notifications.
   Gmail defaults to `smtp.gmail.com:587` with STARTTLS; use a Google App
   Password for `SMTP_PASSWORD`. Run
   `npm run test-email --workspace=backend` to test SMTP connectivity without
   sending an email.
4. Copy `frontend/.env.example` to `frontend/.env` if the API is not at
   `http://localhost:5000/api`.
5. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
   `CLOUDINARY_API_SECRET` in `backend/.env` to enable private note uploads.
6. Configure `OPENAI_API_KEY` for vision OCR, and set `OCR_ENCRYPTION_KEY` to a
   new random 32-byte base64 or 64-character hexadecimal key. Generate a base64
   key with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
7. Set `MIN_VERIFIABLE_STATEMENTS` if the default minimum of five should change.
8. Run `npm install` from the repository root.
9. Run `npm run dev` to start the API and frontend together.

The frontend is served by Vite at `http://localhost:5173`. The API listens at
`http://localhost:5000`; its `GET /api/health` endpoint reports server and
database readiness. Use `npm run build` to build the frontend.

## Authentication

- Students register at `/register` with their academic profile. Student
  registration is the only public registration path; it never accepts a role.
- User roles are stored in MongoDB as `user` or `admin`; new accounts default
  to `user`, and registration/profile requests cannot set a role. On database
  connection, existing `student` role values are migrated to `user` without
  deleting accounts. To promote an account manually, change its `role` to
  `admin` in MongoDB Atlas or Compass. Admin authorization reloads the current
  database role for every protected API request, so changing a role takes
  effect immediately on the backend; reload or sign in again to refresh the
  frontend session view.
- Registered users have a unique public username and profile at
  `/profile/:username`. Public profiles show academic details and approved
  contributions only; email and password are never included. Profile changes
  use authenticated `PATCH /api/profiles/me` and cannot change roles. Existing
  accounts are assigned usernames when MongoDB connects. Profiles use initials
  when no photo is set. Owners may upload a JPG, PNG, or WebP profile photo
  (maximum 5 MB) through the same authenticated profile update endpoint; images
  are stored in the configured Cloudinary account.
- Email verification is optional and is not required to register or sign in.
- `/login` is for students; `/admin/login` is for provisioned administrators.
- Authenticated sessions use a signed JWT in an HttpOnly, SameSite cookie.
  Passwords are bcrypt-hashed. Optional verification and password-reset links
  are single-use, hashed in MongoDB, and expire after one hour. Transactional
  email is sent by the backend Nodemailer service.
- Provision an initial admin by temporarily setting `ADMIN_NAME`, `ADMIN_EMAIL`,
  and `ADMIN_PASSWORD` in `backend/.env`, then running
  `npm run create-admin --workspace=backend`. The command refuses to change an
  existing account's role. Remove the `ADMIN_*` values afterward.
- Auth endpoints are under `/api/auth`: `POST /register`, `/login`,
  `/admin/login`, `/logout`, `/verify-email`, `/resend-verification`,
  `/forgot-password`, and `/reset-password`; `GET /me` returns the signed-in
  user. Admin-only API routes use the `requireRole("admin")` middleware.
- Set `FRONTEND_URL` to the public frontend origin for email links and
  `CORS_ORIGIN` to the exact allowed browser origin. Set `NODE_ENV=production`
  when deployed so auth cookies use the `Secure` flag. Keep `.env` files and
  secrets out of source control.

## Student dashboard data

- `GET /api/dashboard` requires an authenticated student session and returns the
  current MongoDB profile, contribution counts, saved resources, and
  recent activity. Counts are aggregated from `Resource` documents owned by
  that student; there are no seeded or placeholder statistics.
- Resource records use `type` (`note`, `pyq`, or `other`), `status`
  (`pending`, `approved`, or `rejected`), `uploadedBy`, and `pointsAwarded`.
  Contributor points count only points on eligible contributions. A future upload
  and moderation workflow should create/update these resource records.
- `PATCH /api/dashboard/profile` updates editable student profile fields.
  Profile pictures are currently stored as validated HTTP(S) image URLs.
- `POST` and `DELETE /api/dashboard/saved-resources/:resourceId` save or remove
  published resource references. Profile edits and saved-resource changes are
  recorded in the MongoDB activity collection.

## Handwritten note uploads

- Students can upload PDF, JPG/JPEG, and PNG notes (maximum 10 MB) from
  `/upload` or their dashboard. The upload form captures title, description, department, batch,
  semester, subject, unit, and topic; department, batch, and semester default
  to the student's profile.
- `POST /api/notes` accepts multipart form data with a `file` field and the
  note metadata. `GET /api/notes` lists only the signed-in student's notes,
  and `DELETE /api/notes/:noteId` deletes only that student's note. Published
  files are viewed through the authenticated in-app resource viewer.
- Files are signature-checked and stored as authenticated Cloudinary assets.
  After the resource is saved, the backend sends the uploader an email
  confirmation through Nodemailer. Email delivery failures are logged and do
  not undo or fail a successful upload.
  Each upload creates a publicly visible `Note` immediately and a
  `NoteVerificationJob` of type `ai_handwritten_note` in the durable queued
  state. OCR and academic verification run independently of publication; the
  actual verification decision is retained and never changed to make the note
  public.
- A separate MongoDB-backed OCR worker splits PDFs into individual pages and
  sends each page (or each uploaded image) to the OpenAI Responses vision API.
  It stores each page number, transcription, formulas, readability,
  confidence, and unclear regions in an AES-256-GCM encrypted MongoDB result.
  `GET /api/notes/:noteId/ocr` returns the decrypted structured result only to
  the note owner. OCR retries failures up to three times, records processing
  state, and never treats unclear handwriting as incorrect. Set
  `OPENAI_OCR_MODEL` to choose another compatible vision model; OCR is not
  available until both the provider key and encryption key are configured.
- The worker then checks definitions, formulas, calculations, factual claims,
  explanations, contradictions, materially missing calculation steps, and
  subject relevance using the separate academic verification service and
  OpenAI web search. `ACADEMIC_REFERENCE_DOMAINS` controls allowed academic
  reference domains; `OPENAI_VERIFICATION_MODEL` selects the review model.
  Every finding includes the original statement, page, category, explanation,
  suggested correction, confidence, and cited verification evidence. A
  finding is `CONFIRMED_ERROR` only when its statement matches the OCR and it
  has a cited reference; unsupported or unclear findings remain `UNCERTAIN`.
  Results are encrypted separately in MongoDB and are available only to the
  owner at `GET /api/notes/:noteId/verification`. Review never edits notes or
  publishes them.
- Automatic decisions use only confirmed-error counts divided by the number
  of verifiable statements. Up to and including 5% is `APPROVED`; above 5%
  through 10% is `APPROVED_WITH_WARNING`; above 10% is `REJECTED`. Uncertain
  claims never count as errors. Unreadable pages contribute no verifiable
  statements; unreliable reviews and notes with fewer than
  `MIN_VERIFIABLE_STATEMENTS` are sent to `NEEDS_HUMAN_REVIEW`. No confidence
  score is used in the mistake-percentage calculation or approval thresholds.
- OCR and AI verification outcomes do not gate publication. Authenticated
  students can discover uploaded notes at `GET /api/notes/published`; failed
  OCR or a negative AI result remains visible as an accurate status to the
  uploader.
  Students receive a direct Nodemailer email decision after verification;
  email delivery failures are logged and do not undo the decision. Owners can
  resubmit a corrected file for a rejected note at
  `POST /api/notes/:noteId/resubmissions`; this creates a new revision
  and restarts OCR and verification. Original versions remain unchanged.
  Encrypted decision reports and revision history are available from the
  owner's verification endpoint and dashboard.

## Previous year question papers

- `/pyqs` provides public, free browsing and filtering by semester, subject,
  and examination year. Uploading, bookmarking, and
  reporting require an authenticated student session.
- Students upload papers from `/upload` or `/pyqs` with university, college,
  department, course, semester, subject, examination year, exam type, title,
  description, and a PDF/JPG/JPEG/PNG file (maximum 20 MB). Files are
  signature-checked and stored as authenticated Cloudinary assets using the
  existing Cloudinary configuration. Each paper records its original uploader
  and is published immediately. Authenticated students view papers in-app;
  permanent storage URLs are not returned by APIs.
- After MongoDB saves a paper, the backend sends the uploader a confirmation
  email through Nodemailer. Email delivery failures do not undo or fail the
  successful upload.
- The dedicated `/upload` form also accepts question-paper PDFs and images.
  Students can review uploaded notes and PYQs, including OCR/AI status,
  in the **My uploads** section of `/library`.
- The API includes `GET /api/pyqs`,
  `POST /api/pyqs`, `GET /api/pyqs/bookmarks`,
  `POST`/`DELETE /api/pyqs/:pyqId/bookmark`, and
  `POST /api/pyqs/:pyqId/reports`. Reports can flag incorrect or duplicate
  published papers. A student can submit one report per paper.
- No payment or subscription is required to browse papers.

## Academic resource search

- `/search` searches all published notes and PYQs, regardless of OCR or AI
  verification outcomes.
- Search supports subjects, topics, units, and full-text resource details,
  with filters for department, university, college, batch, semester, subject,
  unit, topic, and resource type. Suggestions are debounced in the interface;
  results support pagination and sorting by recent uploads or student helpful
  votes.
- Search normalizes spacing and word forms, tolerates one-edit spelling errors
  and partial words, and ranks exact, close, partial, then local semantic-alias
  matches. Notes are indexed from their metadata and encrypted OCR transcript;
  OCR stays encrypted at rest. Search candidates are retrieved through bounded
  MongoDB n-gram queries, and no external AI call is made for search keystrokes.
- `GET /api/search` accepts `q`, the academic filters, `resourceType` (`note`
  or `pyq`), `sort` (`recent` or `helpful`), `page`, and `limit`.
  `GET /api/search/suggestions?q=...` returns published subject, topic, unit,
  and title suggestions. Verified students can mark a resource helpful once
  with `POST /api/search/:resourceType/:resourceId/helpful`.
- MongoDB indexes support published-resource filters, academic facets,
  recent/helpful ordering, and fuzzy-search n-grams. Existing note OCR and
  resource metadata are indexed in batches on database startup.

## AI syllabus analysis

- Verified students can upload a PDF, JPG/JPEG, or PNG syllabus (up to 10 MB)
  at `/syllabus`. PDFs are limited to 50 pages. Text-based PDF pages are
  extracted directly; sparse, scanned, or image-containing pages and uploaded
  images use the configured OpenAI vision model. Every page is accounted for.
- The backend organizes source-listed course, semester, subjects, codes, unit
  numbers, topics, and subtopics in bounded text chunks. OCR text and the
  outline are encrypted in MongoDB with `OCR_ENCRYPTION_KEY`; records are
  accessible only to the uploading student. The original syllabus file is not
  retained. Exact duplicate uploads by the same student reuse their existing
  analysis, while failed analyses may be retried.
- Students can review, add, remove, and correct extracted outline entries.
  Students can regenerate the outline from the stored, encrypted OCR text or
  copy the reviewed topics. Resource matching is not run until the
  student saves corrections and confirms the syllabus.
- Matching queries use published notes, including their encrypted OCR text,
  and relevant PYQs. Fuzzy topic matching uses note titles, descriptions,
  academic metadata, OCR text, and PYQ titles/descriptions. PYQs without
  topic-specific metadata remain subject-level matches. Missing-topic states
  come from actual database records; no placeholder resources are generated.
- APIs under `/api/syllabus-analyses` provide upload, owner-scoped list/detail,
  correction, source-grounded regeneration, and confirmation/resource matching.
  Configure `OPENAI_API_KEY` and `OCR_ENCRYPTION_KEY`;
  `OPENAI_SYLLABUS_MODEL` selects the model and defaults to `OPENAI_OCR_MODEL`
  or `gpt-4.1-mini`.

## Community note fact-checking

- Every published note in `/search` offers **Report mistake**. A verified
  student selects a page and category (incorrect definition, wrong formula,
  incorrect calculation, missing explanation, poor handwriting readability,
  or duplicate content), explains the issue, and can suggest a correction.
- `POST /api/notes/:noteId/reports` accepts `pageNumber`, `category`,
  `explanation`, and optional `suggestedCorrection`. Reports are accepted only
  for published notes. A student cannot report their own note;
  repeat reports for the same page and category are prevented.
- The original uploader receives an email notification and can respond from
  the dashboard. The reporting student and uploader can see the report and its
  correction history at `GET /api/notes/reports`; uploader responses use
  `POST /api/notes/reports/:reportId/response`.
- Administrators review open reports at `GET /api/notes/reports/review` and
  confirm or dismiss them with
  `PATCH /api/notes/reports/:reportId/review`. Status changes, responses, and
  review notes are retained in the report's correction history. Email
  notifications are sent directly through Nodemailer after each operation is
  saved; email failures are logged without undoing the saved operation.
- Submitting a report does not modify a note, approval decision, or contributor
  points. No contributor-point adjustment is made by this workflow after
  review either; confirming a report only records the reviewed outcome and
  notifies the involved students. The uploaded original remains unchanged.

## Student library

- Verified students can save published notes and PYQs to
  `GET /api/library?section=saved`. Bookmarks use the `Bookmark` MongoDB model
  and can be organized into named folders; the default folder is `Saved`.
- Create a bookmark with `POST /api/library/bookmarks` and JSON fields
  `resourceType` (`note` or `pyq`), `resourceId`, and optional `folder`.
  Move/organize it with `PATCH /api/library/bookmarks/:bookmarkId` and
  `{ "folder": "..." }`. Remove it with
  `DELETE /api/library/bookmarks/:bookmarkId` or
  `DELETE /api/library/bookmarks/:resourceType/:resourceId`.
- `/library` shows saved and recently accessed resources. View metadata is
  recorded per student and resource in MongoDB when they open a published
  note or PYQ. Removed or unpublished
  resources no longer appear in library results.
- `GET /api/search/resources/:resourceType/:resourceId/view` requires an
  authenticated student or admin and streams the private storage asset through
  the backend. The in-app PDF/image viewer has no download or print controls;
  browser viewing cannot prevent screenshots or all copying.
- Every resource remains free. The library adds no purchase, premium, or
  payment routes or gating.

## Contributor rewards

- Students can review point balances, contribution records, reward transactions,
  the points schedule, available platform points, and the contributor
  leaderboard in their dashboard. APIs are `GET /api/rewards/me` and
  `GET /api/rewards/leaderboard`; both require an authenticated student session.
  Student and admin history APIs accept a `page` query parameter for older
  transaction and contribution records.
- Points are credited after the applicable contribution event:
  AI-approved handwritten notes, successfully uploaded and published PYQs,
  administrator-confirmed academic corrections (the report author receives
  credit), and optional administrator-designated high-quality resources.
  Reports about readability or duplicate content do not qualify as academic
  corrections. Ad clicks, impressions, downloads, bookmarks, and visits never
  earn points.
- The default transparent schedule is 10 points per AI-approved handwritten note,
  8 per published PYQ, 5 per confirmed correction, and 15 for a high-quality
  resource bonus. Configure these values with the `REWARD_POINTS_*` variables.
  Admins can add or deduct up to 1,000 points per adjustment with a required
  reason; every change records its actor, reason, balance, and budget change.
- A finite point pool is initialized from `REWARD_BUDGET_POINTS` (default
  10,000) when the platform reward budget is first created. Rewards use an
  atomic available-budget check; if the pool is exhausted, a contribution is
  recorded without points. Admin point deductions return points to the
  available pool. Admins can designate a high-quality bonus only for an
  published note or PYQ, with a recorded review reason.
- Administrators can review the budget, contributions, and distribution
  history in the admin dashboard. API routes under `/api/rewards/admin`
  provide `GET /overview`, `POST /adjust` (student email, signed points, and
  reason), and `POST /quality-bonus` (published resource type/id and reason).
  The `Contribution`, `RewardAccount`, `RewardBudget`, and
  `RewardTransaction` records preserve the contribution and point history.
- Points do not unlock or purchase any resource. Notes and PYQs remain free;
  there are no paid notes, subscriptions, payment processing, or cash
  withdrawals. No cash-out feature is provided; any future payment or
  withdrawal feature requires a separate legal, tax, and platform review.

## Structure

```text
frontend/
  src/
    components/       Reusable UI, auth forms, rewards, and dashboard components
    context/          Cookie-backed authentication state
    lib/              Centralized API client
    pages/            Login, registration, recovery, dashboard, PYQ, search, library, and syllabus screens
    App.jsx           Landing page and client-side routes
    index.css         Tailwind directives and global styles
    main.jsx          React entry point
  index.html          Vite HTML entry
  vite.config.js      Vite and React plugin configuration
  tailwind.config.js  Tailwind content paths and theme
  postcss.config.js   Tailwind/Autoprefixer processing
  .env.example        Frontend environment variable example
backend/
  src/
    config/           Environment and database configuration
    controllers/      Authentication, dashboard, note-upload, syllabus, and health handlers
    middleware/       Authentication, authorization, and error handling
    models/           User, resource, note, syllabus, rewards, verification, OCR, notification, and activity models
    routes/           Auth, dashboard, note, syllabus, rewards, and health API routes
    scripts/          Admin provisioning command
    services/         Email, auth, secure storage, OCR, AI verification, and academic review services
    app.js            Express middleware and route setup
    server.js         Database connection and HTTP startup
  .env.example        Backend environment variable example
```
