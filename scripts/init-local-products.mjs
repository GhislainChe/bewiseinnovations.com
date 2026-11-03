import {localSql} from './local-database.mjs';
import {productInitializationSql} from './initial-products.mjs';
if(process.env.BEWISE_TEST_DATABASE_CONTAINER)throw new Error('Use the normal local development container.');
try{console.log(await localSql(productInitializationSql()));}catch{console.error('Local draft initialization failed; no hosted operation or automatic retry.');process.exitCode=1;}
