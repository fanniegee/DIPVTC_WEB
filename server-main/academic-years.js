"use strict";

const saDateParts = () => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23"
}).formatToParts(new Date()).filter(part => part.type !== "literal").map(part => [part.type, part.value]));

function normalizeClassName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function classifyForRollover(learner, schools) {
  const school = schools.find(item => item.code === String(learner.school_code || "").toLowerCase());
  const currentName = String(learner.intended_class || String(learner.current_class || "").replace(/^.*?\s·\s/, "")).trim();
  const classIndex = school?.classes.findIndex(item => normalizeClassName(item.name) === normalizeClassName(currentName)) ?? -1;
  const currentClass = school?.classes[classIndex];
  if (!school || !currentClass) return { action: "needs-review", currentClass: currentName || "No class recorded", nextClass: "Needs staff review", reason: "School or class is not in the configured promotion sequence." };
  if (!currentClass.academicLevel) return { action: "non-academic", currentClass: currentName, nextClass: currentName, reason: "This course does not use automatic grade promotion." };
  if (classIndex < school.classes.length - 1 && school.classes[classIndex + 1].academicLevel) {
    return { action: "promoted", currentClass: currentName, nextClass: school.classes[classIndex + 1].name, reason: "" };
  }
  return { action: "terminal", currentClass: currentName, nextClass: currentName, reason: "Final configured academic level; learner stays for review." };
}

function rolloverFingerprint(rows, fromYear, toYear) {
  const roster = rows.map(row => [row.id, row.class_id, row.school_code || "", row.intended_class || "", row.current_class || "", row.level || ""])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return require("crypto").createHash("sha256").update(JSON.stringify([fromYear, toYear, roster])).digest("hex");
}

