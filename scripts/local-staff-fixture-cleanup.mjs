// Fixed local Docker only. Exact synthetic fixture guards; never an application API.
import {localSql} from './local-database.mjs';
import {resolve,sep} from 'node:path';
import {existsSync,readdirSync,unlinkSync} from 'node:fs';
export async function cleanupStaffFixture({rid,sid,bid,aid}) {
 for(const id of [rid,sid,bid,aid])if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))throw new Error('Invalid synthetic fixture ID');
 const output=await localSql(`begin;set local lock_timeout='15s';
 select id from business_private.project_requests where id='${rid}' for update;
 do $guard$ begin
 if not exists(select from business_private.project_requests r join public.services s on s.id=r.service_id where r.id='${rid}' and r.email='dashboard@example.invalid' and r.full_name='Synthetic Dashboard Visitor' and s.id='${sid}' and s.slug='dashboard-'||s.id::text)
 or exists(select from business_private.project_requests where service_id='${sid}' and id<>'${rid}') then raise exception 'Unexpected fixture state; preserve all data';end if;
 end;$guard$;
 select r.id from business_private.quotation_revisions r join business_private.quotations q on q.id=r.quotation_id where q.request_id='${rid}' for update of r;
 select coalesce(json_agg(r.id),'[]'::json) from business_private.quotation_revisions r join business_private.quotations q on q.id=r.quotation_id where q.request_id='${rid}';
 lock table business_private.quotation_delivery_events in access exclusive mode;
 alter table business_private.quotation_delivery_events disable trigger freeze_delivery_event;
 delete from public.audit_logs where resource_type='quotation_delivery' and resource_id in(select id::text from business_private.quotation_deliveries where request_id='${rid}');
 delete from business_private.quotation_delivery_events where delivery_id in(select id from business_private.quotation_deliveries where request_id='${rid}');
 alter table business_private.quotation_delivery_events enable trigger freeze_delivery_event;
 delete from business_private.quotation_deliveries where request_id='${rid}';
 alter table business_private.quotation_revisions disable trigger freeze_final_quotation;
 delete from public.audit_logs where resource_type='quotation_revision' and resource_id in(select r.id::text from business_private.quotation_revisions r join business_private.quotations q on q.id=r.quotation_id where q.request_id='${rid}');
 delete from business_private.quotation_revisions where quotation_id in(select id from business_private.quotations where request_id='${rid}');
 alter table business_private.quotation_revisions enable trigger freeze_final_quotation;
 delete from business_private.quotations where request_id='${rid}';
 delete from public.audit_logs where resource_id in('${rid}','${sid}','${bid}','${aid}');
 delete from business_private.request_attachments where request_id='${rid}';
 delete from business_private.project_requests where id='${rid}';
 delete from public.service_budget_options where service_id='${sid}';delete from public.services where id='${sid}';commit;`);
 const ids=JSON.parse(output.split(/\r?\n/).find(l=>l.startsWith('['))??'[]');
 const directory=resolve('.supabase/documents/quotations');
 if(existsSync(directory))for(const file of readdirSync(directory))if(ids.some(id=>file.startsWith(id+'-')&&/^[a-f0-9-]+\.pdf$/.test(file))){const path=resolve(directory,file);if(!path.startsWith(directory+sep))throw new Error();unlinkSync(path);}
}
