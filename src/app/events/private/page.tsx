import{ProductShell}from'@/features/products/public';
import{GuestAccess}from'@/features/events/guest';
export const dynamic='force-dynamic';
export const metadata={title:'Private event access | BE WISE',robots:{index:false,follow:false}};
export default function Page(){return <ProductShell><GuestAccess kind="invite"/></ProductShell>;}
