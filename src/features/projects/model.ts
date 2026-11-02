import {identifier,record} from "../services/validation";
export const projectStates=["planned","active","on_hold","completed","cancelled"] as const;
export const milestoneStates=["pending","in_progress","completed","excluded"] as const;
export type Progress={completed:number;total:number;percent:number|null};
export type Milestone={id:string;project_id:string;title:string;internal_notes:string;client_summary:string;state:typeof milestoneStates[number];exclusion_reason:string;position:number;version:number};
export type ProjectRow={id:string;kind:"internal"|"client";name:string;status:typeof projectStates[number];progress:Progress;updates?:number};
export type Project=ProjectRow&{request_id:string|null;description:string;starts_on:string|null;ends_on:string|null;version:number;approved_scope:string|null;milestones:Milestone[];notifications:{id:string;milestoneId:string;status:"PREPARED";summary:string;progress:number;createdAt:string}[]};
export type Intake={requestId:string;reference:string;scope:string};
export function progress(milestones:Pick<Milestone,"state">[]):Progress {
 const total=milestones.filter(m=>m.state!=="excluded").length,completed=milestones.filter(m=>m.state==="completed").length;
 return {total,completed,percent:total?Math.round(100*completed/total):null};
}
function fields(v:Record<string,unknown>,keys:string[]) {if(Object.keys(v).length!==keys.length||Object.keys(v).some(k=>!keys.includes(k)))throw new Error("Unexpected fields.");}
function text(v:unknown,max:number,required=false){if(typeof v!=="string"||v.length>max||(required&&!v.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))throw new Error("Check text lengths and required fields.");return v;}
function version(v:unknown,zero=false){if(!Number.isSafeInteger(v)||(v as number)<(zero?0:1))throw new Error("Invalid version.");return v as number;}
function date(v:unknown){if(v===null)return null;if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(new Date(v+"T00:00:00Z").getTime())||new Date(v+"T00:00:00Z").toISOString().slice(0,10)!==v)throw new Error("Invalid date.");return v;}
export function parseProject(input:unknown){const v=record(input);fields(v,["id","version","kind","requestId","name","description","status","startsOn","endsOn"]);
 const id=v.id===null?null:identifier(v.id),requestId=v.requestId===null?null:identifier(v.requestId);
 if(!["internal","client"].includes(v.kind as string)||!projectStates.includes(v.status as typeof projectStates[number])||((v.kind==="internal")!==(requestId===null)))throw new Error("Choose the appropriate project type and approved intake.");
 const startsOn=date(v.startsOn),endsOn=date(v.endsOn);if(startsOn&&endsOn&&endsOn<startsOn)throw new Error("End date precedes start date.");
 return {id,version:version(v.version,id===null),kind:v.kind as "internal"|"client",requestId,name:text(v.name,160,true),description:text(v.description,6000),status:v.status as Project["status"],startsOn,endsOn};
}
export function parseMilestone(input:unknown){const v=record(input);fields(v,["projectId","version","id","title","internalNotes","clientSummary","state","exclusionReason"]);
 if(!milestoneStates.includes(v.state as Milestone["state"]))throw new Error("Invalid milestone state.");
 return {projectId:identifier(v.projectId),version:version(v.version),id:v.id===null?null:identifier(v.id),title:text(v.title,200,true),internalNotes:text(v.internalNotes,3000),clientSummary:text(v.clientSummary,2000),state:v.state as Milestone["state"],exclusionReason:text(v.exclusionReason,1000,v.state==="excluded")};
}
export function parseOrder(input:unknown){const v=record(input);fields(v,["projectId","version","ids"]);if(!Array.isArray(v.ids)||v.ids.length>100)throw new Error("Invalid order.");const ids=v.ids.map(identifier);if(new Set(ids).size!==ids.length)throw new Error("Duplicate milestone.");return {projectId:identifier(v.projectId),version:version(v.version),ids};}
export function parseNotification(input:unknown){const v=record(input);fields(v,["projectId","version","milestoneId","attested"]);if(v.attested!==true)throw new Error("Review client-safe copy first.");return {projectId:identifier(v.projectId),version:version(v.version),milestoneId:identifier(v.milestoneId),attested:true};}
export function parseRelease(input:unknown){const v=record(input);fields(v,["requestId","requestVersion","releaseVersion","scope","evidence","agreement","attested","active"]);if(typeof v.active!=="boolean"||typeof v.attested!=="boolean"||(v.active&&!v.attested))throw new Error("Contact verification and agreement are required.");
 return {requestId:identifier(v.requestId),requestVersion:version(v.requestVersion),releaseVersion:version(v.releaseVersion,true),scope:text(v.scope,6000,v.active),evidence:text(v.evidence,1000,v.active),agreement:text(v.agreement,500,v.active),attested:v.attested,active:v.active};}
