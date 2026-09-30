import { NextResponse } from 'next/server';

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, message, ...extra }, { status });
}

export function jsonOk<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

/** Normalisasi nomor HP Indonesia ke format 62... (longgar, untuk MVP). */
export function normalizePhone(input: string): string {
  let p = input.replace(/[\s\-().]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = `62${p.slice(1)}`;
  return p;
}

export function isValidPhone(input: string): boolean {
  const p = normalizePhone(input);
  return /^62\d{8,14}$/.test(p);
}
