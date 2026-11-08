'use client';
import StickerPicker from './StickerPicker';
import { MAX_CAST_EMBEDS } from '@/lib/cast-embeds';
export default function ReplyStickers({urls,onChange}:{urls:string[];onChange:(urls:string[])=>void}) {
  return <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><StickerPicker disabled={urls.length>=MAX_CAST_EMBEDS} onSelect={s=>{if(!urls.includes(s.url))onChange([...urls,s.url])}}/>{urls.map((url,i)=><div key={url} style={{position:'relative'}}><img src={url} crossOrigin="anonymous" alt={`Selected sticker ${i+1}`} style={{width:60,height:60,objectFit:'contain'}}/><button type="button" aria-label={`Remove sticker ${i+1}`} onClick={()=>onChange(urls.filter(u=>u!==url))} style={{position:'absolute',right:0,top:0}}>×</button></div>)}</div>;
}
