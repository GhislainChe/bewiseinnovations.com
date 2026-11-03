import {identifier,record} from '../services/validation';
import {exact,text,externalUrl,suggestSlug} from '../products/model';
export {suggestSlug};
export type Asset={id:string;path:string;alt:string};
export type Category={id:string;slug:string;name:string;active?:boolean;sortOrder?:number;version?:number};
export type Block={type:'paragraph';text:string}|{type:'heading';text:string;level:2|3}|{type:'list';items:string[];ordered:boolean}|{type:'link';text:string;href:string}|{type:'image';assetId:string;caption:string};
export type ArticleDocument={title:string;summary:string;author:string;categoryId:string;coverId:string|null;body:Block[]};
export type Article={id:string;slug:string;title:string;summary:string;author:string;body:Block[];category:Category;coverId:string|null;assets:Asset[];featured:boolean;publishedAt:string;updatedAt:string};
export type StaffArticle={id:string;slug:string;draft:ArticleDocument;version:number;published:boolean;featured:boolean;updatedAt:string;revisions:{revision:number;publishedAt:string}[]};
export function articleSlug(v:unknown){if(typeof v!=='string'||v.length>80||!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v))throw new Error('Use a lowercase URL slug.');return v;}
function version(v:unknown,zero=false){if(!Number.isSafeInteger(v)||(v as number)<(zero?0:1))throw new Error('Invalid record version.');return v as number;}
export function blocks(input:unknown):Block[]{if(!Array.isArray(input)||input.length<1||input.length>80)throw new Error('Use between 1 and 80 content blocks.');return input.map(raw=>{const b=record(raw);switch(b.type){
 case'paragraph':exact(b,['type','text']);return{type:'paragraph',text:text(b.text,4000,true)};
 case'heading':exact(b,['type','text','level']);if(b.level!==2&&b.level!==3)throw new Error();return{type:'heading',text:text(b.text,240,true),level:b.level};
 case'list':exact(b,['type','items','ordered']);if(!Array.isArray(b.items)||b.items.length<1||b.items.length>30||typeof b.ordered!=='boolean')throw new Error();return{type:'list',items:b.items.map(v=>text(v,1000,true)),ordered:b.ordered};
 case'link':{exact(b,['type','text','href']);const href=externalUrl(b.href);if(!href)throw new Error();return{type:'link',text:text(b.text,240,true),href};}
 case'image':exact(b,['type','assetId','caption']);return{type:'image',assetId:identifier(b.assetId),caption:text(b.caption,400)};
 default:throw new Error('Unsupported content. HTML and embeds are not accepted.');}});}
export function document(input:unknown):ArticleDocument{const d=record(input);exact(d,['title','summary','author','categoryId','coverId','body']);const v={title:text(d.title,180,true),summary:text(d.summary,500,true),author:text(d.author,120,true),categoryId:identifier(d.categoryId),coverId:d.coverId===null?null:identifier(d.coverId),body:blocks(d.body)};if(new TextEncoder().encode(JSON.stringify(v)).length>60000)throw new Error('Article too long.');return v;}
export function parseDraft(input:unknown){const v=record(input);exact(v,['id','version','slug','document']);return{id:v.id===null?null:identifier(v.id),version:version(v.version,v.id===null),slug:articleSlug(v.slug),document:document(v.document)};}
export function parseCategory(input:unknown){const v=record(input);exact(v,['id','version','name','slug','active','sortOrder']);if(typeof v.active!=='boolean'||!Number.isInteger(v.sortOrder)||(v.sortOrder as number)<0||(v.sortOrder as number)>9999)throw new Error();return{id:v.id===null?null:identifier(v.id),version:version(v.version,v.id===null),name:text(v.name,80,true),slug:articleSlug(v.slug),active:v.active,sortOrder:v.sortOrder};}
export function parseSwitch(input:unknown,key:'published'|'featured'){const v=record(input);exact(v,['id','version',key]);if(typeof v[key]!=='boolean')throw new Error();return{id:identifier(v.id),version:version(v.version),value:v[key] as boolean};}
export function shareLinks(origin:string,slug:string,title:string){const u=new URL(origin);if(origin!==u.origin||u.username||u.password||(u.protocol!=='https:'&&origin!=='http://localhost:3022'))throw new Error('Trusted sharing origin required.');const canonical=new URL('/inside-be-wise/'+articleSlug(slug),u).href;
 return{canonical,whatsapp:'https://wa.me/?text='+encodeURIComponent(title+'\n'+canonical),facebook:'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(canonical),linkedin:'https://www.linkedin.com/sharing/share-offsite/?url='+encodeURIComponent(canonical)};}
