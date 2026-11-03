import {publicOpportunitiesHttp} from '@/features/opportunities/http';
export const runtime='nodejs';
export async function GET(r:Request){return publicOpportunitiesHttp(r);}
