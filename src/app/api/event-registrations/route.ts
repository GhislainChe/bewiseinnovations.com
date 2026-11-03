import{publicRegistrationHttp}from'@/features/events/http';
export const runtime='nodejs';
export async function POST(r:Request){return publicRegistrationHttp(r);}
