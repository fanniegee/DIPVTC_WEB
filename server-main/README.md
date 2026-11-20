# DIPVTC main website and server

The root website files are the source. `npm run build:site` copies them into `server-main/public`, excluding the included marking-engine bundle and server/database source. Node serves the generated site and its API from `http://127.0.0.1:3000`.

## Local setup

1. Install Node.js 20 or newer and PostgreSQL.
2. Create a PostgreSQL database named `dipvtc` (or choose another name).
3. Copy `.env.example` to `.env`. Set `DATABASE_URL` to the local database and enter an owner email and a private password of at least 10 characters in `INITIAL_OWNER_EMAIL`, `INITIAL_OWNER_NAME` and `INITIAL_OWNER_PASSWORD`. Optionally configure an administrator account with the `INITIAL_ADMIN_*` fields.
4. Apply the numbered migrations in order. The current schema reaches `database/009_zimsec_teacher_class_assignments.sql`.
5. Run `npm install`, `npm run build:site`, then `npm start` from the website root.
6. Open `http://127.0.0.1:3000`. Staff Login leads to the shared staff dashboard. Admin / Owner Login routes each account to its matching dashboard. The Owner page's Main Admin button opens Admin.

Passwords are hashed with scrypt and are never stored in browser storage. The session is stored server-side and the browser receives an HTTP-only, same-site cookie.

Owner invitations send a one-time activation email that expires after seven days. Set EMAIL_TRANSPORT=resend with RESEND_API_KEY, EMAIL_FROM_ADDRESS and EMAIL_FROM_NAME in the Render service environment to send over HTTPS on Render Free. For local use or a later paid Render instance, set EMAIL_TRANSPORT=smtp and use the existing SMTP_* settings. Keep credentials in the local .env or Render environment settings; never commit them. Staff set their own password from the email invitation and use the shared Staff dashboard. Built-in roles include Principal, Teacher / Tutor / Lecturer, Admissions Officer, Finance / Fees Officer, Content Manager and Front Desk; custom Owner-defined roles enter the shared dashboard with task-only access until permissions are configured.

After editing website source files in the root, run `npm run build:site` again.

The homepage welcome card and each Study Pathway card load image slides only from their own folders under `assets/home-welcome-slides/` and `assets/pathway-slides/{cambridge,zimsec,technical,vocational}/`. Add image filenames to each folder's `slides.json`; the default interval is seven seconds. The Owner dashboard includes a Fees Audit Engine button that opens the owner-protected `/fees.html` page.

## What is server-backed in this phase

