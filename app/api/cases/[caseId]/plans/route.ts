import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext, requireRole } from '@/lib/auth/context';
import { apiErrorResponse } from '@/lib/http/api-error';
import { planCycleActionSchema } from '@/lib/validation/plan-cycles';

export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client);
    requireRole(context, ['clinic_admin', 'care_coordinator', 'nurse']);
    const { caseId } = await params; const input = planCycleActionSchema.parse(await request.json());
    if (input.action !== 'activate') {
      const cycle = await client.from('case_plan_cycles').select('id').eq('id', input.cycleId).eq('case_id', caseId).eq('clinic_id', context.clinicId).maybeSingle();
      if (cycle.error) throw cycle.error;
      if (!cycle.data) throw new Error('FORBIDDEN');
    }
    const { data, error } = input.action === 'activate'
      ? await client.rpc('activate_case_plan', { p_case_id: caseId, p_input: input })
      : input.action === 'preview' ? await client.rpc('preview_plan_anchor', { p_cycle_id: input.cycleId, p_anchor: input.anchorDate })
      : await client.rpc('revise_plan_anchor', { p_cycle_id: input.cycleId, p_input: input });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) { return apiErrorResponse(error, 'ไม่สามารถปรับแผนได้'); }
}
