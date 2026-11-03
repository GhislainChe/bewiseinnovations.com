import {notFound} from "next/navigation";
import {getPublicProductsRepository} from "@/features/products/server";
import {ProductDetail,ProductUnavailable} from "@/features/products/public";
import {slug} from "@/features/products/model";
export const dynamic="force-dynamic";
export const metadata={title:"Product | BE WISE INNOVATIONS"};
export default async function Page({params}:{params:Promise<{slug:string}>}){const value=(await params).slug;try{slug(value);}catch{notFound();}let product;try{product=await getPublicProductsRepository().published(value);}catch{return <ProductUnavailable/>;}if(!product)notFound();return <ProductDetail product={product}/>;}
