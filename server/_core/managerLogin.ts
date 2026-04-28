import { createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { ENV } from './env';

export const MANAGER_LOGIN_EMAIL = 'info.fr@move-profis.de';
const MANAGER_RESET_PURPOSE = 'manager-password-reset';
const MANAGER_RESET_TTL_SECONDS = 15 * 60;

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

function getSecretKey() {
  return new TextEncoder().encode(ENV.cookieSecret || 'manager-reset-fallback-secret');
}

export function normalizeManagerEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isManagerLoginEmail(email: string | null | undefined): boolean {
  return normalizeManagerEmail(email) === MANAGER_LOGIN_EMAIL;
}

export function getPasswordVersionFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex');
}

export async function createManagerPasswordResetToken(payload: {
  openId: string;
  passwordFingerprint: string;
}): Promise<string> {
  return new SignJWT({
    purpose: MANAGER_RESET_PURPOSE,
    email: MANAGER_LOGIN_EMAIL,
    openId: payload.openId,
    passwordFingerprint: payload.passwordFingerprint,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${MANAGER_RESET_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyManagerPasswordResetToken(token: string): Promise<{
  openId: string;
  passwordFingerprint: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
    });

    const purpose = typeof payload.purpose === 'string' ? payload.purpose : '';
    const email = typeof payload.email === 'string' ? payload.email : '';
    const openId = typeof payload.openId === 'string' ? payload.openId : '';
    const passwordFingerprint = typeof payload.passwordFingerprint === 'string' ? payload.passwordFingerprint : '';

    if (purpose !== MANAGER_RESET_PURPOSE || email !== MANAGER_LOGIN_EMAIL || !openId || !passwordFingerprint) {
      return null;
    }

    return { openId, passwordFingerprint };
  } catch {
    return null;
  }
}

export function getManagerPasswordResetUrl(origin: string, token: string): string {
  const url = new URL('/login', normalizeOrigin(origin));
  url.searchParams.set('adminResetToken', token);
  return url.toString();
}
