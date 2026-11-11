import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentUser } from '@/lib/user-auth';

/** Profil pemain dari sesi berjalan (dipakai guard `/booking` & `/riwayat`). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError('Masuk ke akun terlebih dahulu', 401);
  return jsonOk({ user });
}
