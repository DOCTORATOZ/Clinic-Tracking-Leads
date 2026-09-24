import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { updatePatient } from '@/modules/workflow/service';
import { apiErrorResponse } from '@/lib/http/api-error';
export async function PATCH(request: Request, { params }: { params: Promise<{ patientId: string }> }) { try { const client = await createSupabaseServerClient(); const { patientId } = await params; return NextResponse.json(await updatePatient(client, await requireClinicContext(client), patientId, await request.json())); } catch (error) { return apiErrorResponse(error, 'Unable to update patient'); } }
