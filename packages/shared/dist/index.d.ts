export declare const ROLES: readonly ["SUPER_ADMIN", "ADMIN_MUTU", "P4MP", "AUDITOR", "KETUA_AUDITOR", "AUDITEE", "KEPALA_UNIT", "VERIFIKATOR", "PIMPINAN"];
export type RoleCode = typeof ROLES[number];
export interface ApiResult<T> {
    data: T;
    meta?: Record<string, unknown>;
}
