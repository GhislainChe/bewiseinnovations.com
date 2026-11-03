import {getPublicProductsRepository} from "@/features/products/server";
import {ProductCatalog,ProductUnavailable} from "@/features/products/public";
export const dynamic="force-dynamic";
export const metadata={title:"Products & Innovation | BE WISE INNOVATIONS"};
export default async function Page(){let products;try{products=await getPublicProductsRepository().catalog();}catch{return <ProductUnavailable/>;}return <ProductCatalog products={products}/>;}
