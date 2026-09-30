# Penyelarasan SAMI-NONAK dengan Proses AMI Nonakademik

## 1. Tujuan refactor

Refactor ini mengubah aplikasi dari pola CRUD generik menjadi ruang kerja audit berbasis tahapan, keputusan, penugasan, dan jejak perubahan.

## 2. Delapan role

| Role | Fungsi utama |
|---|---|
| SUPER_ADMIN | Konfigurasi sistem, pengguna, role, permission, keamanan, dan pemulihan |
| ADMIN_MUTU | Program audit, workspace, tim, jadwal, monitoring, laporan, dan penutupan |
| P4MP | Pemilik standar, metodologi, dan bank instrumen default |
| AUDITOR | Telaah instrumen, desk review, bukti, kertas kerja, draft temuan, dan pemeriksaan tindak lanjut |
| KETUA_AUDITOR | Pengendalian tim, publikasi instrumen tanpa perubahan, persetujuan kertas kerja dan temuan, keputusan efektivitas, serta laporan |
| AUDITEE | Penilaian mandiri, bukti, klarifikasi, dan tindakan korektif |
| VERIFIKATOR | Verifikasi perubahan instrumen audit terhadap instrumen default |
| PIMPINAN | Dashboard dan laporan eksekutif |

Kepala unit tidak menjadi role terpisah. Pengguna `AUDITEE` yang berwenang mengesahkan unit diberi atribut `isUnitApprover=true`.

## 3. Dua dimensi hasil

### Pencapaian standar

- MELAMPAUI
- TERCAPAI
- TIDAK_TERCAPAI
- BELUM_DIUKUR

### Kesesuaian proses bisnis ISO 9001:2015

- C
- OFI
- OBS
- KTS_MINOR
- KTS_MAYOR
- GP
- NA

Setiap butir diberi `dimension` berdasarkan tujuan pertanyaannya. Pertanyaan yang menilai target, capaian, indikator, realisasi, rasio, atau pengukuran dikelompokkan sebagai pencapaian standar. Pertanyaan yang menilai pelaksanaan dan pengendalian proses dikelompokkan sebagai kesesuaian proses.

## 4. Workflow instrumen

1. Admin Mutu membuat workspace dengan status `FILE_PREPARATION`.
2. Admin Mutu menetapkan Ketua Auditor, Auditor, dan Verifikator.
3. Sistem menolak personel dari unit auditee.
4. Admin Mutu membentuk snapshot instrumen default.
5. Auditor menelaah tanpa mengubah master.
6. Sistem menghitung `changeFlag` dan `changeFields`.
7. Bila tidak berubah, Ketua Auditor langsung mempublikasikan instrumen.
8. Bila berubah, hanya butir berubah yang masuk `PENDING_VERIFICATION`.
9. Verifikator membandingkan nilai default dan usulan, lalu memilih `APPROVE`, `RETURN`, atau `REJECT`.
10. Instrumen terbit menghasilkan record penilaian mandiri.

## 5. Lifecycle kertas kerja

```text
DRAFT → SUBMITTED → APPROVED
               ↘ RETURNED → SUBMITTED
```

Temuan yang terkait pertanyaan hanya dapat dibuat bila terdapat kertas kerja `APPROVED`.

## 6. Tindak lanjut

1. Auditee menyusun koreksi, akar masalah, tindakan korektif, indikator, PIC, dan target.
2. Auditor memeriksa pelaksanaan dan memberi rekomendasi efektivitas.
3. Ketua Auditor menetapkan `EFFECTIVE`, `EFFECTIVE_WITH_MONITORING`, atau `NOT_EFFECTIVE`.
4. Temuan ditutup bila efektif, atau dikembalikan ke implementasi bila tidak efektif.

`VERIFIKATOR` tidak memverifikasi CAPA. Role tersebut khusus memverifikasi usulan perubahan instrumen.

## 7. Master data

Seed tidak lagi membuat 25 pertanyaan generik. Data institusi harus diimpor dari workbook Sistem melalui:

```bash
npm run import:system
```

Importer memanfaatkan:

- `12_UNITS`
- `13_UNIT_FUNCTIONS`
- `14_STANDARDS`
- `15_ISO_CLAUSES`
- `17_QUESTION_BANK`
- `18_Q_UNIT_MAP`
- `24_Q_REQUIREMENT_MAP`
- `28_INTERNAL_STANDARDS`
- `29_FUNCTION_STANDARD_MAP`
- `30_AUDIT_MATRIX`

## 8. Perubahan UI

- Dashboard menampilkan kotak tugas, bukan hanya statistik.
- Workspace mempunyai stepper sembilan tahap.
- Menu disederhanakan sesuai delapan role.
- Instrumen menampilkan perbandingan default dan usulan auditor.
- Penilaian mandiri menggunakan klasifikasi sesuai dimensi pertanyaan.
- Kertas kerja mempunyai status dokumen.
- Istilah proses baru menggunakan KTS, bukan NC.

## 9. Batas implementasi tahap ini

- Register dokumen telah memakai nama dan lokasi PDF, tetapi generator PDF fisik masih perlu disambungkan ke Playwright/Chromium.
- Template master Excel sudah tersedia. Template instrumen per workspace beserta validasi dua tahap masih menjadi pekerjaan lanjutan.
- File bukti baru dapat menggunakan `multipart/form-data`; endpoint Base64 lama sementara dipertahankan agar frontend lama tidak langsung patah.
