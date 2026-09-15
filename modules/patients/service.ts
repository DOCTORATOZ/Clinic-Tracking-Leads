import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClinicContext } from '@/lib/auth/context';
import { normalizeHn, normalizePhone } from '@/lib/validation/normalization';
import { writeAuditEvent } from '@/modules/audit/service';

export async function findPatientDuplicates(client: SupabaseClient, context: ClinicContext, input: { hn?: string; phone?: string }) {
  const hn = normalizeHn(input.hn); const phone = normalizePhone(input.phone);
  if (!hn && !phone) return [];
  let query = client.from('patients').select('id, full_name, hn_normalized, phone_normalized, created_at').eq('clinic_id', context.clinicId);
  if (hn && phone) query = query.or(`hn_normalized.eq.${hn},phone_normalized.eq.${phone}`);
  else if (hn) query = query.eq('hn_normalized', hn); else query = query.eq('phone_normalized', phone!);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPatient(client: SupabaseClient, context: ClinicContext, input: {
  fullName: string; hn?: string; phone?: string; email?: string; birthDate?: string;
  preferredContactChannel?: string; doNotContact?: boolean; careContactConsentAt?: string; marketingConsentAt?: string;
}) {
  const { data, error } = await client.from('patients').insert({
    clinic_id: context.clinicId, full_name: input.fullName, hn_normalized: normalizeHn(input.hn),
    phone_normalized: normalizePhone(input.phone), email: input.email, birth_date: input.birthDate,
    preferred_contact_channel: input.preferredContactChannel, do_not_contact: input.doNotContact ?? false,
    care_contact_consent_at: input.careContactConsentAt, marketing_consent_at: input.marketingConsentAt,
    consent_recorded_by: input.careContactConsentAt || input.marketingConsentAt ? context.userId : null,
  }).select().single();
  if (error) throw error;
  if (input.careContactConsentAt || input.marketingConsentAt || input.doNotContact) {
    await writeAuditEvent(client, context, {
      entityType: 'patient',
      entityId: data.id,
      action: 'patient.contact_preferences_recorded',
      afterData: {
        preferredContactChannel: input.preferredContactChannel,
        doNotContact: input.doNotContact ?? false,
        careContactConsentRecorded: Boolean(input.careContactConsentAt),
        marketingConsentRecorded: Boolean(input.marketingConsentAt),
      },
    });
  }
  return data;
}
