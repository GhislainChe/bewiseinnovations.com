import 'server-only';
import {inspectAuthOrigin} from '@/lib/auth/origin';
import {AuthorizationError} from '@/lib/auth/core';
import {assertLocalBusinessRuntime} from '../services/runtime';
import {record} from '../services/validation';
import {BusinessConflictError} from '../services/server';
import {readBoundedJson} from '../services/submission';
import {documentHeaders} from '../quotations/http';
import {getMagazineRepository,publicMagazine} from './server';
export async function publicMagazineHttp(request:Request){try{assertLocalBusinessRuntime();const q=new URL(request.url).searchParams,r=publicMagazine();const data=q.has('slug')?await r.published(q.get('slug')!):q.has('categories')?await r.categories():await r.catalog(q.get('category')??undefined);return Response.json(data,{status:data===null?404:200,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}catch{return Response.json({message:'Magazine temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
export async function staffMagazineHttp(request:Request,factory=getMagazineRepository){try{assertLocalBusinessRuntime();if(request.method==='GET'){const r=await factory();return Response.json({articles:await r.list(),categories:await r.categories(true),assets:await r.assets()},{headers:documentHeaders});}
 if(request.method!=='POST'||!inspectAuthOrigin(request).allowed)return Response.json({message:'Request rejected.'},{status:403,headers:documentHeaders});
 const v=record(await readBoundedJson(request,65536));if(Object.keys(v).length!==2||Object.keys(v).some(k=>!['operation','input'].includes(k)))throw new Error();const r=await factory();let data;
 switch(v.operation){case'save':data=await r.save(v.input);break;case'category':data=await r.category(v.input);break;case'publish':data=await r.publish(v.input);break;case'feature':data=await r.feature(v.input);break;default:throw new Error();}return Response.json(data,{headers:documentHeaders});
 }catch(e){return Response.json({message:e instanceof BusinessConflictError?'Article or category changed. Reload before continuing.':'Editorial operation unavailable. Check your access and input; reload before retrying.'},{status:e instanceof AuthorizationError?403:e instanceof BusinessConflictError?409:400,headers:documentHeaders});}}