function installAcademicYearRoutes(app, { pool, requireRole, schools }) {
  async function rollover(targetYear, actorId, reason, automatic = false, expectedFingerprint = null) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const control = await client.query("SELECT active_year FROM academic_year_control WHERE singleton=TRUE FOR UPDATE");
      if (!control.rowCount) throw Object.assign(new Error("Academic-year settings are not installed yet. Apply database/020_academic_year_rollover.sql first."), { status: 503 });
      const fromYear = Number(control.rows[0].active_year);
      if (Number(targetYear) !== fromYear + 1) throw Object.assign(new Error(`The next valid academic year is ${fromYear + 1}.`), { status: 409 });

      const roster = await client.query(`
        SELECT s.id,s.class_id,s.active,p.school_code,p.intended_class,c.name AS current_class,c.level
        FROM students s
        LEFT JOIN learner_profiles p ON p.student_id=s.id
        LEFT JOIN classes c ON c.id=s.class_id
        WHERE s.active=TRUE
        ORDER BY p.school_code,p.intended_class,s.full_name
        FOR UPDATE OF s`);
      if (expectedFingerprint && rolloverFingerprint(roster.rows, fromYear, Number(targetYear)) !== expectedFingerprint) {
        throw Object.assign(new Error("The learner roster changed after preview. Refresh and review the updated placements before opening the year."), { status: 409 });
      }
      const event = await client.query(`
        INSERT INTO academic_year_events(action,from_year,to_year,reason,changed_by)
        VALUES('rollover',$1,$2,$3,$4) RETURNING id`,
      [fromYear, Number(targetYear), reason, actorId || null]);
      await client.query("UPDATE academic_year_control SET active_year=$1,updated_by=$2,updated_at=NOW() WHERE singleton=TRUE", [Number(targetYear), actorId || null]);

      let promoted = 0, terminal = 0, nonAcademic = 0, unclassified = 0;
      for (const learner of roster.rows) {
        const school = schools.find(item => item.code === String(learner.school_code || "").toLowerCase());
        const currentName = String(learner.intended_class || String(learner.current_class || "").replace(/^.*?\s·\s/, "")).trim();
        const classIndex = school?.classes.findIndex(item => normalizeClassName(item.name) === normalizeClassName(currentName)) ?? -1;
        const currentClass = school?.classes[classIndex];
        let nextClass = null, action = "non-academic", newClassId = learner.class_id;
        if (!school || !currentClass) {
          action = "non-academic";
          unclassified++;
        } else if (!currentClass.academicLevel) {
          action = "non-academic";
          nonAcademic++;
        } else if (classIndex < school.classes.length - 1 && school.classes[classIndex + 1].academicLevel) {
          nextClass = school.classes[classIndex + 1];
          const nextLevel = nextClass.academicLevel;
          const rosterClassName = `${school.code} · ${nextClass.name}`.slice(0, 80);
          const classResult = await client.query(`
            INSERT INTO classes(level,name) VALUES($1,$2)
            ON CONFLICT(level,name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [nextLevel, rosterClassName]);
          newClassId = classResult.rows[0].id;
          action = "promoted";
          promoted++;
        } else {
          action = "retained";
          terminal++;
        }

        if (newClassId !== learner.class_id) {
          await client.query("UPDATE students SET class_id=$2 WHERE id=$1", [learner.id, newClassId]);
          await client.query("UPDATE learner_profiles SET intended_class=$2,updated_at=NOW() WHERE student_id=$1", [learner.id, nextClass.name]);
        }
        const newIntended = nextClass?.name || learner.intended_class || "";
        const enrollmentStatus = action === "retained" ? "completed" : "enrolled";
        await client.query(`
          INSERT INTO student_enrollments(student_id,academic_year,class_id,status,source,created_by,updated_at)
          VALUES($1,$2,$3,$4,'year-rollover',$5,NOW())
          ON CONFLICT(student_id,academic_year) DO UPDATE
            SET class_id=EXCLUDED.class_id,status=EXCLUDED.status,source='year-rollover',created_by=EXCLUDED.created_by,updated_at=NOW()`,
        [learner.id, Number(targetYear), newClassId, enrollmentStatus, actorId || null]);
        await client.query(`
          INSERT INTO academic_year_event_learners(event_id,student_id,old_class_id,new_class_id,old_intended_class,new_intended_class,action)
          VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [event.rows[0].id, learner.id, learner.class_id, newClassId, learner.intended_class || "", newIntended, action]);
      }

      await client.query(`INSERT INTO academic_sessions(school_name,academic_year,term,status)
        VALUES('Double Impact Private College',$1,'Term 1','open') ON CONFLICT(academic_year,term) DO NOTHING`, [Number(targetYear)]);
      await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,$2,$3)",
        [actorId || null, automatic ? "academic-year-auto-rollover" : "academic-year-rollover", `${fromYear}→${targetYear}; promoted=${promoted}; terminal=${terminal}; other=${nonAcademic + unclassified}`]);
      await client.query("COMMIT");
      return { fromYear, activeYear: Number(targetYear), promoted, terminal, nonAcademic, unclassified, eventId: event.rows[0].id };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  app.get("/api/admin/academic-year", requireRole("owner", "admin"), async (_req, res, next) => {
    try {
      const [control, history, counts, learners] = await Promise.all([
        pool.query("SELECT active_year,timezone,updated_at FROM academic_year_control WHERE singleton=TRUE"),
        pool.query(`SELECT e.id,e.action,e.from_year,e.to_year,e.reason,e.created_at,e.related_event_id,
          u.display_name AS changed_by_name FROM academic_year_events e LEFT JOIN app_users u ON u.id=e.changed_by
          ORDER BY e.created_at DESC LIMIT 20`),
        pool.query(`SELECT status,COUNT(*)::int AS count FROM student_enrollments
          WHERE academic_year=(SELECT active_year FROM academic_year_control WHERE singleton=TRUE) GROUP BY status`),
        pool.query(`SELECT s.id,s.student_number,s.full_name,current_enrollment.status,c.name AS current_class,
          previous_class.name AS previous_class
          FROM academic_year_control control
          JOIN student_enrollments current_enrollment ON current_enrollment.academic_year=control.active_year
          JOIN students s ON s.id=current_enrollment.student_id
          LEFT JOIN classes c ON c.id=current_enrollment.class_id
          LEFT JOIN student_enrollments previous_enrollment ON previous_enrollment.student_id=s.id
            AND previous_enrollment.academic_year=control.active_year-1
          LEFT JOIN classes previous_class ON previous_class.id=previous_enrollment.class_id
          WHERE control.singleton=TRUE ORDER BY c.name,s.full_name`)
      ]);
      if (!control.rowCount) return res.status(503).json({ error: "Apply database/020_academic_year_rollover.sql to enable year controls." });
      const yearCounts = Object.fromEntries(counts.rows.map(row => [row.status, row.count]));
      const date = saDateParts();
      res.setHeader("Cache-Control", "no-store");
      res.json({ activeYear: Number(control.rows[0].active_year), nextYear: Number(control.rows[0].active_year) + 1,
        timezone: control.rows[0].timezone, updatedAt: control.rows[0].updated_at, yearCounts,
        scheduledRollover: `January 1 at 00:01 (${control.rows[0].timezone})`, localDate: `${date.year}-${date.month}-${date.day}`, history: history.rows,
        learners: learners.rows.map(row => ({ id: row.id, studentNumber: row.student_number, name: row.full_name, status: row.status,
          currentClass: row.current_class || "No class assigned", previousClass: row.previous_class || null })) });
    } catch (error) { next(error); }
  });

  app.get("/api/admin/academic-year/rollover-preview", requireRole("owner", "admin"), async (_req, res, next) => {
    try {
      const control = await pool.query("SELECT active_year FROM academic_year_control WHERE singleton=TRUE");
      if (!control.rowCount) return res.status(503).json({ error: "Apply the academic-year database setup before previewing rollover." });
      const fromYear = Number(control.rows[0].active_year), toYear = fromYear + 1;
      const roster = await pool.query("SELECT s.id,s.student_number,s.full_name,s.class_id,s.active,p.school_code,p.intended_class,c.name AS current_class,c.level FROM students s LEFT JOIN learner_profiles p ON p.student_id=s.id LEFT JOIN classes c ON c.id=s.class_id WHERE s.active=TRUE ORDER BY p.school_code,p.intended_class,s.full_name");
      const learners = roster.rows.map(row => {
        const plan = classifyForRollover(row, schools);
        const school = schools.find(item => item.code === String(row.school_code || "").toLowerCase());
        return { id: row.id, studentNumber: row.student_number, name: row.full_name, school: school?.name || row.school_code || "Unmatched school", ...plan };
      });
      const counts = learners.reduce((all, row) => { all[row.action] = (all[row.action] || 0) + 1; return all; }, {});
      res.setHeader("Cache-Control", "no-store");
      res.json({ fromYear, toYear, counts, learners, fingerprint: rolloverFingerprint(roster.rows, fromYear, toYear) });
    } catch (error) { next(error); }
  });

  app.post("/api/admin/academic-year/rollover", requireRole("owner", "admin"), async (req, res, next) => {
    const reason = String(req.body?.reason || "").trim().slice(0, 500);
    const fingerprint = String(req.body?.previewFingerprint || "");
    if (!/^[a-f0-9]{64}$/i.test(fingerprint)) return res.status(409).json({ error: "Preview the proposed class placements before opening the year." });
    if (reason.length < 8) return res.status(400).json({ error: "Add a reason of at least 8 characters for the permanent year-change audit." });
    try {
      const control = await pool.query("SELECT active_year FROM academic_year_control WHERE singleton=TRUE");
      if (!control.rowCount) return res.status(503).json({ error: "Apply database/020_academic_year_rollover.sql before opening a new year." });
      const result = await rollover(Number(control.rows[0].active_year) + 1, req.user.id, reason, false, fingerprint);
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true, ...result, message: `Academic year ${result.activeYear} is open. ${result.promoted} learners advanced; ${result.terminal} final-level learners were retained for review.` });
    } catch (error) { next(error); }
  });

  app.post("/api/admin/academic-year/rollback", requireRole("owner", "admin"), async (req, res, next) => {
    const reason = String(req.body?.reason || "").trim().slice(0, 500);
    if (reason.length < 8) return res.status(400).json({ error: "Add a reason of at least 8 characters for the rollback audit." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const control = await client.query("SELECT active_year FROM academic_year_control WHERE singleton=TRUE FOR UPDATE");
      if (!control.rowCount) throw Object.assign(new Error("Apply database/020_academic_year_rollover.sql first."), { status: 503 });
      const activeYear = Number(control.rows[0].active_year);
      const event = await client.query(`SELECT * FROM academic_year_events WHERE action='rollover' AND to_year=$1
        AND NOT EXISTS(SELECT 1 FROM academic_year_events r WHERE r.action='rollback' AND r.related_event_id=academic_year_events.id)
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [activeYear]);
      if (!event.rowCount) throw Object.assign(new Error("There is no unrolled transition for the active year to reverse."), { status: 409 });
      const sourceEvent = event.rows[0];
      const changes = await client.query(`SELECT l.*,s.class_id AS live_class_id,p.intended_class AS live_intended_class FROM academic_year_event_learners l
        JOIN students s ON s.id=l.student_id LEFT JOIN learner_profiles p ON p.student_id=s.id
        WHERE l.event_id=$1 FOR UPDATE OF s`, [sourceEvent.id]);
      const changedSince = changes.rows.filter(row => String(row.live_class_id || "") !== String(row.new_class_id || "") ||
        String(row.live_intended_class || "") !== String(row.new_intended_class || ""));
      if (changedSince.length) throw Object.assign(new Error(`${changedSince.length} learner class record(s) changed after rollover. Restore those classes to the recorded new-year placements before rolling back, so newer admin corrections are not overwritten.`), { status: 409 });
      await client.query("UPDATE academic_year_control SET active_year=$1,updated_by=$2,updated_at=NOW() WHERE singleton=TRUE", [Number(sourceEvent.from_year), req.user.id]);
      for (const row of changes.rows) {
        await client.query("UPDATE students SET class_id=$2 WHERE id=$1", [row.student_id, row.old_class_id]);
        await client.query("UPDATE learner_profiles SET intended_class=$2,updated_at=NOW() WHERE student_id=$1", [row.student_id, row.old_intended_class]);
      }
      await client.query("UPDATE student_enrollments SET status='rolled_back',updated_at=NOW() WHERE academic_year=$1", [activeYear]);
      const rollback = await client.query(`INSERT INTO academic_year_events(action,from_year,to_year,reason,changed_by,related_event_id)
        VALUES('rollback',$1,$2,$3,$4,$5) RETURNING id`, [activeYear, Number(sourceEvent.from_year), reason, req.user.id, sourceEvent.id]);
      await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'academic-year-rollback',$2)",
        [req.user.id, `${activeYear}→${sourceEvent.from_year}; event=${sourceEvent.id}`]);
      await client.query("COMMIT");
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true, activeYear: Number(sourceEvent.from_year), rollbackEventId: rollback.rows[0].id,
        restored: changes.rowCount, message: `Year ${sourceEvent.from_year} is active again and ${changes.rowCount} learner placements were restored. New-year records were retained.` });
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); next(error); }
    finally { client.release(); }
  });

  app.post("/api/admin/academic-year/learners/:id/restore-previous-class", requireRole("owner", "admin"), async (req, res, next) => {
    const studentId = String(req.params.id || ""), reason = String(req.body?.reason || "").trim().slice(0, 500);
    if (!/^[0-9a-f-]{36}$/i.test(studentId)) return res.status(400).json({ error: "Choose a valid learner record." });
    if (reason.length < 8) return res.status(400).json({ error: "Add a reason of at least 8 characters for the learner class correction." });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const control = await client.query("SELECT active_year FROM academic_year_control WHERE singleton=TRUE FOR UPDATE");
      if (!control.rowCount) throw Object.assign(new Error("Apply database/020_academic_year_rollover.sql first."), { status: 503 });
      const activeYear = Number(control.rows[0].active_year);
      const placement = await client.query(`SELECT s.id,s.student_number,s.full_name,s.class_id,p.intended_class,
        current_enrollment.status,current_enrollment.class_id AS current_class_id,
        prior_enrollment.class_id AS prior_class_id,prior_class.name AS prior_class_name
        FROM students s JOIN learner_profiles p ON p.student_id=s.id
        JOIN student_enrollments current_enrollment ON current_enrollment.student_id=s.id AND current_enrollment.academic_year=$2
        JOIN student_enrollments prior_enrollment ON prior_enrollment.student_id=s.id AND prior_enrollment.academic_year=$2-1
        JOIN classes prior_class ON prior_class.id=prior_enrollment.class_id
        WHERE s.id=$1 FOR UPDATE OF s,current_enrollment`, [studentId, activeYear]);
      if (!placement.rowCount) throw Object.assign(new Error("This learner has no saved class placement from the previous academic year."), { status: 404 });
      const learner = placement.rows[0];
      const restoredClassName = String(learner.prior_class_name).replace(/^[^·]+·\s*/, "").trim();
      await client.query("UPDATE students SET class_id=$2 WHERE id=$1", [studentId, learner.prior_class_id]);
      await client.query("UPDATE learner_profiles SET intended_class=$2,updated_at=NOW() WHERE student_id=$1", [studentId, restoredClassName]);
      await client.query(`UPDATE student_enrollments SET class_id=$3,status='enrolled',source='admin-correction',created_by=$4,updated_at=NOW()
        WHERE student_id=$1 AND academic_year=$2`, [studentId, activeYear, learner.prior_class_id, req.user.id]);
      const event = await client.query(`INSERT INTO academic_year_events(action,from_year,to_year,reason,changed_by)
        VALUES('learner_rollback',$1,$1,$2,$3) RETURNING id`, [activeYear, reason, req.user.id]);
      await client.query(`INSERT INTO academic_year_event_learners(event_id,student_id,old_class_id,new_class_id,old_intended_class,new_intended_class,action)
        VALUES($1,$2,$3,$4,$5,$6,'restored')`, [event.rows[0].id, studentId, learner.current_class_id, learner.prior_class_id, learner.intended_class || "", restoredClassName]);
      await client.query("INSERT INTO app_audit_log(user_id,action,target_key) VALUES($1,'academic-year-learner-rollback',$2)",
        [req.user.id, `${learner.student_number || studentId}: ${activeYear} placement restored to ${restoredClassName}`]);
      await client.query("COMMIT");
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true, studentId, className: restoredClassName, academicYear: activeYear,
        message: `${learner.full_name} is now assigned to ${restoredClassName} for academic year ${activeYear}. Previous records remain saved.` });
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); next(error); }
    finally { client.release(); }
  });

  async function rollForwardIfDue() {
    const date = saDateParts();
    const openingHasPassed = date.month !== "01" || date.day !== "01" || Number(date.hour) * 60 + Number(date.minute) >= 1;
    if (!openingHasPassed) return;
    try {
      const control = await pool.query("SELECT active_year FROM academic_year_control WHERE singleton=TRUE");
      if (!control.rowCount) return;
      let activeYear = Number(control.rows[0].active_year), calendarYear = Number(date.year);
      while (activeYear < calendarYear) {
        const result = await rollover(activeYear + 1, null, "Scheduled annual rollover at 00:01 Africa/Johannesburg.", true);
        activeYear = result.activeYear;
        console.info(`Academic year automatically advanced to ${activeYear}; ${result.promoted} learners promoted.`);
      }
    } catch (error) {
      if (error.code !== "42P01") console.warn("Scheduled academic-year rollover could not complete:", error.message);
    }
  }
  return { rollForwardIfDue };
}

module.exports = installAcademicYearRoutes;
