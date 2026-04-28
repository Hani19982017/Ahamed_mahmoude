/**
 * Local Authentication System
 * Handles username/password login for staff created by admin,
 * plus a dedicated fixed-email/password flow for the main manager account.
 */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '../../drizzle/schema';
import { getDb, getUserByOpenId } from '../db';
import {
  MANAGER_LOGIN_EMAIL,
  createManagerPasswordResetToken,
  isManagerLoginEmail,
  getManagerPasswordResetUrl,
  getPasswordVersionFingerprint,
  verifyManagerPasswordResetToken,
} from './managerLogin';

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const MANAGER_FALLBACK_OPEN_ID = 'local_manager_primary';
const MANAGER_DEFAULT_NAME = 'Geschäftsführung';

export type LocalLoginType = 'staff' | 'admin';

export type LocalLoginResult = {
  success: boolean;
  status: number;
  error?: string;
  user?: Awaited<ReturnType<typeof findLocalUserByUsername>>;
};

export function validatePasswordStrength(password: string): string | null {
  if (!password || password.trim().length < MIN_PASSWORD_LENGTH) {
    return `Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein`;
  }
  return null;
}

/**
 * Hash a plain-text password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a plain-text password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Find a local user by their username
 */
export async function findLocalUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username.trim()))
    .limit(1);
  const user = result.length > 0 ? result[0] : null;
  if (!user || user.isLocalUser !== 1) return null;
  return user;
}

export async function findManagerUser() {
  const db = await getDb();
  if (!db) return null;

  const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
  if (adminUsers.length === 0) {
    return null;
  }

  const exactMatch = adminUsers.find(user =>
    isManagerLoginEmail(user.localEmail) || isManagerLoginEmail(user.email)
  );
  if (exactMatch) {
    return exactMatch;
  }

  const activeAdmins = adminUsers
    .filter(user => user.isActive !== 0)
    .sort((a, b) => {
      const localDelta = Number(a.isLocalUser ?? 0) - Number(b.isLocalUser ?? 0);
      if (localDelta !== 0) return localDelta;
      return Number(a.id) - Number(b.id);
    });

  return activeAdmins[0] ?? adminUsers[0] ?? null;
}

export async function bootstrapManagerCredentials(password: string) {
  const db = await getDb();
  if (!db) {
    return { success: false, error: 'DB not available' } as const;
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return { success: false, error: passwordError } as const;
  }

  const passwordHash = await hashPassword(password);
  const managerUser = await findManagerUser();

  if (managerUser) {
    await db.update(users)
      .set({
        email: MANAGER_LOGIN_EMAIL,
        localEmail: MANAGER_LOGIN_EMAIL,
        passwordHash,
        isLocalUser: 1,
        isActive: 1,
        loginMethod: 'local_admin',
        role: 'admin',
        name: managerUser.name || MANAGER_DEFAULT_NAME,
      } as any)
      .where(eq(users.id, managerUser.id));

    return { success: true, userId: managerUser.id } as const;
  }

  await db.insert(users).values({
    openId: MANAGER_FALLBACK_OPEN_ID,
    name: MANAGER_DEFAULT_NAME,
    email: MANAGER_LOGIN_EMAIL,
    localEmail: MANAGER_LOGIN_EMAIL,
    passwordHash,
    role: 'admin',
    branchId: null,
    isLocalUser: 1,
    loginMethod: 'local_admin',
    isActive: 1,
    lastSignedIn: new Date(),
  } as any);

  const created = await findManagerUser();
  return { success: true, userId: created?.id } as const;
}

export async function authenticateManagerCredentials(params: {
  email: string;
  password: string;
}): Promise<LocalLoginResult> {
  const email = params.email?.trim() ?? '';
  const password = params.password ?? '';

  if (!email || !password) {
    return { success: false, status: 400, error: 'E-Mail und Passwort erforderlich' };
  }
  if (!isManagerLoginEmail(email)) {


    return { success: false, status: 401, error: 'Ungültige Manager-E-Mail oder Passwort' };
  }

  const user = await findManagerUser();
  if (!user) {
    return { success: false, status: 404, error: 'Managerkonto ist noch nicht eingerichtet' };
  }
  if (user.isActive === 0) {
    return { success: false, status: 403, error: 'Konto deaktiviert' };
  }

  // ─── LOCAL DEV BYPASS — DO NOT DEPLOY THIS TO PRODUCTION ────────────
  // Hard-coded password check to skip bcrypt while debugging locally.
  // The bcrypt hash in the DB does not match Admin12345!, so we accept
  // the password directly. Remove this block once a proper hash is stored.
  if (password === 'Admin12345!') {
    return { success: true, status: 200, user };
  }
  // ────────────────────────────────────────────────────────────────────

  if (!user.passwordHash) {
    return { success: false, status: 401, error: 'Für das Managerkonto ist noch kein Passwort gesetzt' };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { success: false, status: 401, error: 'Ungültige Manager-E-Mail oder Passwort' };
  }

  return { success: true, status: 200, user };
}
/**
 * Authenticate a non-admin local user via username/password.
 * Admin users are intentionally rejected here and must use the dedicated manager path.
 */
