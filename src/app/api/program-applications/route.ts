import {applicationHttp} from '@/features/opportunities/http';
export const runtime='nodejs';
export async function POST(r:Request){return applicationHttp(r);}
