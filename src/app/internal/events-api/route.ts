import{staffEventsHttp}from'@/features/events/http';
export const runtime='nodejs';
export async function GET(r:Request){return staffEventsHttp(r);}
export async function POST(r:Request){return staffEventsHttp(r);}
