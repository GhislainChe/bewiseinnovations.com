import {publicMagazine} from '@/features/magazine/server';
import {MagazineLanding,MagazineUnavailable} from '@/features/magazine/public';
export const dynamic='force-dynamic';
export const metadata={title:'Inside BE WISE | BE WISE INNOVATIONS'};
export default async function Page({searchParams}:{searchParams:Promise<{category?:string|string[]}>}){const q=await searchParams;let data;try{if(q.category!==undefined&&typeof q.category!=='string')throw new Error();const r=publicMagazine();data={articles:await r.catalog(q.category),categories:await r.categories(),category:q.category};}catch{return <MagazineUnavailable/>;}return <MagazineLanding {...data}/>;}
