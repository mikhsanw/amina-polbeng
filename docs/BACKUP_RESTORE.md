# Backup dan Restore

Backup: `mysqldump --single-transaction --routines --triggers sami_nonak > sami_nonak.sql`. Restore: `mysql sami_nonak < sami_nonak.sql`. Uji restore secara berkala dan simpan backup secara terenkripsi.
