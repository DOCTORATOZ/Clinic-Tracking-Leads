import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { createCase } from '@/modules/leads/service';

export async function POST(request: Request) {
  try {
    const client = await createSupabaseServerClient();
    const context = await requireClinicContext(client);
    return NextResponse.json(await createCase(client, context, await request.json()), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to create case' }, { status: 400 });
  }
}
