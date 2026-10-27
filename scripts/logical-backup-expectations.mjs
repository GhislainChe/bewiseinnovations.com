const versions=['20261021010000','20261021010100','20261023010000','20261026010000'];
export function backupExpectedVersions(argument) {
  const selected=argument===undefined ? versions.slice(0,2) : argument.startsWith('--expected-migrations=') ? argument.slice('--expected-migrations='.length).split(',') : [];
  if(selected.length<2 || selected.length>4 || selected.some((v,i)=>v!==versions[i])) throw new Error('Expected reviewed migration prefix required');
  return selected;
}
export function verifyRestoredCatalog(counts,expected) {
  if(counts.postgres_major!==17 || counts.rbac_tables!==6 || counts.roles!==4 || counts.permissions!==18 || counts.mappings!==31 ||
    JSON.stringify(counts.migration_versions)!==JSON.stringify(expected) ||
    counts.auth_security_tables!==(expected.length>=3?2:0) ||
    counts.auth_security_rls!==(expected.length>=3?2:0) ||
    counts.mfa_policies!==(expected.length===4?6:0) || counts.mfa_helper!==(expected.length===4)) throw new Error('Unexpected restored catalog');
}
