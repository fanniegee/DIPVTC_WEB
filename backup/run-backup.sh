#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must reference the DIPVTC web service database connection}"
: "${EXPECTED_DATABASE_NAME:=dipvtc_web}"
: "${MEDIA_S3_ENDPOINT:?MEDIA_S3_ENDPOINT is required}"
: "${MEDIA_S3_BUCKET:?MEDIA_S3_BUCKET is required}"
: "${MEDIA_S3_ACCESS_KEY_ID:?MEDIA_S3_ACCESS_KEY_ID is required}"
: "${MEDIA_S3_SECRET_ACCESS_KEY:?MEDIA_S3_SECRET_ACCESS_KEY is required}"

BACKUP_PREFIX="${BACKUP_R2_PREFIX:-database-backups}"
RETENTION_DAYS="${BACKUP_DAILY_RETENTION_DAYS:-30}"
AWS_REGION="${MEDIA_S3_REGION:-auto}"
export AWS_ACCESS_KEY_ID="$MEDIA_S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$MEDIA_S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_EC2_METADATA_DISABLED=true

if [[ ! "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || (( RETENTION_DAYS < 1 )); then
  echo "BACKUP_DAILY_RETENTION_DAYS must be a positive whole number." >&2
  exit 2
fi
if [[ "$BACKUP_PREFIX" == /* || "$BACKUP_PREFIX" == *..* ]]; then
  echo "BACKUP_R2_PREFIX must be a relative R2 key prefix." >&2
  exit 2
fi

DB_NAME="$(psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c 'SELECT current_database()')"
if [[ "$DB_NAME" != "$EXPECTED_DATABASE_NAME" ]]; then
  echo "Refusing backup: the configured connection points to a different database." >&2
  exit 3
fi

SA_TZ="Africa/Johannesburg"
TODAY="$(TZ="$SA_TZ" date +%F)"
STAMP="$(TZ="$SA_TZ" date +%Y%m%dT%H%M%S%z)"
CUTOFF="$(TZ="$SA_TZ" date -d "$RETENTION_DAYS days ago" +%F)"
TEMP_DUMP="$(mktemp --suffix=.dump)"
trap 'rm -f "$TEMP_DUMP" "$TEMP_DUMP.sha256"' EXIT

pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$TEMP_DUMP"
sha256sum "$TEMP_DUMP" | awk '{print $1}' > "$TEMP_DUMP.sha256"

OBJECT_KEY="$BACKUP_PREFIX/daily/$TODAY/dipvtc_web-$STAMP.dump"
OBJECT_URI="s3://$MEDIA_S3_BUCKET/$OBJECT_KEY"
aws s3 cp "$TEMP_DUMP" "$OBJECT_URI" --endpoint-url "$MEDIA_S3_ENDPOINT" --region "$AWS_REGION" --only-show-errors
aws s3 cp "$TEMP_DUMP.sha256" "$OBJECT_URI.sha256" --endpoint-url "$MEDIA_S3_ENDPOINT" --region "$AWS_REGION" --only-show-errors

REMOTE_SIZE="$(aws s3api head-object --bucket "$MEDIA_S3_BUCKET" --key "$OBJECT_KEY" --endpoint-url "$MEDIA_S3_ENDPOINT" --region "$AWS_REGION" --query ContentLength --output text)"
LOCAL_SIZE="$(stat -c '%s' "$TEMP_DUMP")"
if [[ "$REMOTE_SIZE" != "$LOCAL_SIZE" ]]; then
  echo "Uploaded backup size did not match the local dump." >&2
  exit 4
fi

MONTH_DAY="$(TZ="$SA_TZ" date +%m-%d)"
if [[ "$MONTH_DAY" == "12-31" ]]; then
  YEAR_END_YEAR="$(TZ="$SA_TZ" date +%Y)"
  ANNUAL_KEY="$BACKUP_PREFIX/annual/$YEAR_END_YEAR/dipvtc_web-$YEAR_END_YEAR-year-end.dump"
  ANNUAL_URI="s3://$MEDIA_S3_BUCKET/$ANNUAL_KEY"
  aws s3 cp "$TEMP_DUMP" "$ANNUAL_URI" --endpoint-url "$MEDIA_S3_ENDPOINT" --region "$AWS_REGION" --only-show-errors
  aws s3 cp "$TEMP_DUMP.sha256" "$ANNUAL_URI.sha256" --endpoint-url "$MEDIA_S3_ENDPOINT" --region "$AWS_REGION" --only-show-errors
  echo "Year-end archive saved for academic year $YEAR_END_YEAR."
fi

aws s3 ls "s3://$MEDIA_S3_BUCKET/$BACKUP_PREFIX/daily/" --recursive --endpoint-url "$MEDIA_S3_ENDPOINT" --region "$AWS_REGION" |
while read -r OBJECT_DATE OBJECT_TIME OBJECT_SIZE OBJECT_PATH; do
  [[ "$OBJECT_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || continue
  if [[ "$OBJECT_DATE" < "$CUTOFF" ]]; then
    aws s3 rm "s3://$MEDIA_S3_BUCKET/$OBJECT_PATH" --endpoint-url "$MEDIA_S3_ENDPOINT" --region "$AWS_REGION" --only-show-errors
  fi
done

echo "Database backup uploaded and verified: $OBJECT_KEY"