- `index.html` loads the editable public page content from PostgreSQL and submits enquiries to the server.
- `owner.html` reads/writes its supported website-management state through the authenticated, owner-only API.
- `admin.html` is the Owner/Admin campus operations station. It reviews staff accounts, Owner/Admin task assignments, overdue and completed work, completion notes, recent server audit activity, learner counts, pending admissions and daily attendance. Owner is excluded from the staff and task-recipient lists and cannot be assigned tasks. Owner may assign tasks to the Main Admin; Main Admin may assign tasks to active staff or management accounts. New campus tasks require a completion note before closure. Main Admin can send staff invitations, as can Owner. A staff member’s invited position remains fixed; Owner and Main Admin can separately assign one or more existing Owner-listed responsibilities. Those extra responsibilities grant the matching staff workspace and server permissions without changing the position. Configured subjects can also be assigned to active teachers. Subject and responsibility assignments are shared with the Owner dashboard and staff workspace and are audit logged. The staff list and tasks still load if optional overview KPI data is unavailable.
- `staff.html` is the shared, Montserrat-based dashboard for Principal, Teacher / Tutor / Lecturer, Admissions Officer, Finance / Fees Officer, Content Manager and Front Desk accounts. Each built-in role receives a focused classic workspace. Additional assigned responsibilities add their corresponding views and server-scoped permissions while the account’s primary position stays the same. All staff can view and complete their own assigned tasks. New campus-admin tasks require a completion note, which is visible to Owner/Admin.
- Teachers open the authenticated end-of-term Exam Mark-Entry workspace from the Staff dashboard. It is a server-backed copy of the Local Edition interface, including examination setup, learners, attendance, mark entry, report books, reports, rankings, awards and backup/restore. Its records are stored in PostgreSQL under `dipvtc_marking_engine_v1` and shared between teacher accounts.
- Teachers also have a separate read-only Class Results view over the normalized academic tables; the Principal has a school-wide view of those records. Both use the shared marking-calculation module. This is for review, while end-of-term entry is in Exam Mark-Entry. The two sets of records are not yet synchronized.
- Teacher Learning is now extended with a task builder for daily exercises, weekend assignments, fortnight revision tests, monthly revision tests and other work. Teachers can publish multiple-choice or structured-response tasks with due/open times, timers, HTTPS image/video/audio materials, per-question marks and red correction notes, plus a handwritten-style overall comment. They can review pending student return requests, exchange text messages with families through the school portal and submit weekly/monthly/term class performance reports. Owners, Admins and Principals can inspect the reports and task activity from the learning workspace. Student and Parent portals show published work; students submit and review their own answers, while parents have read-only views of marked work. Students can compare class totals and rank by school ID only. Marking and portal messages are recorded in the audit log.
- The Finance / Fees Officer can open the existing Fees Audit Engine at `/fees.html` or `/fees.htm`. Its five `di_*` data stores save through the authenticated server storage layer, and the Owner can also access the fee page.
- `activate.html` validates one-time Owner invitations and creates staff accounts.
- The public Student Registration page collects student health conditions, allergies and doctor / clinic details when relevant, creates a locked student account and an application, and assigns its sequential student number. Admissions reviews and approves or rejects it. Approval enrolls the learner, activates the same email/password account for the Student Portal, and sends a notice. Parent/guardian details can be included so the parent can be linked or invited after approval.
- Manual Admissions lets staff enroll campus walk-ins across the six school/program choices. New learner IDs use the next available `DIP-YYYY-NNN` number. Online applicants receive an ID on submission, retained if Admissions approves them. Student email may be omitted for a campus record; that learner has no individual student portal login until a student email and account are added.
- The compatibility storage layer used by these pages holds a session copy in memory and queues writes to the API; it does not write to browser `localStorage`.
- Student health details are available to authorised Owner/Admin/Admissions staff and to the linked parent account for that learner. Parents can review and update missing contact and health details from the Parent Portal; student portal responses exclude health details. Server-side role checks, role-scoped state access, invitation validation, rate limits and audit rows are applied.

The `dipvtc_enquiries` compatibility list is synchronized with `website_enquiries`. The original Local Edition files under `assets/DIPvtC-MARK-ENGINE-v4.1.0-local-test-ready` remain unchanged as reference. The server serves a copy under `exam-mark-entry/`, with its storage changed to the authenticated server adapter.

## Public information assistant

The public visitor assistant combines the centrally maintained `server-main/assistant-knowledge.json` guidance with relevant published website pages and current public settings from PostgreSQL. Keep stable rules and process guidance in that JSON file; keep changing fees, dates, contacts and programme details in the existing published settings/pages. The assistant reads the central file for each answer, selects matching topic entries, and does not crawl the whole website.

Assistant request limits are stored in PostgreSQL and shared across service instances: up to 12 requests per anonymous browser session and 60 per network in each 10-minute window. A PostgreSQL lease semaphore caps simultaneous calls across all instances at 8 by default. Set `PUBLIC_ASSISTANT_MAX_CONCURRENT` in the service environment to tune that cap. On Render, configure `TRUST_PROXY` for the actual proxy chain so the network limit uses visitor addresses rather than treating all requests as one proxy address.

## Migration and rollout notes

The server and browser file origins have separate storage. Existing values from the old `file://` or hosted website are not automatically copied to localhost. Use sample records for the first localhost test; a reviewed export/import migration is needed before moving existing live records. The remaining site pages still use their current browser storage and will be migrated in later steps.

The first test phase is for localhost. Before public deployment, configure HTTPS and production cookie settings, review backup/restore, and complete the remaining website modules.

### Teacher task workflow database migration

Before using the new teacher task tools, apply `database/007_teacher_learning_workflow.sql` once to the DIPVTC PostgreSQL database. From the PostgreSQL `psql` prompt connected to `dipvtc_web`, run `\i 'C:/Users/Fannie Gee/Desktop/DIPVTC_WEB/database/007_teacher_learning_workflow.sql'`. For Render, run the same migration against the DIPVTC Render database using its SQL console or a secure `psql` connection. Do not apply it to the separate GFT-FMT database.

