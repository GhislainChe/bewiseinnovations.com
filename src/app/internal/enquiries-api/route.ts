import{staffEnquiryHttp}from'@/features/enquiries/http';
export const runtime='nodejs';
export async function GET(request:Request){return staffEnquiryHttp(request);}
export async function POST(request:Request){return staffEnquiryHttp(request);}
