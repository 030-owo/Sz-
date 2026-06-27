import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import Fastify from 'fastify';
import { verifyAdminToken } from './auth.js';
import { pool, runMigrations } from './db.js';
import { listDevices } from './repo.js';
import { authRoutes } from './routes/auth.js';
import { deviceRoutes } from './routes/devices.js';
import { ingestRoutes } from './routes/ingest.js';
import { addClient } from './ws.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

async function main(): Promise<void> {
  await runMigrations();

  const app = Fastify({ logger: true, trustProxy: true });
  await app.register(fastifyWebsocket);

  // 健康檢查
  app.get('/healthz', async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(ingestRoutes);
  await app.register(deviceRoutes);

  // 儀表板即時推送 WebSocket。連線時先送一份 snapshot，之後增量更新。
  // token 用 query string 傳（瀏覽器 WebSocket 無法帶 Authorization header）。
  await app.register(async (instance) => {
    instance.get('/ws', { websocket: true }, async (socket, req) => {
      const token = (req.query as { token?: string }).token || '';
      if (!verifyAdminToken(token)) {
        socket.close(1008, 'unauthorized');
        return;
      }
      addClient(socket);
      const devices = await listDevices();
      socket.send(JSON.stringify({ type: 'snapshot', devices }));
    });
  });

  // 提供前端靜態檔（build 後的 web/dist）。找不到就略過（純 API 模式）。
  const webDist = join(__dirname, '..', '..', 'web', 'dist');
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, { root: webDist });
    // SPA fallback：非 /api、/ws 的路徑都回 index.html
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
        return reply.code(404).send({ error: 'not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`server listening on :${PORT}`);
}

main().catch((err) => {
  console.error(err);
  pool.end().finally(() => process.exit(1));
});