Teacher media fields currently accept HTTPS links; arbitrary uploaded HTML is not executed. Use the built-in question builder for interactive work. For a static teacher-authored HTML resource, host it on a trusted school-controlled HTTPS location and embed it only in a sandboxed viewer with scripts, forms and same-origin access disabled. Browser copy and focus events are best-effort signals. A website cannot reliably prevent or detect screenshots made with device controls, or guarantee a network request during a device shutdown; the task saves answers as students type and records interruptions for teacher review.


Owner and Admin can open a read-only Staff dashboard preview and, from each learner record, read-only Student and Parent portal previews. Portal previews require a management session and do not grant or change family-account access.

## Teacher private learning media and HTML requests

Apply `database/008_learning_media_and_html_requests.sql` after migration 007. Teacher audio, video and image uploads are private objects in an S3-compatible bucket; the application redirects authorized class members to short-lived signed URLs. Keep the bucket private. Set these values in the service environment (never commit secrets): `MEDIA_STORAGE_DRIVER=s3`, `MEDIA_S3_ENDPOINT`, `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION`, `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY`, and optionally `MEDIA_MAX_UPLOAD_MB` (1–25). The S3 credentials need object read/write access to the `learning/` prefix. The free Render web-service filesystem is ephemeral, so do not save learner media there.

The teacher HTML option currently records an audited request containing the class, task title, file name and teacher note. It does not upload, store, or execute the selected HTML file. The later HTML activity connection remains a separate stage.

Teacher question pasting accepts numbered headings such as `Q1:` or `1.`, choices such as `A) ...`, and optional `Answer: B` / `Marks: 2` lines. Teachers can edit parsed items, attach media to a specific item, preview, then publish.

### ZIMSEC teacher class allocations

Apply `database/009_zimsec_teacher_class_assignments.sql` after migrations 001–008 to the DIPVTC database. It seeds the canonical ZIMSEC classes, links existing ZIMSEC learner records and class content to the canonical class names, and creates the Owner/Main Admin managed teacher assignment table. Primary lead-class assignments automatically include the six core subjects. This migration and the new assignment controls are ZIMSEC-only.


## WhatsApp Cloud API information assistant

The `/webhooks/whatsapp` endpoint handles Meta webhook verification and signed inbound WhatsApp webhooks. Text messages use the same published-school-information assistant as the website. Replies are sent only after a user starts the conversation; the application does not send unsolicited messages. Only text and interactive button/list replies are supported in this first version. Private learner/account/payment/health requests are not sent to OpenAI. Message text and sender phone numbers are not stored in the school database; the database stores Meta message IDs only for webhook deduplication and retry handling.

Before activating the webhook, apply `database/014_whatsapp_assistant_webhook.sql` to the DIPVTC database. For local `psql`, run `\i 'C:/Users/Fannie Gee/Desktop/DIPVTC_WEB/database/014_whatsapp_assistant_webhook.sql'`. Do not run it against the separate GFT-FMT database.

In Meta for Developers, create an app with the WhatsApp use case and test the flow using Meta's test number first. Set the webhook callback to `https://dipvtc-web.onrender.com/webhooks/whatsapp`, enter the same random `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in Meta and Render, verify the callback, and subscribe the app to the `messages` webhook field. Configure these secrets in the `dipvtc-web` Render service Environment settings; do not put them in Git or send them in chat: `WHATSAPP_ACCESS_TOKEN` (system-user token with WhatsApp messaging permission), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, and `WHATSAPP_APP_SECRET`. Set `WHATSAPP_GRAPH_API_VERSION` to a currently supported Meta Graph API version. The code defaults to `v27.0`. Set `PUBLIC_BASE_URL=https://dipvtc.com` if the public website should use the custom domain in WhatsApp replies.

Do not move the school's currently used WhatsApp number into Cloud API using the direct migration steps until its account type and history are checked. Meta documents that a direct move can require deleting the existing WhatsApp account and lose its message history; keeping the Business app and Cloud API active together requires supported coexistence onboarding through a partner. Start with the test number or a separate number, then decide how to onboard the support number. Cloud API messages may have Meta charges.
