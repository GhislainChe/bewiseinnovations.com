import'server-only';
import{createHash,createHmac,randomBytes}from'node:crypto';
import{assertLocalBusinessRuntime}from'../services/runtime';
export const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
export function eventHash(purpose:string){assertLocalBusinessRuntime();const key=process.env.BUSINESS_SUBMISSION_SECRET;if(!key||key.length<32)throw new Error('Event signing unavailable.');return createHmac('sha256',key).update('events-v1:'+purpose).digest('hex');}
export const newSecret=(prefix:'ei1'|'ec1'|'pc1')=>prefix+'_'+randomBytes(prefix==='ei1'?32:16).toString('hex');
export function qrPayload(id:string,version:number){return'BWET1.'+id+'.'+version+'.'+eventHash('ticket:'+id+':'+version);}
