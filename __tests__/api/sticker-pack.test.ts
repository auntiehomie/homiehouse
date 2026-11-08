import { GET } from '@/app/api/sticker-pack/route';
const sticker={id:'wave',name:'Wave',alt:'Wave',url:'https://example.com/wave.webp',mimeType:'image/webp',width:512,height:512,sha256:'a'.repeat(64),tags:['wave']};
const pack={format:'farcaster-sticker-pack',version:1,name:'Network Code',stickers:[sticker]};
afterEach(()=>jest.restoreAllMocks());
it('falls back to the bundled manifest and returns ordinary sticker URLs', async()=>{
 const fetchMock=jest.spyOn(global,'fetch').mockResolvedValueOnce(new Response('',{status:503})).mockResolvedValueOnce(new Response(JSON.stringify(pack),{status:200}));
 const response=await GET(); expect(response.status).toBe(200); expect((await response.json()).stickers[0].url).toBe(sticker.url); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('rejects oversized manifests and returns an unavailable response',async()=>{
 jest.spyOn(global,'fetch').mockImplementation(async()=>new Response('x'.repeat(131073)));
 expect((await GET()).status).toBe(503);
});
