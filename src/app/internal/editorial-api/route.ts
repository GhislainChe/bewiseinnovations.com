import {staffMagazineHttp} from '@/features/magazine/http';
export const runtime='nodejs';
export async function GET(r:Request){return staffMagazineHttp(r);}
export async function POST(r:Request){return staffMagazineHttp(r);}
