import { validateStickerPack } from '@/lib/sticker-pack';
const sticker = {id:'wave',name:'Wave',alt:'A wave',url:'https://example.com/wave.webp',mimeType:'image/webp',width:512,height:512,sha256:'a'.repeat(64),tags:['hello']};
const pack = {format:'farcaster-sticker-pack',version:1,name:'Example',stickers:[sticker]};
it('accepts a draft pack and preserves image URLs and search tags',()=>{ expect(validateStickerPack(pack)).toEqual({name:'Example',stickers:[{id:'wave',name:'Wave',alt:'A wave',url:sticker.url,tags:['hello']}]}); });
it.each([{...pack,version:2},{...pack,stickers:[sticker,sticker]},{...pack,stickers:Array(101).fill(sticker)},{...pack,stickers:[{...sticker,url:'https://user:password@example.com/image.png'}]},{...pack,stickers:[{...sticker,url:'https://127.0.0.1/image.png'}]},{...pack,stickers:[{...sticker,mimeType:'image/svg+xml'}]},{...pack,stickers:[{...sticker,width:2049}]}])('rejects invalid manifests', (value)=>{expect(()=>validateStickerPack(value)).toThrow()});
