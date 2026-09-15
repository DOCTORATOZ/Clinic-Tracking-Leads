import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const readOption = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const hasFlag = (name) => args.includes(name);
const email = readOption('--email')?.trim().toLowerCase();
const userId = readOption('--user-id')?.trim();
const actorUserId = readOption('--actor-user-id')?.trim();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message) { console.error(`\nError: ${message}\n`); process.exitCode = 1; }

if ((email && userId) || (!email && !userId)) {
  fail('Use exactly one of --email <email> or --user-id <uuid>.');
} else if (userId && !uuidPattern.test(userId)) {
  fail('--user-id must be a valid UUID.');
} else if (actorUserId && !uuidPattern.test(actorUserId)) {
  fail('--actor-user-id must be a valid UUID.');
} else if (!hasFlag('--confirm')) {
  fail('This changes platform access. Review the target, then run again with --confirm.');
} else if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  fail('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in the local environment.');
} else {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let targetUser;
  if (userId) {
    const { data, error } = await client.auth.admin.getUserById(userId);
    if (error || !data.user) fail(error?.message ?? 'Auth user not found.');
    else targetUser = data.user;
  } else {
    for (let page = 1; page <= 100 && !targetUser; page += 1) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) { fail(error.message); break; }
      targetUser = data.users.find((user) => user.email?.toLowerCase() === email);
      if (data.users.length < 1000) break;
    }
    if (!targetUser && !process.exitCode) fail(`No Supabase Auth user found for ${email}. Create the Auth user first.`);
  }

  if (targetUser) {
    const { data: existing, error: existingError } = await client
      .from('system_administrators')
      .select('user_id')
      .eq('user_id', targetUser.id)
      .maybeSingle();
    if (existingError) fail(existingError.message);
    else {
      const values = existing
        ? { active: true, revoked_at: null, revoked_by: null, revocation_reason: null }
        : { user_id: targetUser.id, active: true, created_by: actorUserId ?? null };
      const query = existing
        ? client.from('system_administrators').update(values).eq('user_id', targetUser.id)
        : client.from('system_administrators').insert(values);
      const { error } = await query;
      if (error) fail(error.message);
      else console.log(`System Admin is active: ${targetUser.email ?? targetUser.id} (${targetUser.id})`);
    }
  }
}
