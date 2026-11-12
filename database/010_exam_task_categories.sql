BEGIN;
ALTER TABLE teacher_tasks DROP CONSTRAINT IF EXISTS teacher_tasks_category_check;
ALTER TABLE teacher_tasks ADD CONSTRAINT teacher_tasks_category_check
  CHECK (category IN ('daily_exercise','weekend_assignment','fortnight_revision','monthly_revision','end_of_term_exam','end_of_year_exam','other'));
COMMIT;
