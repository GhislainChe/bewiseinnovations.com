import Image from 'next/image';
import {externalUrl} from '../products/model';
import type {Block,Asset} from './model';
import styles from './magazine.module.css';
export function ArticleBody({body,assets}:{body:Block[];assets:Asset[]}){return <div className={styles.body}>{body.map((b,i)=>{switch(b.type){
 case'paragraph':return <p key={i}>{b.text}</p>;
 case'heading':return b.level===3?<h3 key={i}>{b.text}</h3>:<h2 key={i}>{b.text}</h2>;
 case'list':return b.ordered?<ol key={i}>{b.items.map((v,j)=><li key={j}>{v}</li>)}</ol>:<ul key={i}>{b.items.map((v,j)=><li key={j}>{v}</li>)}</ul>;
 case'link':{let href;try{href=externalUrl(b.href);}catch{return null;}return href?<p key={i}><a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{b.text}</a></p>:null;}
 case'image':{const a=assets.find(a=>a.id===b.assetId);return a?<figure key={i}><Image src={a.path} alt={a.alt} width={1200} height={800} unoptimized/>{b.caption&&<figcaption>{b.caption}</figcaption>}</figure>:null;}
 default:return null;}})}</div>;}
