import {publicOpportunities} from '@/features/opportunities/server';
import {OpportunityCatalog,OpportunitiesUnavailable} from '@/features/opportunities/public';
export const dynamic='force-dynamic';
export const metadata={title:'Opportunities & Programs | BE WISE INNOVATIONS'};
export default async function Page(){let rows;try{rows=await publicOpportunities().catalog();}catch{return <OpportunitiesUnavailable/>;}return <OpportunityCatalog rows={rows}/>;}
