import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { assignCase } from '@/modules/workflow/service';
import { apiErrorResponse } from '@/lib/http/api-error';
export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) { try { const client = await createSupabaseServerClient(); const { caseId } = await params; return NextResponse.json(await assignCase(client, await requireClinicContext(client), caseId, await request.json())); } catch (error) { return apiErrorResponse(error, 'Unable to assign case'); } }
