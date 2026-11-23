(() => {
  'use strict';
  const user = window.__DIPVTC_USER__ || {};
  const nav = document.querySelector('.nav');
  const content = document.querySelector('.content');
  const tasksPage = document.getElementById('page-tasks');
  if (!nav || !content || !tasksPage || !['owner', 'admin'].includes(user.role)) return;

  const navButton = document.createElement('button');
  navButton.type = 'button';
  navButton.dataset.page = 'academic-year';
  navButton.textContent = 'Academic Year';
  const overviewButton = nav.querySelector('[data-page="overview"]');
  overviewButton?.after(navButton);

  const section = document.createElement('section');
  section.id = 'page-academic-year';
  section.className = 'page';
  section.innerHTML = `<div class="head"><div><div class="eyebrow">Annual school rollover</div><h2>Academic year</h2><p>Open the next year, preserve each learner’s class history, and review or reverse the latest rollover when needed.</p></div></div>
    <div class="card"><h3 id="academicYearHeading">Loading academic-year settings…</h3><p id="academicYearSchedule" class="muted"></p>
      <div id="academicYearCounts" class="grid3"></div><p id="academicYearNotice" class="section-note">Promotion follows each school’s configured grade sequence. Final classes stay in place for review; non-graded courses do not advance automatically.</p>
      <div class="toplinks"><button id="previewAcademicYear" class="btn light" type="button">Preview next-year placements</button><button id="rolloverAcademicYear" class="btn peach" type="button" disabled>Open next academic year</button><button id="rollbackAcademicYear" class="btn light" type="button">Roll back latest year change</button><button id="refreshAcademicYear" class="btn light" type="button">Refresh</button></div>
      <div id="rolloverPreviewPanel" class="feed" hidden></div>
      <div id="academicYearMessage" class="status" role="status"></div>
    </div><div class="card"><h3>Individual learner class placement</h3><p class="muted">After a rollover, Owner/Admin can restore one learner to their saved previous-year class without rolling back other learners.</p><div id="academicYearLearners" class="feed"></div></div>
    <div class="card"><h3>Year-change history</h3><p class="muted">Rollover and rollback entries are retained in the audit history.</p><div id="academicYearHistory" class="feed"></div></div>`;
  content.insertBefore(section, tasksPage);

  const $ = id => document.getElementById(id);
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...options });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
    return data;
  }
  function showPage() {
    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page === section));
    document.querySelectorAll('.nav button').forEach(button => button.classList.toggle('active', button === navButton));
    load();
  }
  function historyRow(item) {
    const article = document.createElement('article'); article.className = 'event';
    const action = item.action === 'rollback' ? 'Rolled back' : 'Opened';
    const text = document.createElement('div');
    const title = document.createElement('b'); title.textContent = `${action} academic year ${item.to_year} (from ${item.from_year})`;
    const detail = document.createElement('p'); detail.textContent = `${item.reason || 'No reason recorded'} · ${item.changed_by_name || 'Automatic system action'} · ${new Date(item.created_at).toLocaleString()}`;
    text.append(title, detail); article.append(text); return article;
  }
  let currentActiveYear = null;
  let rolloverPreview = null;
  function renderRolloverPreview(preview) {
    const panel = $('rolloverPreviewPanel'); panel.replaceChildren(); panel.hidden = false;
    const counts = preview.counts || {};
    const summary = document.createElement('p'); summary.className = 'muted';
    summary.textContent = `Preview: ${preview.fromYear} → ${preview.toYear}. ${counts.promoted || 0} promoted; ${counts.terminal || 0} final-level learners retained; ${counts.non-academic || 0} non-academic courses unchanged; ${counts["needs-review"] || 0} need staff review.`;
    panel.append(summary);
    const list = document.createElement('div'); list.style.cssText = 'max-height:520px;overflow:auto;border:1px solid #dbe4f0;border-radius:10px';
    for (const learner of preview.learners || []) {
      const row = document.createElement('article'); row.className = 'event';
      const details = document.createElement('div');
      const title = document.createElement('b'); title.textContent = `${learner.name} · ${learner.studentNumber || 'No student number'}`;
      const placement = document.createElement('p'); placement.textContent = `${learner.school} · ${learner.currentClass} → ${learner.nextClass}`;
      const status = document.createElement('p'); status.textContent = `${learner.action === 'needs-review' ? 'Needs review' : learner.action === 'non-academic' ? 'No automatic promotion' : learner.action === 'terminal' ? 'Final level retained' : 'Promote'}${learner.reason ? ' · ' + learner.reason : ''}`;
      details.append(title, placement, status); row.append(details); list.append(row);
    }
    panel.append(list);
    $('rolloverAcademicYear').disabled = !(preview.fingerprint && preview.fromYear === currentActiveYear && (preview.counts?.['needs-review'] || 0) === 0);
  }
  async function load() {
    rolloverPreview = null; currentActiveYear = null;
    $('rolloverPreviewPanel').replaceChildren(); $('rolloverPreviewPanel').hidden = true;
    $('rolloverAcademicYear').disabled = true;
    $('academicYearMessage').textContent = 'Loading academic-year settings…';
    try {
      const data = await request('/api/admin/academic-year');
      currentActiveYear = data.activeYear;
      $('academicYearHeading').textContent = `Academic year ${data.activeYear} is active`;
      $('academicYearSchedule').textContent = `Automatic grade rollover: ${data.scheduledRollover}. Current enrollments: ${data.yearCounts.enrolled || 0}; completed/final class: ${data.yearCounts.completed || 0}; withdrawn: ${data.yearCounts.withdrawn || 0}.`;
      $('academicYearMessage').textContent = `Next year: ${data.nextYear}.`;
      $('rollbackAcademicYear').disabled = !data.history.some(item => item.action === 'rollover' && Number(item.to_year) === data.activeYear && !data.history.some(other => other.action === 'rollback' && other.related_event_id === item.id));
      const history = $('academicYearHistory'); history.replaceChildren();
      if (!data.history.length) history.textContent = 'No year changes have been recorded yet.';
      else data.history.forEach(item => history.append(historyRow(item)));
      const learners = $('academicYearLearners'); learners.replaceChildren();
      if (!data.learners.length) learners.textContent = 'No learner placements are recorded for the active year yet.';
      else for (const learner of data.learners) {
        const row = document.createElement('article'); row.className = 'event';
        const details = document.createElement('div');
        const name = document.createElement('b'); name.textContent = `${learner.name} · ${learner.studentNumber || 'No student number'}`;
        const classes = document.createElement('p'); classes.textContent = `Current year ${data.activeYear}: ${learner.currentClass} · Previous year: ${learner.previousClass || 'No saved prior placement'}`;
        details.append(name, classes);
        const button = document.createElement('button'); button.type = 'button'; button.className = 'btn light'; button.textContent = 'Restore previous-year class'; button.disabled = !learner.previousClass;
        button.addEventListener('click', async () => {
          const reason = prompt(`Why should ${learner.name} return to ${learner.previousClass}?`);
          if (reason === null) return;
          if (!confirm(`Restore ${learner.name} to ${learner.previousClass} for ${data.activeYear}? This affects only this learner.`)) return;
          button.disabled = true; $('academicYearMessage').textContent = 'Restoring learner class placement…';
          try { const result = await request(`/api/admin/academic-year/learners/${encodeURIComponent(learner.id)}/restore-previous-class`, { method: 'POST', body: JSON.stringify({ reason }) }); $('academicYearMessage').textContent = result.message; await load(); }
          catch (error) { $('academicYearMessage').textContent = error.message; button.disabled = false; }
        });
        row.append(details, button); learners.append(row);
      }
    } catch (error) {
      $('academicYearHeading').textContent = 'Academic-year setup is not ready';
      $('academicYearSchedule').textContent = error.message;
      $('academicYearMessage').textContent = 'Apply the academic-year database setup, then refresh this page.';
      $('rollbackAcademicYear').disabled = true;
      $('academicYearHistory').textContent = 'Year history will appear here after setup.';
    }
  }
  navButton.addEventListener('click', showPage);
  $('refreshAcademicYear').addEventListener('click', load);
  $('previewAcademicYear').addEventListener('click', async () => {
    $('previewAcademicYear').disabled = true; $('rolloverAcademicYear').disabled = true;
    $('academicYearMessage').textContent = 'Reviewing proposed learner placements…';
    try {
      rolloverPreview = await request('/api/admin/academic-year/rollover-preview');
      renderRolloverPreview(rolloverPreview);
      const needsReview = rolloverPreview.counts?.['needs-review'] || 0;
      $('academicYearMessage').textContent = needsReview ? `${needsReview} learner(s) need class or school corrections before rollover. The year-opening button remains disabled until the roster is corrected and previewed again.` : 'Review every proposed placement below. The year-opening button is enabled after the preview is clear.';
    } catch (error) { $('academicYearMessage').textContent = error.message; }
    finally { $('previewAcademicYear').disabled = false; }
  });
  $('rolloverAcademicYear').addEventListener('click', async () => {
    if (!rolloverPreview || rolloverPreview.fromYear !== currentActiveYear || !rolloverPreview.fingerprint) {
      $('academicYearMessage').textContent = 'Preview the next-year placements first.'; $('rolloverAcademicYear').disabled = true; return;
    }
    const reason = prompt('Why are you opening the next academic year? This reason will be kept in the permanent audit history.');
    if (reason === null) return;
    const summary = `Open academic year ${rolloverPreview.toYear}? ${rolloverPreview.counts.promoted || 0} learner(s) will advance and ${rolloverPreview.counts.terminal || 0} final-level learner(s) will remain in place. Please confirm you reviewed the full placement list.`;
    if (!confirm(summary)) return;
    $('rolloverAcademicYear').disabled = true; $('academicYearMessage').textContent = 'Opening the reviewed year and saving learner history…';
    try {
      const result = await request('/api/admin/academic-year/rollover', { method: 'POST', body: JSON.stringify({ reason, previewFingerprint: rolloverPreview.fingerprint }) });
      rolloverPreview = null; $('academicYearMessage').textContent = result.message; await load();
    } catch (error) { $('academicYearMessage').textContent = error.message; }
  });
  $('rollbackAcademicYear').addEventListener('click', async () => {
    const reason = prompt('Why must the latest academic-year transition be rolled back? New-year records will be kept.');
    if (reason === null) return;
    if (!confirm('Restore all learner placements and the previous active year? Any class edits made after rollover must first be restored to their recorded new-year placements.')) return;
    $('rollbackAcademicYear').disabled = true; $('academicYearMessage').textContent = 'Restoring the previous year and learner placements…';
    try { const result = await request('/api/admin/academic-year/rollback', { method: 'POST', body: JSON.stringify({ reason }) }); $('academicYearMessage').textContent = result.message; await load(); }
    catch (error) { $('academicYearMessage').textContent = error.message; }
  });
})();
