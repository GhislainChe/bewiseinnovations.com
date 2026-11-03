import {staffOpportunitiesHttp} from '@/features/opportunities/http';
export const runtime='nodejs';
export async function GET(r:Request){return staffOpportunitiesHttp(r);}
export async function POST(r:Request){return staffOpportunitiesHttp(r);}
