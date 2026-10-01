import { NextResponse } from 'next/server';
import { requireClinicContext } from '@/lib/auth/context';
import { apiErrorResponse } from '@/lib/http/api-error';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { findPatientDuplicates } from '@/modules/patients/service';
import { listPatientDirectory } from '@/modules/operations/read-service';
import { normalizeHn, normalizePhone } from '@/lib/validation/normalization';

export async function GET(request: Request) {
  try {
    const client = await createSupabaseServerClient();
    const context = await requireClinicContext(client);
    const url = new URL(request.url);
    if (url.searchParams.get('matches') === 'true') {
      const { data, error } = await client.rpc('intake_patient_directory', {
        p_matches_only: true, p_hn: normalizeHn(url.searchParams.get('hn')), p_phone: normalizePhone(url.searchParams.get('phone')),
        p_social_platform: url.searchParams.get('socialPlatform'), p_social_account: url.searchParams.get('socialAccount'),
      });
      if (error) throw error;
      return NextResponse.json(data);
    }
    const hn = url.searchParams.get('hn') ?? undefined; const phone = url.searchParams.get('phone') ?? undefined;
    if (hn || phone) return NextResponse.json(await findPatientDuplicates(client, context, { hn, phone }));
    return NextResponse.json(await listPatientDirectory(client, context, url.searchParams.get('query') ?? undefined));
  } catch (error) { return apiErrorResponse(error, 'Unable to search patients'); }
}
