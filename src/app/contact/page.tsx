import{ContactPage}from'@/features/enquiries/public';
import{contactConfiguration}from'@/features/enquiries/config';
export const dynamic='force-dynamic';
export const metadata={title:'Contact | BE WISE INNOVATIONS'};
export default function Page(){return <ContactPage configuration={contactConfiguration()}/>;}
