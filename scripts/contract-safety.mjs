// Fixed, isolated test project. Never accept the Care D port or a remote host.
export const CONTRACT_API_URL = 'http://127.0.0.1:55321';

export function assertContractTarget(url) {
  if (url !== CONTRACT_API_URL) {
    throw new Error('Refusing non-contract target: use the isolated local test project on port 55321.');
  }
}

export async function insertMissingFixtures(client, table, rows, onConflict = 'id') {
  // ON CONFLICT DO NOTHING preserves archived versions, defaults and history.
  const { error } = await client.from(table).upsert(rows, { onConflict, ignoreDuplicates: true });
  if (error) throw error;
}
