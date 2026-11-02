import { localSql } from './local-database.mjs';
import { catalogInitializationSql } from './approved-services.mjs';
// Fixed local Docker/socket transport; accepts no remote connection argument.
if(process.env.BEWISE_TEST_DATABASE_CONTAINER) throw new Error('Use the normal local development database for catalog initialization.');
try { console.log(await localSql(catalogInitializationSql())); }
catch { console.error('Local catalog initialization failed; transaction rolled back. No automatic retry.');process.exitCode=1; }
