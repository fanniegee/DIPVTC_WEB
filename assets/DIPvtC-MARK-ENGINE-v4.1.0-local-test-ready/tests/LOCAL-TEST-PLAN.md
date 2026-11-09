# Local Edition browser and end-to-end test plan

Use temporary learner records only. The app stores its data in the current browser profile. Keep a separate export if testing in a profile that contains real school records.

## Launch and persistence

1. Open local-edition/index.html directly in Edge or Chrome, with network access off.
2. Confirm the dashboard loads and the navigation opens Examination setup, School details, Students, Attendance, Mark entry, Report book, Results, Awards, Report Centre and Settings.
3. Reload the page and confirm saved data remains available in that browser profile.

## School setup and learner records

1. Change the school name, contact information, next-term fees and opening date. Save, move to another screen and return; verify the values persisted.
2. Configure Primary and Secondary subjects, including one subject with four papers and another with two. Confirm maxima and subject-level/class-level settings appear correctly.
3. Register at least two learners in the same class and one in another class. Check search, Edit, Report shortcut, removal confirmation and level/class assignment. After editing, confirm marks and attendance remain attached to the learner.

## Attendance

1. Open Attendance and choose a date and class. Confirm every learner begins with an unselected status.
2. Try saving with one status unselected; confirm the app rejects the incomplete register without changing saved records.
3. Mark learners Present, Absent, Late and Excused, including notes. Save and verify the summary counts are grouped by date, level and class.
4. Reopen the saved date and class, change a status and note, save again, and confirm the counts update instead of duplicating that session.
5. Switch the examination level and confirm entries remain associated with the correct learners.

## Marks and agreed calculations

1. Enter a multi-paper mark set with an explicit zero and verify weighted percentage uses total obtained marks divided by total possible marks.
2. Leave a paper blank and confirm saving is blocked; enter zero and confirm it is accepted.
3. Check Primary band edges 19/20/29/30/39/40/49/50/59/60/69/70/76/77/84/85.
4. Check Secondary grade edges and confirm E (30-39%) is a report-book pass.
5. For Secondary ranking, use learners with three subjects in several separate percentage bands. Confirm the three-subject qualification hierarchy, then band count and total marks tie-breaks.
6. Confirm Primary ranking is lowest total units first, then total marks, and ties share positions when the tie-break values match.

## Comments, reports and printing

1. Save teacher, principal and parent comments and signatory names for one learner. Change year or term, then return and confirm report-book data is separated by learner, year and term.
2. Generate one learner report, a class batch and the overall examination report for each level. Use Report Centre's View, HTML Download and Print / Save PDF controls; from Students, use the Report shortcut and confirm it selects the learner.
3. Use the whole-school overview and confirm it includes both Primary and Secondary students, their result/rank or Pending status, and level completion counts. Check View, HTML Download and Print / Save PDF.
4. Verify report-book colors, logo, cover, bilingual anthem page and flag, class position/out-of, attendance counts, subject columns, weighted totals, grade/unit result, school fees, opening date, comments and signatures.
5. Confirm each individual report includes its attendance supplement and the print batch ends with the correct level grading key.
6. Use print preview or Save as PDF. Check for cut-off tables, clipped text, unexpected blank pages, missing logo, and colors that are too faint.

## Backup, restore and invalid files

1. Export JSON with sample learners, marks, attendance, school details, fees, dates and comments. Confirm the download opens as valid JSON and includes those fields.
2. Add a clearly temporary learner, then restore the export. Accept the replacement prompt and confirm the temporary learner disappears while all exported records return.
3. Select a malformed JSON file and a JSON file missing required arrays. Confirm restore rejects both and preserves current data.
4. Cancel the replacement confirmation and confirm current data remains unchanged.

## Release gate

- All navigation, save, edit, reload, print and restore steps above work in the supported browsers.
- The calculation suite passes with node --test tests/calculations.test.js.
- The reviewer records browser version, operating system, print-to-PDF result and any remaining visual differences from the A3 source booklet before starting Server Edition work.
