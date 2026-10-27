import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backupExpectedVersions,verifyRestoredCatalog} from './logical-backup-expectations.mjs';
test('restore accepts exactly the reviewed two/three/four migration prefixes',()=>{
  for(const count of [2,3,4]) {
    const versions=['20261021010000','20261021010100','20261023010000','20261026010000'].slice(0,count);
    const expected=backupExpectedVersions('--expected-migrations='+versions.join(','));
    verifyRestoredCatalog({postgres_major:17,rbac_tables:6,roles:4,permissions:18,mappings:31,migration_versions:versions,
      auth_security_tables:count>=3?2:0,auth_security_rls:count>=3?2:0,mfa_policies:count===4?6:0,mfa_helper:count===4},expected);
  }
});
test('restore rejects missing or additional history, disabled RLS and incorrect catalogs',()=>{
  const expected=backupExpectedVersions('--expected-migrations=20261021010000,20261021010100,20261023010000');
  const valid={postgres_major:17,rbac_tables:6,roles:4,permissions:18,mappings:31,migration_versions:expected,auth_security_tables:2,auth_security_rls:2,mfa_policies:0,mfa_helper:false};
  for(const change of [{migration_versions:expected.slice(0,2)},{migration_versions:[...expected,'20261026010000']},{auth_security_rls:1},{mappings:32},{mfa_policies:6},{mfa_helper:true}]) assert.throws(()=>verifyRestoredCatalog({...valid,...change},expected));
  for(const value of ['--expected-migrations=20261023010000','--expected-migrations=20261021010000,99999999999999','--unexpected']) assert.throws(()=>backupExpectedVersions(value));
});
