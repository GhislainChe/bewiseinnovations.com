/** Authorization decisions are based on verified identity and database rows. */
export type TeamMember = {
  id: string;
  fullName: string;
  roleCodes: string[];
  permissionCodes: string[];
};

export type Profile = { id: string; fullName: string; isActive: boolean };
export type CatalogEntry = { id: string; code: string };

export interface AuthGateway {
  getVerifiedUserId(): Promise<string | null>;
  hasVerifiedAal2(userId: string): Promise<boolean>;
  getProfile(userId: string): Promise<Profile | null>;
  getRoleIds(userId: string): Promise<string[]>;
  getRoles(roleIds: string[]): Promise<CatalogEntry[]>;
  getPermissionIds(roleIds: string[]): Promise<string[]>;
  getPermissions(permissionIds: string[]): Promise<CatalogEntry[]>;
  signInWithPassword(email: string, password: string): Promise<boolean>;
  signOutCurrentSession(): Promise<void>;
}

export class AuthorizationError extends Error {
  constructor() {
    super("Access denied.");
    this.name = "AuthorizationError";
  }
}

/** Authentication may continue through /auth/mfa; this grants no staff access. */
export class MfaRequiredError extends AuthorizationError {}

export async function getCurrentTeamMember(gateway: AuthGateway): Promise<TeamMember | null> {
  const userId = await gateway.getVerifiedUserId();
  if (!userId) return null;
  if (!await gateway.hasVerifiedAal2(userId)) return null;

  const profile = await gateway.getProfile(userId);
  if (!profile || profile.id !== userId || !profile.isActive) return null;

  const roleIds = [...new Set(await gateway.getRoleIds(userId))];
  if (roleIds.length === 0) return null;

  const roles = await gateway.getRoles(roleIds);
  if (roles.length !== roleIds.length || roles.some((role) => !roleIds.includes(role.id))) {
    throw new AuthorizationError();
  }

  const permissionIds = [...new Set(await gateway.getPermissionIds(roleIds))];
  const permissions = permissionIds.length ? await gateway.getPermissions(permissionIds) : [];
  if (
    permissions.length !== permissionIds.length ||
    permissions.some((permission) => !permissionIds.includes(permission.id))
  ) {
    throw new AuthorizationError();
  }

  return {
    id: userId,
    fullName: profile.fullName,
    roleCodes: roles.map((role) => role.code),
    permissionCodes: permissions.map((permission) => permission.code),
  };
}

export async function requireTeamMember(gateway: AuthGateway): Promise<TeamMember> {
  const member = await getCurrentTeamMember(gateway);
  if (!member) throw new AuthorizationError();
  return member;
}

export async function hasPermission(gateway: AuthGateway, code: string): Promise<boolean> {
  const member = await getCurrentTeamMember(gateway);
  return member?.permissionCodes.includes(code) ?? false;
}

export async function requirePermission(gateway: AuthGateway, code: string): Promise<TeamMember> {
  const member = await requireTeamMember(gateway);
  if (!member.permissionCodes.includes(code)) throw new AuthorizationError();
  return member;
}

/** Do not retain an Auth session for a user who has not been provisioned as staff. */
export async function signInTeamMember(
  gateway: AuthGateway,
  email: string,
  password: string,
): Promise<TeamMember | null> {
  const signedIn = await gateway.signInWithPassword(email, password);
  if (!signedIn) {
    // A failed attempt must not leave an earlier account signed in as the
    // apparent result of this attempt. Avoid signOut when no session exists.
    if (await gateway.getVerifiedUserId()) await gateway.signOutCurrentSession();
    return null;
  }

  const verifiedId = await gateway.getVerifiedUserId();
  if (verifiedId && !await gateway.hasVerifiedAal2(verifiedId)) throw new MfaRequiredError();

  try {
    const member = await getCurrentTeamMember(gateway);
    if (member) return member;
  } catch {
    await gateway.signOutCurrentSession();
    throw new AuthorizationError();
  }

  await gateway.signOutCurrentSession();
  return null;
}

export async function signOutTeamMember(gateway: AuthGateway): Promise<void> {
  await gateway.signOutCurrentSession();
}

/** Use only same-origin relative paths for future invite/recovery callbacks. */
export function safeAuthReturnPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return fallback;
  }

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes("\\")) return fallback;
    const url = new URL(value, "https://auth.local.invalid");
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
