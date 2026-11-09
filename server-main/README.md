# DIPVTC main website and server

The root website files are the source. `npm run build:site` copies them into `server-main/public`, excluding the included marking-engine bundle and server/database source. Node serves the generated site and its API from `http://127.0.0.1:3000`.

## Local setup

1. Install Node.js 20 or newer and PostgreSQL.
2. Create a PostgreSQL database named `dipvtc` (or choose another name).
3. Copy `.env.example` to `.env`. Set `DATABASE_URL` to the local database and enter an owner email and a private password of at least 10 characters in `INITIAL_OWNER_EMAIL`, `INITIAL_OWNER_NAME` and `INITIAL_OWNER_PASSWORD`. Optionally configure an administrator account with the `INITIAL_ADMIN_*` fields.
4. Apply `database/001_initial_academic_schema.sql` through `database/005_student_self_registration.sql` in order to that database.
5. Run `npm install`, `npm run build:site`, then `npm start` from the website root.
6. Open `http://127.0.0.1:3000`. Staff Login leads to the shared staff dashboard. Admin / Owner Login routes each account to its matching dashboard. The Owner page's Main Admin button opens Admin.

Passwords are hashed with scrypt and are never stored in browser storage. The session is stored server-side and the browser receives an HTTP-only, same-site cookie.

Owner invitations send a one-time activation email that expires after seven days. Configure SMTP settings in the project .env file first. Staff set their own password from the email invitation and use the shared Staff dashboard. Built-in roles include Principal, Teacher / Tutor / Lecturer, Admissions Officer, Finance / Fees Officer, Content Manager and Front Desk; custom Owner-defined roles enter the shared dashboard with task-only access until permissions are configured.

After editing website source files in the root, run `npm run build:site` again.

The homepage welcome card and each Study Pathway card load image slides only from their own folders under `assets/home-welcome-slides/` and `assets/pathway-slides/{cambridge,zimsec,technical,vocational}/`. Add image filenames to each folder's `slides.json`; the default interval is seven seconds. The Owner dashboard includes a Fees Audit Engine button that opens the owner-protected `/fees.html` page.

## What is server-backed in this phase

- `index.html` loads the editable public page content from PostgreSQL and submits enquiries to the server.
- `owner.html` reads/writes its supported website-management state through the authenticated, owner-only API.
- `admin.html` reads the saved courses and students through the API and saves assignments to PostgreSQL.
- `staff.html` is the shared, Montserrat-based dashboard for Principal, Teacher / Tutor / Lecturer, Admissions Officer, Finance / Fees Officer, Content Manager and Front Desk accounts. Each built-in role receives a focused classic workspace and sees only its permitted records. All staff can view and complete their own assigned tasks.
- Teachers open the authenticated end-of-term Exam Mark-Entry workspace from the Staff dashboard. It is a server-backed copy of the Local Edition interface, including examination setup, learners, attendance, mark entry, report books, reports, rankings, awards and backup/restore. Its records are stored in PostgreSQL under `dipvtc_marking_engine_v1` and shared between teacher accounts.
- Teachers also have a separate read-only Class Results view over the normalized academic tables; the Principal has a school-wide view of those records. Both use the shared marking-calculation module. This is for review, while end-of-term entry is in Exam Mark-Entry. The two sets of records are not yet synchronized.
- The Finance / Fees Officer can open the existing Fees Audit Engine at `/fees.html` or `/fees.htm`. Its five `di_*` data stores save through the authenticated server storage layer, and the Owner can also access the fee page.
- `activate.html` validates one-time Owner invitations and creates staff accounts.
- The public Student Registration page creates a locked student account and an application. Admissions reviews and approves or rejects it. Approval enrolls the learner, activates the same email/password account for the Student Portal, and sends a notice. Parent/guardian details can be included so the parent can be linked or invited after approval.
- Manual Admissions lets staff enroll campus walk-ins across the six school/program choices. Student email may be omitted for a campus record; that learner has no individual student portal login until a student email and account are added.
- The compatibility storage layer used by these pages holds a session copy in memory and queues writes to the API; it does not write to browser `localStorage`.
- Server-side role checks, role-scoped state access, invitation validation, rate limits and audit rows are applied.

The `dipvtc_enquiries` compatibility list is synchronized with `website_enquiries`. The original Local Edition files under `assets/DIPvtC-MARK-ENGINE-v4.1.0-local-test-ready` remain unchanged as reference. The server serves a copy under `exam-mark-entry/`, with its storage changed to the authenticated server adapter.

## Migration and rollout notes

The server and browser file origins have separate storage. Existing values from the old `file://` or hosted website are not automatically copied to localhost. Use sample records for the first localhost test; a reviewed export/import migration is needed before moving existing live records. The remaining site pages still use their current browser storage and will be migrated in later steps.

The first test phase is for localhost. Before public deployment, configure HTTPS and production cookie settings, review backup/restore, and complete the remaining website modules.
