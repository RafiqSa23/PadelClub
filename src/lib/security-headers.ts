/**
 * Header keamanan respons (ADR 0015). Dipasang global lewat `next.config.ts`.
 *
 * CSP sengaja dibatasi ke directive yang tidak memblokir aset runtime:
 * Midtrans Snap memuat script + iframe lintas origin, sedangkan `script-src`
 * penuh untuk Next.js butuh nonce per request. Directive di bawah tetap
 * menutup clickjacking, plugin embedding, dan pembajakan `<base>`/form action.
 */
export interface SecurityHeader {
  key: string;
  value: string;
}

export const CONTENT_SECURITY_POLICY = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

export function securityHeaders(options: { isProduction?: boolean } = {}): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Kamera dipakai scanner gate di origin sendiri; sensor lain tidak perlu.
    { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  ];

  // HSTS hanya di produksi: dev berjalan di http://localhost.
  if (options.isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    });
  }

  return headers;
}
