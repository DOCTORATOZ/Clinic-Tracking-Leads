import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireClinicContext } from '@/lib/auth/context';
import { transitionTask } from '@/modules/workflow/service';
import { apiErrorResponse } from '@/lib/http/api-error';
export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) { try { const client = await createSupabaseServerClient(); const { taskId } = await params; return NextResponse.json(await transitionTask(client, await requireClinicContext(client), taskId, await request.json())); } catch (error) { return apiErrorResponse(error, 'Unable to update follow-up task'); } }
