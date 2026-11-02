// User-approved Stage 4A.3 content. XAF has zero decimal minor units.
export const approvedServices = [
 ['website-development','Website Development','Professional business websites, portfolios, e-commerce platforms and custom web applications, designed for performance, usability and growth.',[50000,100000,250000,500000,1000000]],
 ['mobile-app-development','Mobile App Development','Android and iOS applications that transform ideas into functional, intuitive digital experiences.',[100000,250000,500000,1000000,2500000]],
 ['ui-ux-design','UI/UX Design','User research, wireframes, interactive prototypes and interface designs that make digital products beautiful and easy to use.',[20000,50000,100000,250000,500000]],
 ['graphic-design-branding','Graphic Design & Branding','Visual identities, logos, flyers, marketing materials and brand assets that help businesses communicate professionally.',[5000,15000,30000,75000,150000]],
 ['video-production-editing','Video Production & Editing','Promotional videos, content editing, motion graphics and visual storytelling for brands, creators and organizations.',[10000,30000,75000,150000,300000]],
 ['custom-software-solutions','Custom Software Solutions','Tailored software systems, business automation, management tools and integrations built to solve specific organizational challenges.',[100000,250000,500000,1000000,3000000]],
 ['social-media-digital-content','Social Media & Digital Content','Content planning, digital campaigns, social media graphics, short-form videos and brand communication solutions.',[10000,25000,50000,100000,250000]],
];
const quote = value => "'"+String(value).replaceAll("'","''")+"'";
export function catalogInitializationSql() {
 const values=approvedServices.map(([slug,title,description,edges])=>`(${quote(slug)},${quote(title)},${quote(description)},ARRAY[${edges.join(',')}]::bigint[])`).join(',\n');
 // The INSERT RETURNING set is crucial: existing slugs get NO updates or budgets.
 return `begin; set local statement_timeout='15s'; select pg_advisory_xact_lock(42043,1);
 with approved(slug,title,description,edges) as (values ${values}),
 added as (insert into public.services(slug,title,description,status,accepting_requests)
 select slug,title,description,'published',true from approved on conflict(slug) do nothing returning id,slug),
 budgets as (insert into public.service_budget_options(service_id,label,currency,min_minor,max_minor,is_unsure,sort_order)
 select s.id,case when n=6 then 'Not sure yet' when n=5 then 'Above '||to_char(a.edges[5],'FM999,999,999')||' FCFA' else to_char(a.edges[n],'FM999,999,999')||'–'||to_char(a.edges[n+1],'FM999,999,999')||' FCFA' end,
 'XAF',case when n<6 then a.edges[n] end,case when n<5 then a.edges[n+1] end,n=6,n*10
 from added s join approved a using(slug) cross join generate_series(1,6)n returning id)
 select json_build_object('servicesAdded',(select count(*) from added),'budgetsAdded',(select count(*) from budgets)); commit;`;
}
