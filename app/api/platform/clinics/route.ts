import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireSystemAdmin } from '@/lib/auth/context';
import { apiErrorResponse } from '@/lib/http/api-error';

export async function GET() {
  try {
    const client = await createSupabaseServerClient();
    await requireSystemAdmin(client);
    const { data, error } = await client.from('platform_tenants').select('*').order('name');
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) { return apiErrorResponse(error, 'Unable to load tenants'); }
}

export async function PATCH(request: Request) {
  try {
    const { clinicId, active, reason } = await request.json() as { clinicId?: string; active?: boolean; reason?: string };
    if (!clinicId || typeof active !== 'boolean') throw new Error('INVALID_TENANT_LIFECYCLE_INPUT');
    const client = await createSupabaseServerClient();
    await requireSystemAdmin(client);
    const { error } = await client.rpc('set_tenant_lifecycle', { target_clinic: clinicId, next_active: active, reason: reason ?? null });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return apiErrorResponse(error, 'Unable to update tenant'); }
}
