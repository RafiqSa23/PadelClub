/** Util nomor HP Indonesia — aman dipakai client maupun server (tanpa dep Next).
 *
 * Menerima `08…`, `628…`, `+628…`, maupun `812…` (tanpa prefix — dianggap
 * nomor Indonesia karena kolom input sudah berawalan +62).
 */

export function normalizePhone(input: string): string {
  let p = input.replace(/[\s\-.()]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = `62${p.slice(1)}`;
  else if (/^8\d+$/.test(p)) p = `62${p}`;
  return p;
}

export function isValidPhone(input: string): boolean {
  const p = normalizePhone(input);
  return /^62\d{8,14}$/.test(p);
}
