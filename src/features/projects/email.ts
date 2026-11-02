import {brand} from "../brand/identity";
import {LOGO_CID} from "../delivery/model";
const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
// Only persisted, explicitly reviewed client-safe copy belongs here. No technical notes.
export function progressEmail(summary:string,percent:number){
 if(!Number.isInteger(percent)||percent<0||percent>100)throw new Error("Invalid progress.");
 return {sendingEnabled:false,subject:"Your Project Progress | BE WISE INNOVATIONS",text:`${brand.name}\n${summary}\nMilestone completion: ${percent}%\n${brand.tagline}`,
 html:`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#F8FAFC;color:#111827;font-family:Quicksand,Arial,sans-serif"><main style="max-width:600px;margin:auto;background:#FFFFFF"><header style="background:#103B92;padding:28px;color:white"><div style="background:white;padding:12px;max-width:270px"><img src="cid:${LOGO_CID}" width="250" style="max-width:100%;height:auto" alt="BE WISE INNOVATIONS"></div><p>${brand.tagline}</p></header><div style="padding:28px;line-height:1.7;overflow-wrap:anywhere"><p>Hello,</p><p>Here is a confirmed update on your project:</p><p>${escape(summary).replaceAll("\n","<br>")}</p><p><strong>Milestone completion: ${percent}%</strong></p><p>This percentage reflects completed milestones, not an independent estimate of engineering effort.</p></div><footer style="padding:28px;border-top:1px solid #E2E8F0;color:#64748B">${brand.name}<br>${brand.tagline}<br>${brand.email}<br>${brand.website}</footer></main></body></html>`};
}
