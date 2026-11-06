import { DurableObject } from 'cloudflare:workers';
import type { WorkerBindings } from '../../app/bindings';
import { z } from 'zod';
const readerSchema = z.object({ actor: z.string(), workspace: z.string(), fence: z.object({ sessionId: z.string(), operatorVersion: z.number() }) });
import { liveAdmission, type LiveReader } from './admission';

/** Per-workspace invalidation only. Native reads remain the content authority. */
export class VectorLiveSync extends DurableObject<WorkerBindings> {
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    // Only the Worker calls this internal door, with a committed activity ID.
    if (path === '/publish' && request.method === 'POST') {
      const event = await request.text();
      if (!/^[A-Z0-9]{26}$/.test(event)) return new Response(null, { status: 400 });
      for (const socket of this.ctx.getWebSockets()) {
        const reader = socket.deserializeAttachment() as LiveReader;
        const admission = await liveAdmission(this.env.DB, reader, event);
        if (admission?.active !== 1) socket.close(4001, 'Session ended');
        else if (admission.visible === 1) this.send(socket, { type: 'invalidate' });
      }
      return new Response(null, { status: 204 });
    }
    if (path !== '/connect' || request.method !== 'GET') return new Response(null, { status: 404 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response(null, { status: 426 });
    if (request.headers.get('Origin') !== this.env.APP_ORIGIN) return new Response(null, { status: 403 });
    // The public connector replaces this header after native authentication;
    // the namespace is internal and never admits a caller's supplied identity.
    let value: unknown;
    try { value = JSON.parse(request.headers.get('x-vector-live-reader') ?? 'null'); } catch { value = null; }
    const parsed = readerSchema.safeParse(value);
    if (!parsed.success) return new Response(null, { status: 401 });
    const reader: LiveReader = parsed.data;
    if (!this.env.LIVE_SYNC || !this.ctx.id.equals(this.env.LIVE_SYNC.idFromName(reader.workspace)))
      return new Response(null, { status: 404 });
    if ((await liveAdmission(this.env.DB, reader))?.active !== 1) return new Response(null, { status: 401 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(reader);
    this.send(server, { type: 'ready' });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (message !== 'ping') { socket.close(1008, 'Unsupported message'); return; }
    const reader = socket.deserializeAttachment() as LiveReader;
    if ((await liveAdmission(this.env.DB, reader))?.active !== 1) socket.close(4001, 'Session ended');
    else this.send(socket, { type: 'pong' });
  }
  webSocketClose(socket: WebSocket, code: number) { socket.close(code === 1005 || code === 1006 ? 1000 : code); }
  webSocketError(socket: WebSocket) { socket.close(1011, 'Connection interrupted'); }
  private send(socket: WebSocket, message: { type: string }) {
    try { socket.send(JSON.stringify(message)); }
    catch { socket.close(1011, 'Connection interrupted'); }
  }
}
