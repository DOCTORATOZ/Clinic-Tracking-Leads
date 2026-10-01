import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { updatePatient } from '@/modules/workflow/service';
import { apiErrorResponse } from '@/lib/http/api-error';
export async function GET(_request: Request, { params }: { params: Promise<{ patientId: string }> }) {
  try {
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client); const { patientId } = await params;
    const { data, error } = await client.from('patients').select('id,full_name,hn_normalized,phone_normalized,social_platform,social_account,representative_name,representative_relationship,contact_permission,updated_at').eq('clinic_id',context.clinicId).eq('id',patientId).maybeSingle();
    if (error) throw error; if (!data) throw new Error('PATIENT_NOT_FOUND');
    const contacts=await client.from('patient_contacts').select('id,direction,channel,summary,occurred_at,recorded_by').eq('clinic_id',context.clinicId).eq('patient_id',patientId).order('occurred_at',{ascending:false}).limit(100);
    if (contacts.error) throw contacts.error;
    return NextResponse.json({patient:data,contacts:contacts.data});
  } catch(error) {return apiErrorResponse(error,'ไม่สามารถโหลดบุคคลได้');}
}
export async function PATCH(request: Request, { params }: { params: Promise<{ patientId: string }> }) { try { const client = await createSupabaseServerClient(); const { patientId } = await params; return NextResponse.json(await updatePatient(client, await requireClinicContext(client), patientId, await request.json())); } catch (error) { return apiErrorResponse(error, 'Unable to update patient'); } }
