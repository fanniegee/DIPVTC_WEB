# DIPVTC family portals — Version 0.2.0

## What is included

- Parent and Student sign-in selection at `/portal-login.html`.
- Admissions registration and editing at `/registrations.html` for Owner, Main Admin and Admissions Officer.
- Registration creates a canonical academic learner record and emails role-specific, one-time activation invitations. An existing matching account is linked to the new learner.
- Parent and Student dashboards at `/parent-portal.html` and `/student-portal.html`, with learner profile, lessons, assignments, study resources, attendance, school notices, timetable/calendar entries and published end-of-term results.
- Result calculations use the shared marking-engine calculation library. Primary units and Secondary qualification-band results use the established grading rules. Class position is left to the official report because family portal access does not expose classmates' marks.
- Admissions/Owner/Main Admin can review pending password-help requests and email a one-hour reset message after verifying the requester's identity. The recipient can set a new password; outstanding sessions are revoked.
- Teacher, Principal and authorized admissions/admin roles can record attendance. Teacher class access follows the class in their account section.
- Teacher and Principal can publish class lessons, assignments, learning resources and announcements from `/learning.html`.

## Apply migration and start

From the project folder, run `npm.cmd run migrate:portals` once to apply `database/004_parent_student_portals.sql`; then run `npm.cmd run build:site` and restart the server. Migration 004 adds portal roles, learner profiles and relationships, attendance, class learning items and password-reset records. It does not change existing marks, weighted-paper calculations or rankings.

## Email delivery and account invitations

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_ADDRESS` and `SMTP_FROM_NAME` in `.env` using the details from the school's email host. Port 465 normally uses `SMTP_SECURE=true`; port 587 normally uses `SMTP_SECURE=false` with STARTTLS required. Do not put mailbox credentials in source files. Set `PUBLIC_BASE_URL` to the reachable school website address before sending invitations outside the local computer.

The Owner panel includes **Test Email Delivery**, which sends a message to the signed-in Owner mailbox. Staff invitations, parent/student activations and verified password resets are emailed by the server; the interface does not display the private links. An SMTP failure is reported to the staff member so they can correct the settings and retry. A password-help request does not reveal whether an account exists.

## Available data and limits

Learning items, daily attendance and learner profile details become available as school staff enter them. Only examination sessions marked `published` appear as family results. Legacy marks not in the academic tables and fee balances are not displayed in these dashboards. School timetable and calendar data are read from the existing site state when present. The official report remains the source for class position.
