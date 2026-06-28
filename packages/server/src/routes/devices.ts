import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../auth.js';
import { pool } from '../db.js';
import { getDevice, listDevices } from '../repo.js';

/** 儀表板讀取 API：device 清單、單台、單台指標歷史、單台日誌。 */
export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/devices', { preHandler: requireAdmin }, async () => {
    return { devices: await listDevices() };
  });

  app.get<{ Params: { id: string } }>(
    '/api/v1/devices/:id',
    { preHandler: requireAdmin },
    async (req, reply) => {
      const device = await getDevice(req.params.id);
      if (!device) return reply.code(404).send({ error: 'not found' });
      return { device };
    },
  );

  // 指標歷史（畫走勢圖用）
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/v1/devices/:id/metrics',
    { preHandler: requireAdmin },
    async (req) => {
      const limit = Math.min(Number(req.query.limit) || 200, 2000);
      const { rows } = await pool.query(
        `SELECT ts, cpu_pct, mem_used, mem_total, disk_used, disk_total, uptime_sec
         FROM metrics WHERE device_id = $1 ORDER BY ts DESC LIMIT $2`,
        [req.params.id, limit],
      );
      return {
        metrics: rows.reverse().map((r) => ({
          ts: new Date(r.ts).toISOString(),
          cpuPct: Number(r.cpu_pct),
          memUsed: Number(r.mem_used),
          memTotal: Number(r.mem_total),
          diskUsed: Number(r.disk_used),
          diskTotal: Number(r.disk_total),
          uptimeSec: Number(r.uptime_sec),
        })),
      };
    },
  );

  // 日誌（可依等級過濾、分頁）
  app.get<{ Params: { id: string }; Querystring: { limit?: string; level?: string } }>(
    '/api/v1/devices/:id/logs',
    { preHandler: requireAdmin },
    async (req) => {
      const limit = Math.min(Number(req.query.limit) || 100, 1000);
      const level = req.query.level;
      const params: unknown[] = [req.params.id];
      let where = 'device_id = $1';
      if (level) {
        params.push(level);
        where += ` AND level = $${params.length}`;
      }
      params.push(limit);
      const { rows } = await pool.query(
        `SELECT ts, level, source, message FROM logs WHERE ${where} ORDER BY ts DESC LIMIT $${params.length}`,
        params,
      );
      return {
        logs: rows.map((r) => ({
          ts: new Date(r.ts).toISOString(),
          level: r.level,
          source: r.source,
          message: r.message,
        })),
      };
    },
  );
}
