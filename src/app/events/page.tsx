import{publicEvents}from'@/features/events/server';
import{EventsCatalog,EventsUnavailable}from'@/features/events/public';
export const dynamic='force-dynamic';
export const metadata={title:'Events | BE WISE INNOVATIONS'};
export default async function Page(){let events;try{events=await publicEvents().catalog();}catch{return <EventsUnavailable/>;}return <EventsCatalog events={events}/>;}
