# Restoring a DIPVTC database backup

The scheduled job stores PostgreSQL custom-format dumps under the private R2 bucket prefix `database-backups/`. Daily copies are retained for 30 days; each year-end copy is stored separately and retained.

## Restore safely

1. Create or select a **new, empty recovery database**. Do not restore over the live `dipvtc_web` database.
2. Download one `.dump` object and its adjacent `.sha256` sidecar from the R2 bucket.
3. Verify the dump before restoring:

   ```bash
   printf '%s  %s\n' "$(cat dipvtc_web-YYYYMMDDTHHMMSS+0200.dump.sha256)" dipvtc_web-YYYYMMDDTHHMMSS+0200.dump | sha256sum -c -
   ```

4. Inspect the archive and restore it to the empty recovery database using PostgreSQL 18 client tools:

   ```bash
   pg_restore --list dipvtc_web-YYYYMMDDTHHMMSS+0200.dump
   pg_restore --dbname="$RECOVERY_DATABASE_URL" --no-owner --no-privileges --exit-on-error dipvtc_web-YYYYMMDDTHHMMSS+0200.dump
   ```

5. Confirm the restored database name and important tables, then compare learner/enrolment counts and academic-year history with the live system.
6. Keep the original database running until the restored copy is validated and a deliberate cutover is approved.

The job runs at 23:30 South Africa time. On 31 December it also saves a year-end archive before the 1 January rollover, and daily backups older than 30 days are removed from the `daily/` prefix only. Annual archives are retained. The R2 bucket is accessed using the existing media-storage credentials. Keep bucket credentials out of Git/chat. A restore rehearsal requires a separate recovery database and may incur Render charges.
