FROM postgres:18-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends awscli ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*

COPY backup/run-backup.sh /usr/local/bin/dipvtc-db-backup
RUN chmod 0755 /usr/local/bin/dipvtc-db-backup

ENTRYPOINT ["/usr/local/bin/dipvtc-db-backup"]
