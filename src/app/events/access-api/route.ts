import{eventAccessHttp}from'@/features/events/http';
export const runtime='nodejs';
export async function POST(r:Request){return eventAccessHttp(r);}
