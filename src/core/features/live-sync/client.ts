import { privateReads } from '../../app/read-lifecycle';

const listeners = new Set<() => void>();
let stop: (() => void) | undefined;
export function isLiveRead(url: string) {
  const path = new URL(url, 'http://vector.invalid').pathname;
  return path === '/api/current' || path === '/api/my-work' || /^\/api\/issues\/[A-Z][A-Z0-9_]*-[1-9][0-9]*$/.test(path);
}

export function onLiveRefresh(refresh: () => void) {
  listeners.add(refresh);
  if (!stop) {
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let heartbeat: number | undefined;
    let alive = true, unauthorized = false, lastPong = 0;
    const notify = () => { if (!privateReads.paused) for (const listener of listeners) listener(); };
    const close = () => {
      window.clearTimeout(retry);
      window.clearInterval(heartbeat);
      const previous = socket;
      socket = null;
      previous?.close();
    };
    const connect = () => {
      if (!alive || unauthorized || privateReads.paused || socket) return;
      const url = new URL('/api/live-sync', window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const current = new WebSocket(url);
      socket = current;
      current.onmessage = event => {
        if (socket !== current || privateReads.paused) return;
        let message: { type?: string };
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'ready' || message.type === 'pong') lastPong = Date.now();
        if (message.type === 'ready' || message.type === 'invalidate') notify();
      };
      current.onopen = () => {
        lastPong = Date.now();
        heartbeat = window.setInterval(() => {
          if (socket !== current || privateReads.paused) return;
          if (Date.now() - lastPong > 4000) current.close();
          else if (current.readyState === WebSocket.OPEN) current.send('ping');
        }, 1500);
      };
      current.onclose = event => {
        if (socket !== current) return;
        socket = null;
        window.clearInterval(heartbeat);
        if (event.code === 4001) {
          unauthorized = true;
          window.dispatchEvent(new Event('vector:auth-lost'));
        } else if (alive && !privateReads.paused) retry = window.setTimeout(connect, 250);
      };
    };
    const authLost = () => { unauthorized = true; close(); };
    const resume = privateReads.onResume(() => { unauthorized = false; connect(); });
    const pause = privateReads.onPause(close);
    window.addEventListener('vector:auth-lost', authLost);
    connect();
    stop = () => {
      alive = false;
      close(); resume(); pause();
      window.removeEventListener('vector:auth-lost', authLost);
      stop = undefined;
    };
  }
  return () => { listeners.delete(refresh); if (!listeners.size) stop?.(); };
}
