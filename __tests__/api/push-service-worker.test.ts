import vm from 'node:vm';
import { GET } from '@/app/api/sw/route';
it('keeps notification navigation on the app origin and focuses an existing window', async () => {
 const handlers: Record<string, (event: any) => void> = {};
 const client = { url: 'https://homiehouse.lol/feed', navigate: jest.fn(), focus: jest.fn() };
 const context = { self: { location: { origin: 'https://homiehouse.lol' }, addEventListener: (name: string, handler: any) => { handlers[name] = handler; } },
  clients: { matchAll: async () => [client], openWindow: jest.fn() }, URL };
 vm.runInNewContext(await (await GET()).text(), context);
 let completion: Promise<unknown> = Promise.resolve();
 handlers.notificationclick({ notification: { close: jest.fn(), data: { url: 'https://evil.example/' } }, waitUntil: (p: Promise<unknown>) => { completion = p; } });
 await completion;
 expect(client.navigate).toHaveBeenCalledWith('/notifications');
 expect(client.focus).toHaveBeenCalled();
});
