/** @param {{ expectedRef?: string, linkedRef: string, mode: string, confirmedRef?: string }} options */
export function migrationArguments({ expectedRef, linkedRef, mode, confirmedRef }) {
  if (!/^[a-z]{20}$/.test(expectedRef ?? '')) {
    throw new Error('Set SUPABASE_DEV_PROJECT_REF to the explicitly approved development project ref.');
  }
  if (linkedRef !== expectedRef) throw new Error('Linked project differs from approved dev project; refusing migration.');
  if (!['dry-run', 'apply'].includes(mode)) throw new Error('Use dry-run or apply only.');
  if (mode === 'apply' && confirmedRef !== expectedRef) {
    throw new Error('Set CONFIRM_SUPABASE_DEV_PROJECT_REF to the approved ref before applying.');
  }
  // Never load seed data, custom roles or vault secrets as part of an app upgrade.
  return ['db', 'push', '--linked', '--skip-vault', ...(mode === 'dry-run' ? ['--dry-run'] : [])];
}