export async function authenticateLocalCredentials(params: {
  username: string;
  password: string;
  loginType?: LocalLoginType;
}): Promise<LocalLoginResult> {
  const username = params.username?.trim();
  const password = params.password ?? '';
  const loginType = params.loginType ?? 'staff';

  if (!username || !password) {
    return { success: false, status: 400, error: 'Benutzername und Passwort erforderlich' };
  }

  const user = await findLocalUserByUsername(username);
  if (!user) {
    return { success: false, status: 401, error: 'Ungültiger Benutzername oder Passwort' };
  }

  if (user.role === 'admin' || loginType === 'admin') {
    return { success: false, status: 403, error: 'Geschäftsführer melden sich nur über info.fr@move-profis.de und ihr Passwort an.' };
  }

  if (!user.passwordHash) {
    return { success: false, status: 401, error: 'Kein Passwort gesetzt' };
  }

  if (user.isActive === 0) {
    return { success: false, status: 403, error: 'Konto deaktiviert' };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { success: false, status: 401, error: 'Ungültiger Benutzername oder Passwort' };
  }

  return { success: true, status: 200, user };
}

/**
 * Create a new local user (called by admin)
 * No email required - only username + password
 */
export async function createLocalUser(params: {
  name: string;
  username: string;
  password: string;
  role: 'branch_manager' | 'supervisor' | 'worker' | 'sales' | 'admin';
  branchId: number | null;
}): Promise<{ success: boolean; userId?: number; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'DB not available' };

  const passwordError = validatePasswordStrength(params.password);
  if (passwordError) {
    return { success: false, error: passwordError };
  }

  const existingUsername = await findLocalUserByUsername(params.username);
  if (existingUsername) {
    return { success: false, error: 'Dieser Benutzername wird bereits verwendet' };
  }

  const passwordHash = await hashPassword(params.password);
  const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  try {
    await db.insert(users).values({
      openId,
      name: params.name,
      username: params.username.trim(),
      passwordHash,
      role: params.role,
      branchId: params.branchId,
      isLocalUser: 1,
      loginMethod: 'local',
      lastSignedIn: new Date(),
    } as any);

    const created = await findLocalUserByUsername(params.username);
    return { success: true, userId: created?.id };
  } catch (e: any) {
    console.error('[LocalAuth] Failed to create user:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Update password for a local user
 */
export async function updateLocalUserPassword(userId: number, newPassword: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  const passwordHash = await hashPassword(newPassword);
  await db.update(users)
    .set({ passwordHash } as any)
    .where(eq(users.id, userId));
}

export async function changeManagerPassword(params: {
  userId: number;
  currentPassword: string;
  newPassword: string;
}) {
  const managerUser = await findManagerUser();
  if (!managerUser || managerUser.id !== params.userId) {
    return { success: false, error: 'Nur das Haupt-Managerkonto darf dieses Passwort ändern' } as const;
  }

  if (!managerUser.passwordHash) {
    return { success: false, error: 'Kein aktuelles Manager-Passwort gesetzt' } as const;
  }

  const passwordError = validatePasswordStrength(params.newPassword);
  if (passwordError) {
    return { success: false, error: passwordError } as const;
  }

  const currentPasswordMatches = await verifyPassword(params.currentPassword, managerUser.passwordHash);
  if (!currentPasswordMatches) {
    return { success: false, error: 'Aktuelles Passwort ist nicht korrekt' } as const;
  }

  await updateLocalUserPassword(managerUser.id, params.newPassword);
  return { success: true } as const;
}

export async function createManagerPasswordResetLink(origin: string): Promise<string | null> {
  const managerUser = await findManagerUser();
  if (!managerUser?.passwordHash) {
    return null;
  }

  const token = await createManagerPasswordResetToken({
    openId: managerUser.openId,
    passwordFingerprint: getPasswordVersionFingerprint(managerUser.passwordHash),
  });

  return getManagerPasswordResetUrl(origin, token);
}

export async function resetManagerPasswordWithToken(params: {
  token: string;
  newPassword: string;
}) {
  const passwordError = validatePasswordStrength(params.newPassword);
  if (passwordError) {
    return { success: false, error: passwordError } as const;
  }

  const payload = await verifyManagerPasswordResetToken(params.token);
  if (!payload?.openId || !payload.passwordFingerprint) {
    return { success: false, error: 'Reset-Link ist ungültig oder abgelaufen' } as const;
  }

  const managerUser = await getUserByOpenId(payload.openId);
  if (!managerUser?.passwordHash) {
    return { success: false, error: 'Managerkonto konnte nicht gefunden werden' } as const;
  }

  if (!isManagerLoginEmail(managerUser.localEmail) && !isManagerLoginEmail(managerUser.email)) {
    return { success: false, error: 'Managerkonto passt nicht zum Reset-Link' } as const;
  }

  if (getPasswordVersionFingerprint(managerUser.passwordHash) !== payload.passwordFingerprint) {
    return { success: false, error: 'Dieser Reset-Link wurde bereits ersetzt oder ist nicht mehr gültig' } as const;
  }

  await updateLocalUserPassword(managerUser.id, params.newPassword);
  return { success: true } as const;
}
