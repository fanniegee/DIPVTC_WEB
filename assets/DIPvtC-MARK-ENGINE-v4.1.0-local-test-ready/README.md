# DIPvtC Marking Engine — Version 4.1.0

## Included editions
- `local-edition/`: browser-based application using localStorage, with JSON backup and restore.
- `server-edition/`: Node.js/Express + PostgreSQL integration foundation.
- `shared/calculations.js`: the Local Edition calculation module. The Server Edition retains its own separate copy.

## Multi-paper assessment
A subject supports any number of papers. Configure paper maximums as comma-separated values (for example `80, 100, 50, 50`). Each paper has its own maximum mark. The final subject percentage is:

`(sum of marks obtained across all papers ÷ sum of maximum marks across all papers) × 100`

Every configured paper requires an entry. Enter `0` when a learner sat the paper but scored zero. A blank is not silently treated as a submitted zero.

## Marking rules
### Primary
- 85–100% = 1 unit (Pass)
- 77–84% = 2 units (Pass)
- 70–76% = 3 units (Pass)
- 60–69% = 4 units (Pass)
- 50–59% = 5 units (Pass)
- 40–49% = 6 units (Pass with Credit)
- 30–39% = 7 units (Pass)
- 20–29% = 8 units (Fail)
- 0–19% = 9 units (Fail)

Primary ranking: lowest total units first. Current tie-break: higher overall percentage.

### Secondary
- 90–100% = A+ Outstanding
- 75–89% = A Excellent
- 70–74% = B+ Very Good
- 65–69% = B Good
- 55–64% = C+ Above Average
- 50–54% = C Average
- 45–49% = D+ Satisfactory
- 40–44% = D Below Average
- 30–39% = E Pass
- Below 30% = U Fail

Secondary ranking: learners qualifying in the highest percentage band with at least three subjects rank first; ties use the number of subjects in that band and then total marks. Learners without a qualifying band follow, ordered by total marks.

## Version 0.4 report improvements
- Individual reports now calculate each learner's position against the complete selected class, even when printing only one learner.
- Class batches are emitted as one valid printable HTML document containing separate report sheets.
- The overall examination report is now a distinct summary publication, with class ranking, average performance and subject award recipients (ties share awards).
- Primary and Secondary report colours remain distinct (blue and peach).
- Use the browser print dialogue to print or save as PDF.
- Report Centre is available from the left navigation. It can preview saved learner reports, download report HTML files, and print/save PDFs; each student row also has a Report shortcut.
- The whole-school overview combines all saved Primary and Secondary learners in separate tables, showing incomplete learners as Pending.
- Student records can be edited without deleting their saved marks or attendance.
- Downloaded HTML reports use the Local Edition's installed logo and flag assets; retain the extracted Local Edition folder for those images to remain available. PDF export uses the browser print dialog.

## Local edition quick start
1. Extract the ZIP.
2. Open `local-edition/index.html` in Chrome or Edge.
3. Configure the examination, classes, subjects and each subject's paper maxima.
4. Register students and enter every configured paper mark.
5. Enter and review daily attendance from Attendance.
6. Manage school contact details, term fees and opening dates from School details.
7. Maintain report-book comments and signatory names from Report book.
8. Review Results, Awards and Report Centre.
9. Export a JSON backup regularly and store it separately from the computer.

Local data belongs to the browser profile and device. Clearing browser data can remove it; keep external backups.

## Server edition setup
Requires Node.js 20+ and PostgreSQL:
1. Create a PostgreSQL database.
2. Run `server-edition/database/schema.sql` against it.
3. Copy `.env.example` to `.env` and configure `DATABASE_URL`, `DATABASE_SSL`, `PORT`, and `ALLOWED_ORIGIN`.
4. Run `npm install`, then `npm run dev` from `server-edition`.

The relational schema supports arbitrary papers in `subject_papers` and mark records in `examination_paper_marks`. The HTTP academic-data routes intentionally remain blocked until authentication, role permissions, authorization checks, audit logging and tenant/school data isolation are implemented. Do not expose this server edition to the public internet or enter live learner data until those controls are completed and security-reviewed.

## Local Edition additions in Version 4.1.0
- Daily attendance entry by date, learner, class and status (Present, Absent, Late or Excused), with notes and saved history.
- Managed teacher, principal and parent comments and signatory names for each learner, year and term.
- Managed next-term fees and opening dates.
- Student report batches include the saved report-book fields and a supplementary attendance record page.
- JSON backups include attendance, report-book comments/signatures, fees and opening dates. Restore checks for the required student and subject collections before replacing local data.
- Local Edition remains a static browser application backed by localStorage. It does not require Node.js or a server.
- Report Centre now provides learner and level report preview/download/print actions plus a combined whole-school overview for both levels.
- Student register rows now include Edit and Report actions. Editing preserves the existing learner ID, marks and attendance records.

## Report booklet source review and limitations
The supplied Primary and Secondary PDFs are A3 landscape booklet impositions with alternating upright and inverted panels. Both include a school cover, national anthem, grading key and repeated portrait assessment sheets. The Primary sheet is cream/yellow and has average, exam mark, grade and teacher-comment columns; the Secondary sheet is pale blue and has Paper 1, Paper 2, total mark/percentage, grade and teacher-comment columns. Both show possible/actual attendance, class position/out of, teacher and principal comments/signatures, parent/guardian signature, next-term fees and next-term opening date. The Local Edition includes the extracted school logo and flag, a personalized cover, a bilingual anthem page, academic report sheets, attendance supplements and level grading keys. The output is a sequence of printable A4 portrait pages rather than an A3 booklet imposition; original typography and full booklet artwork are not reproduced. Review print preview before using as official stationery.

## Version 4.1 implementation status
The Local Edition feature work is prepared for browser and end-to-end testing. The current test suite covers shared calculation rules; complete browser interaction and backup/restore/print/batch verification remain the next testing-stage work. Do not begin Server Edition feature work until the Local Edition test stage is signed off.

### Local test commands
Run the built-in calculation tests from the project root with `node --test tests/calculations.test.js`. The Local Edition itself runs by opening `local-edition/index.html` directly in a supported browser; it has no Node.js or server runtime dependency. Follow `tests/LOCAL-TEST-PLAN.md` for browser and end-to-end checks before signing off.


## Preserved calculation and ranking rules
Multi-paper subject percentages use total obtained marks divided by total possible marks. Blank marks remain incomplete and explicit zeroes are accepted. Incomplete learners remain pending and cannot receive official positions or printed report-book batches. Primary grades and ranking remain based on the agreed unit bands; lowest total units rank first, with total marks as the tie-break. Secondary report-book grades remain independent from ranking. An E (30–39%) is a report-book Pass, while class ranking applies the separate three-subject qualification threshold across percentage bands. The Server Edition and its calculation files are unchanged.
