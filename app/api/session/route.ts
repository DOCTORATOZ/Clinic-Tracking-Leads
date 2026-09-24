import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/http/api-error';

type Membership = { clinic_id: string; clinic_name: string; role: string; selected: boolean };

export async function GET() {
  try {
    const client = await createSupabaseServerClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) throw new Error('UNAUTHENTICATED');
    const [{ data: clinics, error: clinicsError }, { data: activeClinicId }, { data: systemAdmin }] = await Promise.all([
      client.rpc('list_my_active_clinics'),
      client.rpc('current_clinic_id'),
      client.rpc('is_system_admin'),
    ]);
    if (clinicsError) throw clinicsError;
    const memberships = (clinics ?? []) as Membership[];
    const active = memberships.find((item) => item.clinic_id === activeClinicId);
    return NextResponse.json({
      user: { id: user.id, email: user.email ?? null },
      systemAdmin: Boolean(systemAdmin),
      memberships,
      activeClinic: active ? { id: active.clinic_id, name: active.clinic_name, role: active.role } : null,
    });
  } catch (error) { return apiErrorResponse(error, 'Unable to load session'); }
}
