export interface JwtPayload {
  sub: string;
  email: string;
  /**
   * Roles at the moment the token was issued. Carried for convenience/logging
   * only — JwtStrategy re-fetches the authoritative roles from the DB on
   * every request, so this is never trusted directly by guards.
   */
  roles: string[];
  /** Must match User.tokenVersion or the token is rejected (forced logout). */
  tokenVersion: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
}
