import { createServer } from 'node:http';
import type { LogEntry } from '@sz/shared';
import { LocalEventSchema } from '@sz/shared';

/**
 * 本機事件 API：只綁 127.0.0.1，讓你的軟體（任何語言）在出錯時
 *   POST http://127.0.0.1:9900/event  body: {"level":"error","message":"...","appState":"error"}
 * 把事件交給 Agent 轉送到後端。回傳最近一次回報的 appState 供主迴圈使用。
 */
export class LocalApi {
  private buffer: LogEntry[] = [];
  private latestAppState: string | undefined;
  private readonly maxBuffer = 1000;

  constructor(private readonly port: number) {}

  start(): void {
    if (!this.port) return;
    const server = createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/event') {
        let body = '';
        req.on('data', (c) => {
          body += c;
          if (body.length > 1_000_000) req.destroy();
        });
        req.on('end', () => {
          try {
            const parsed = LocalEventSchema.parse(JSON.parse(body || '{}'));
            if (parsed.appState) this.latestAppState = parsed.appState;
            this.push({ level: parsed.level, source: 'api', message: parsed.message });
            res.writeHead(202, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid event' }));
          }
        });
        return;
      }
      res.writeHead(404).end();
    });
    server.listen(this.port, '127.0.0.1', () => {
      console.log(`[agent] local event API on http://127.0.0.1:${this.port}/event`);
    });
    server.on('error', (e) => console.error('[agent] local API error:', e.message));
  }

  drain(): LogEntry[] {
    const out = this.buffer;
    this.buffer = [];
    return out;
  }

  takeAppState(): string | undefined {
    const s = this.latestAppState;
    this.latestAppState = undefined;
    return s;
  }

  private push(entry: LogEntry): void {
    if (this.buffer.length >= this.maxBuffer) this.buffer.shift();
    this.buffer.push(entry);
  }
}
