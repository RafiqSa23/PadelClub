import { createHmac, timingSafeEqual } from 'node:crypto';

export const CUSTOMER_SESSION_COOKIE = 'padel_session';
export const CUSTOMER_SESSION_TTL_SECONDS = 30 * 24 * 3600; // 30 hari

interface CustomerPayload {
  uid: number;
  phone: string;
  exp: number;
}

function getSecret(): string {
  return process.env.SESSION_SECRET ?? 'dev-padel-session-secret-change-me';
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function signCustomerSession(uid: number, phone: string): string {
  const payload: CustomerPayload = {
    uid,
    phone,
    exp: Math.floor(Date.now() / 1000) + CUSTOMER_SESSION_TTL_SECONDS,
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function customerCookieValue(token: string): string {
  return `${CUSTOMER_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${CUSTOMER_SESSION_TTL_SECONDS}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function clearCustomerCookieValue(): string {
  return `${CUSTOMER_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
export function verifyCustomerSession(token: string): CustomerPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', getSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body)) as CustomerPayload;
    if (typeof payload.uid !== 'number' || typeof payload.phone !== 'string') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
