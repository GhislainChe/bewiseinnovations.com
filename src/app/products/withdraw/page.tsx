import {ProductShell} from "@/features/products/public";
import {Withdrawal} from "@/features/products/withdrawal";
export const dynamic="force-dynamic";
export const metadata={title:"Withdraw product updates | BE WISE",robots:{index:false,follow:false}};
export default function Page(){return <ProductShell><Withdrawal/></ProductShell>;}
