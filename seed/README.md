# Workbook Sistem SAMI-NONAK

Ekspor Google Sheet Sistem SAMI-NONAK ke format XLSX lalu simpan sebagai:

```text
seed/SAMI_NONAK_POLBENG_SYSTEM.xlsx
```

Jalankan impor setelah migrasi dan seed role:

```bash
npm run import:system
```

Importer membaca unit, tupoksi, standar, klausul ISO, 250 pertanyaan, pemetaan unit, pemetaan tupoksi, serta matriks standar–regulasi–ISO.

File XLSX tidak dimasukkan ke repository agar perubahan master tetap dikendalikan oleh P4MP dan Admin Mutu. Standar internal pada workbook masih berstatus rancangan sampai ditetapkan secara resmi oleh Polbeng.