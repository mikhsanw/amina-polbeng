export const ROLES = ['SUPER_ADMIN','ADMIN_MUTU','P4MP','AUDITOR','KETUA_AUDITOR','AUDITEE','KEPALA_UNIT','VERIFIKATOR','PIMPINAN'] as const;
export type RoleCode = typeof ROLES[number];
export interface ApiResult<T> { data: T; meta?: Record<string, unknown> }
