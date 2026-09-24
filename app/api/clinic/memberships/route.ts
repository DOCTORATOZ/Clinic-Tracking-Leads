import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireClinicContext, requireRole } from '@/lib/auth/context';
import { apiErrorResponse } from '@/lib/http/api-error';

const clinicRoles = new Set(['viewer', 'nurse', 'care_coordinator', 'clinic_admin']);

export async function GET() {
  try {
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client);
    requireRole(context, ['clinic_admin']);
    // The route guard above is the authorization boundary. Use the server-only
    // client here because the membership/invitation RLS policy cannot safely
    // expose every staff record through the browser session.
    const admin = createSupabaseAdminClient();
    const [{ data: memberships, error: membershipError }, { data: invitations, error: invitationError }] = await Promise.all([
      admin.from('clinic_memberships').select('user_id,display_name,role,active,created_at').eq('clinic_id', context.clinicId).order('created_at'),
      admin.from('membership_invitations').select('id,email,role,status,created_at,failure_reason').eq('clinic_id', context.clinicId).order('created_at', { ascending: false }),
    ]);
    if (membershipError) throw new Error(membershipError.message); if (invitationError) throw new Error(invitationError.message);
    return NextResponse.json({ memberships: memberships ?? [], invitations: invitations ?? [] });
  } catch (error) { return apiErrorResponse(error, 'Unable to load memberships'); }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { email?: string; role?: string; displayName?: string };
    if (!input.email || !input.role || !clinicRoles.has(input.role)) throw new Error('INVALID_INVITATION_INPUT');
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client);
    requireRole(context, ['clinic_admin']);
    const admin = createSupabaseAdminClient();
    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(input.email, { data: { display_name: input.displayName?.trim() || input.email } });
    if (inviteError || !invite.user) throw new Error(inviteError?.message ?? 'INVITATION_FAILED');
    const { error: membershipError } = await admin.from('clinic_memberships').upsert({ clinic_id: context.clinicId, user_id: invite.user.id, role: input.role, display_name: input.displayName?.trim() || input.email, active: true }, { onConflict: 'clinic_id,user_id' });
    if (membershipError) throw membershipError;
    const invitation = { clinic_id: context.clinicId, email: input.email.toLowerCase(), role: input.role, status: 'invited', invited_by: context.userId, auth_user_id: invite.user.id };
    const { data: existingInvitation, error: existingInvitationError } = await admin.from('membership_invitations').select('id').eq('clinic_id', context.clinicId).eq('email', invitation.email).eq('status', 'invited').maybeSingle();
    if (existingInvitationError) throw existingInvitationError;
    const { error: invitationError } = existingInvitation
      ? await admin.from('membership_invitations').update(invitation).eq('id', existingInvitation.id)
      : await admin.from('membership_invitations').insert(invitation);
    if (invitationError) throw invitationError;
    const { error: auditError } = await admin.from('audit_events').insert({ clinic_id: context.clinicId, entity_type: 'membership_invitation', entity_id: invite.user.id, action: 'membership.invited', actor_id: context.userId, after_data: { email: input.email.toLowerCase(), role: input.role } });
    if (auditError) throw auditError;
    return NextResponse.json({ id: invite.user.id }, { status: 201 });
  } catch (error) { return apiErrorResponse(error, 'Unable to invite user'); }
}

export async function PATCH(request: Request) {
  try {
    const input = await request.json() as { userId?: string; role?: string; active?: boolean; reason?: string };
    if (!input.userId || !input.role || !clinicRoles.has(input.role) || typeof input.active !== 'boolean') throw new Error('INVALID_MEMBERSHIP_INPUT');
    const client = await createSupabaseServerClient(); const context = await requireClinicContext(client);
    requireRole(context, ['clinic_admin']);
    const { error } = await client.rpc('update_clinic_membership', { target_user: input.userId, next_role: input.role, next_active: input.active, change_reason: input.reason ?? null });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) { return apiErrorResponse(error, 'Unable to update membership'); }
}
