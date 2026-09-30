# Arsitektur

Monorepo terdiri dari Next.js (`apps/web`), NestJS REST API (`apps/api`), shared TypeScript contracts, Prisma, dan MySQL 8. Seluruh otorisasi diperiksa server-side. `AuditWorkspace` mengisolasi transaksi berdasarkan unit dan tahun.
