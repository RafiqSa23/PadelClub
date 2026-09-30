import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { closures } from '@/db/schema';
import { jsonError, jsonOk } from '@/lib/api';
import { getCurrentAdmin } from '@/lib/admin-auth';

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
  });
  if (deleted.length === 0) return jsonError('Closure tidak ditemukan', 404);
  return jsonOk({ deleted: deleted[0] });
}
