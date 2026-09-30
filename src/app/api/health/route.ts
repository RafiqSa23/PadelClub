import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: 'connected' });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        db: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}