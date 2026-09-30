import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);
  return jsonOk({ admin });
}
