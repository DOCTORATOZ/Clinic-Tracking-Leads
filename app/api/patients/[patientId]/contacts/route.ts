import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext, requireRole } from '@/lib/auth/context';
import { apiErrorResponse } from '@/lib/http/api-error';
const schema=z.object({requestId:z.uuid(),caseId:z.uuid().optional(),direction:z.enum(['incoming','outgoing']),channel:z.enum(['phone','line_oa','facebook','tiktok','other']),summary:z.string().trim().min(1).max(5000),occurredAt:z.iso.datetime()});
export async function POST(request:Request,{params}:{params:Promise<{patientId:string}>}) {
  try {const client=await createSupabaseServerClient();const context=await requireClinicContext(client);requireRole(context,['clinic_admin','care_coordinator','nurse']);const {patientId}=await params;const input=schema.parse(await request.json());
    const {data,error}=await client.rpc('record_patient_contact',{p_patient_id:patientId,p_input:input});if(error)throw error;return NextResponse.json(data,{status:201});
  }catch(error){return apiErrorResponse(error,'ไม่สามารถบันทึกการติดต่อได้');}
}
