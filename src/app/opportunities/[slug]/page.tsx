import {notFound} from 'next/navigation';
import {articleSlug} from '@/features/magazine/model';
import {publicOpportunities} from '@/features/opportunities/server';
import {OpportunityDetail,OpportunitiesUnavailable} from '@/features/opportunities/public';
export const dynamic='force-dynamic';
export const metadata={title:'Opportunity | BE WISE INNOVATIONS'};
export default async function Page({params}:{params:Promise<{slug:string}>}){const value=(await params).slug;try{articleSlug(value);}catch{notFound();}let o;try{o=await publicOpportunities().published(value);}catch{return <OpportunitiesUnavailable/>;}if(!o)notFound();return <OpportunityDetail o={o}/>;}
