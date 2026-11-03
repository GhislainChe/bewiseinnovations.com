import {publicMagazineHttp} from '@/features/magazine/http';
export const runtime='nodejs';
export async function GET(r:Request){return publicMagazineHttp(r);}
