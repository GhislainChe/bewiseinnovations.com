import{notFound}from'next/navigation';
import{articleSlug}from'@/features/magazine/model';
import{publicEvents}from'@/features/events/server';
import{PublicEventPage,EventsUnavailable}from'@/features/events/public';
export const dynamic='force-dynamic';
export const metadata={title:'Event | BE WISE INNOVATIONS'};
export default async function Page({params}:{params:Promise<{slug:string}>}){const slug=(await params).slug;try{articleSlug(slug);}catch{notFound();}let event;try{event=await publicEvents().published(slug);}catch{return <EventsUnavailable/>;}if(!event)notFound();return <PublicEventPage event={event}/>;}
