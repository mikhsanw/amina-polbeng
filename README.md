# SAMI-NONAK POLBENG

Sistem Audit Mutu Internal Nonakademik Politeknik Negeri Bengkalis.

Versi ini memisahkan dua dimensi audit:

1. **Pencapaian standar** yang bersumber dari standar Dikti dan standar internal Polbeng, dengan hasil `MELAMPAUI`, `TERCAPAI`, `TIDAK_TERCAPAI`, atau `BELUM_DIUKUR`.
2. **Kesesuaian proses bisnis** yang bersumber dari ISO 9001:2015, dengan hasil `C`, `OFI`, `OBS`, `KTS_MINOR`, `KTS_MAYOR`, `GP`, atau `NA`.

## Role

Role aplikasi:

- `SUPER_ADMIN`
- `ADMIN_MUTU`
- `P4MP`
- `AUDITOR`
- `KETUA_AUDITOR`
- `AUDITEE`
- `VERIFIKATOR`
- `PIMPINAN`

`KEPALA_UNIT` tidak menjadi role tersendiri. Auditee yang berwenang mengesahkan unit menggunakan atribut `isUnitApprover=true`.

`VERIFIKATOR` khusus membandingkan dan memutuskan usulan perubahan auditor terhadap instrumen default. Pemeriksaan efektivitas tindak lanjut dilakukan oleh Auditor dan keputusan akhirnya ditetapkan Ketua Auditor.

## Menjalankan lokal

1. Salin `.env.example` menjadi `.env` dan ganti secret.
2. Jalankan MySQL 8 melalui `docker compose up -d mysql` atau gunakan server MySQL yang tersedia.
3. Jalankan:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

4. Ekspor Google Sheet Sistem SAMI-NONAK menjadi XLSX dan simpan sebagai:

```text
seed/SAMI_NONAK_POLBENG_SYSTEM.xlsx
```

5. Impor unit, tupoksi, standar, klausul ISO, 250 pertanyaan, dan seluruh pemetaan:

```bash
npm run import:system
```

6. Periksa proyek:

```bash
npm run typecheck
npm run build
```

7. Jalankan aplikasi:

```bash
npm run dev
```

8. Buka `http://localhost:3000`. Swagger tersedia pada `http://localhost:4000/api/docs`.

## Alur audit

```text
Program audit
→ Persiapan workspace dan tim
→ Pembentukan instrumen default
→ Telaah auditor
→ Publikasi langsung bila tidak berubah
→ Verifikasi bila terdapat perubahan
→ Penilaian mandiri dan bukti
→ Desk review
→ Kertas kerja
→ Temuan
→ Tindak lanjut
→ Pemeriksaan auditor dan keputusan Ketua Auditor
→ Laporan
→ Penutupan
```

## Prinsip instrumen

- Instrumen default tidak ditimpa oleh auditor.
- Usulan auditor disimpan terpisah dari rumusan default.
- Pertanyaan tidak dihapus, tetapi dapat dikecualikan dengan alasan.
- Instrumen tanpa perubahan langsung dipublikasikan oleh Ketua Auditor.
- Hanya butir yang berubah yang dikirim kepada Verifikator.
- Seluruh keputusan Verifikator menyimpan nilai sebelum dan sesudah perubahan.
- Sumber instrumen dapat tetap memuat standar internal/Dikti dan ISO, tetapi hasil audit mengikuti tujuan utama setiap pertanyaan.

Dokumentasi desain tersedia pada [`docs/AMI_ALIGNMENT.md`](docs/AMI_ALIGNMENT.md).