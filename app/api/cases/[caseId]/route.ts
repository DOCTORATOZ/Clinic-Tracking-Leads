import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { updateCase } from '@/modules/workflow/service';
import { getCaseDetail } from '@/modules/operations/read-service';
import { apiErrorResponse } from '@/lib/http/api-error';
export async function PATCH(request: Request, { params }: { params: Promise<{ caseId: string }> }) { try { const client = await createSupabaseServerClient(); const { caseId } = await params; return NextResponse.json(await updateCase(client, await requireClinicContext(client), caseId, await request.json())); } catch (error) { return apiErrorResponse(error, 'Unable to update case'); } }
export async function GET(_request: Request, { params }: { params: Promise<{ caseId: string }> }) { try { const client = await createSupabaseServerClient(); const { caseId } = await params; return NextResponse.json(await getCaseDetail(client, await requireClinicContext(client), caseId)); } catch (error) { return apiErrorResponse(error, 'Unable to load case'); } }
