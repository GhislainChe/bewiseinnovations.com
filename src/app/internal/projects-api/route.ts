import {projectsHttp} from "@/features/projects/http";
export const runtime="nodejs";
export async function GET(r:Request){return projectsHttp(r);}
export async function POST(r:Request){return projectsHttp(r);}
