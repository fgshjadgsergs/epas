/**
 * Baseline role codes. Roles themselves live in the `roles` DB table (see
 * prisma/seed.ts) so new roles can be added later without code changes —
 * this list only documents/types the roles guards currently know about.
 */
export const ROLE_CODES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CONTENT_MANAGER: 'CONTENT_MANAGER',
  CUSTOMER: 'CUSTOMER',
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const ADMIN_ROLE_CODES: RoleCode[] = [
  ROLE_CODES.SUPER_ADMIN,
  ROLE_CODES.ADMIN,
  ROLE_CODES.MANAGER,
  ROLE_CODES.CONTENT_MANAGER,
];

/** Roles allowed to read/manage any user's files (not just their own). */
export const FILE_MANAGE_ROLE_CODES: RoleCode[] = [
  ROLE_CODES.SUPER_ADMIN,
  ROLE_CODES.ADMIN,
  ROLE_CODES.MANAGER,
];
