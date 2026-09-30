import { getDaySchedule, isValidDateString } from '@/lib/slots';
import { jsonError, jsonOk } from '@/lib/api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date') ?? '';
  if (!isValidDateString(date)) {
    return jsonError('Parameter date wajib format YYYY-MM-DD', 400);
  }
  const schedule = await getDaySchedule(date);
  return jsonOk({ schedule });
}
