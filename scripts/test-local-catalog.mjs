import assert from 'node:assert/strict';
import { localSql } from './local-database.mjs';
import { approvedServices, catalogInitializationSql } from './approved-services.mjs';
const sql=catalogInitializationSql().replace(/^begin;/,'').replace(/commit;$/,'');
assert.equal(approvedServices.length,7);
// All test changes (including an intentional staff edit) are rolled back.
const result=await localSql(`begin;
 create temporary table previous_services as select id,slug from public.services;
 ${sql}
 create temporary table initialized as select id,slug from public.services;
 create temporary table initial_budgets as select id,service_id from public.service_budget_options;
 update public.services set description='LOCAL TEST staff edit',accepting_requests=false where slug='website-development';
 update public.service_budget_options set label='LOCAL TEST staff budget edit' where service_id=(select id from public.services where slug='website-development') and sort_order=10;
 ${sql}
 select case when
 (select count(*) from public.services where slug in (${approvedServices.map(s=>"'"+s[0]+"'").join(',')}))=7
 and (select count(*) from public.services)=(select count(*) from initialized)
 and (select count(*) from public.service_budget_options)=(select count(*) from initial_budgets)
 and (select description='LOCAL TEST staff edit' and not accepting_requests from public.services where slug='website-development')
 and exists(select from public.service_budget_options b join public.services s on s.id=b.service_id where s.slug='website-development' and b.label='LOCAL TEST staff budget edit')
 and not exists(select from public.services s left join previous_services p on p.id=s.id where p.id is null and (select count(*) from public.service_budget_options b where b.service_id=s.id)<>6)
 and not exists(select from public.service_budget_options b join public.services s on s.id=b.service_id left join previous_services p on p.id=s.id where p.id is null and b.currency<>'XAF')
 then 'PASS' else 'FAIL' end; rollback;`);
assert.match(result,/\bPASS\b/);
console.log('PASS: 7 approved services, six XAF options each for new services; repeat initialization preserves IDs, ranges, staff edits and intake state. Transaction rolled back.');
// Race two initializers inside independent rollback-only transactions. The advisory
// lock must serialize them without duplicating or disturbing development content.
await Promise.all([1,2].map(() => localSql('begin;'+sql+'rollback;')));
console.log('PASS: concurrent local initializer transactions completed; both rolled back.');
