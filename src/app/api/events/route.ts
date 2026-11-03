import{publicEventsHttp}from'@/features/events/http';
export const runtime='nodejs';
export async function GET(r:Request){return publicEventsHttp(r);}
