import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';

export { MIN_PASSWORD_LENGTH } from './password-constants';

const scrypt = (
  password: string,
  salt: string,
  keylen: number,
  opts?: { N?: number; r?: number; p?: number; maxmem?: number },
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const cb = (err: Error | null, derived: Buffer) => (err ? reject(err) : resolve(derived));
    if (opts) _scrypt(password, salt, keylen, opts, cb);
    else _scrypt(password, salt, keylen, cb);
  });

/** Hash password dengan scrypt (format: scrypt$N$r$p$salt$derived). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$16384$8$1$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts[0] !== 'scrypt' || parts.length !== 6) return false;
  const [, n, r, p, salt, expectedHex] = parts;
  const derived = (await scrypt(password, salt, 64, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 32 * 1024 * 1024,
  })) as Buffer;
  const a = Buffer.from(derived.toString('hex'));
  const b = Buffer.from(expectedHex);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
