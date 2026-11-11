import { createHash } from 'node:crypto';

export const CUSTOMER_SESSION_COOKIE = 'padel_session';
export const CUSTOMER_SESSION_TTL_SECONDS = 30 * 24 * 3600; // 30 hari

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function customerCookieValue(token: string): string {
  return `${CUSTOMER_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${CUSTOMER_SESSION_TTL_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function clearCustomerCookieValue(): string {
  return `${CUSTOMER_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
