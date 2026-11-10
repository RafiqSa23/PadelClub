import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { closures } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';
import { bumpSlotsVersion } from '@/lib/slot-status';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) return jsonError('Unauthorized', 401);

  const { id } = await params;
  const closureId = Number(id);
  if (!Number.isInteger(closureId)) return jsonError('ID closure tidak valid', 400);

  const deleted = await db.delete(closures).where(eq(closures.id, closureId)).returning({
    id: closures.id,
    closureDate: closures.closureDate,
  });
  if (deleted.length === 0) return jsonError('Closure tidak ditemukan', 404);
  bumpSlotsVersion(deleted[0].closureDate);
  return jsonOk({ deleted: { id: deleted[0].id } });
}
