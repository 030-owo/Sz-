import type { FastifyInstance } from 'fastify';
import { TelemetrySchema } from '@sz/shared';
import { deviceIdFromToken } from '../auth.js';
import { pool } from '../db.js';
import { getDevice } from '../repo.js';
import { broadcast } from '../ws.js';

/** Agent 回報入口：POST /api/v1/telemetry（Bearer token 認證）。 */
export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/telemetry', async (req, reply) => {
    const deviceId = await deviceIdFromToken(req);
    if (!deviceId) return reply.code(401).send({ error: 'invalid device token' });

    const parsed = TelemetrySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid payload', detail: parsed.error.flatten() });
    }
    const t = parsed.data;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

    // 1) upsert device 基本資訊 + 更新 last_seen（心跳）
    await pool.query(
      `UPDATE devices SET
         name = COALESCE($2, name),
         vendor = COALESCE($3, vendor),
         os = COALESCE($4, os),
         agent_version = COALESCE($5, agent_version),
         app_version = COALESCE($6, app_version),
         app_state = COALESCE($7, app_state),
         last_seen = now(),
         last_ip = $8
       WHERE id = $1`,
      [deviceId, t.name, t.vendor, t.os, t.agentVersion, t.appVersion, t.appState, ip],
    );

    // 2) 寫入指標
    if (t.metrics) {
      const m = t.metrics;
      await pool.query(
        `INSERT INTO metrics (device_id, cpu_pct, mem_used, mem_total, disk_used, disk_total, uptime_sec)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [deviceId, m.cpuPct, m.memUsed, m.memTotal, m.diskUsed, m.diskTotal, m.uptimeSec],
      );
    }

    // 3) 寫入日誌批次 + 即時廣播給儀表板
    if (t.logs?.length) {
      for (const log of t.logs) {
        const ts = log.ts ? new Date(log.ts) : new Date();
        await pool.query(
          `INSERT INTO logs (device_id, ts, level, source, message) VALUES ($1,$2,$3,$4,$5)`,
          [deviceId, ts, log.level, log.source, log.message],
        );
        broadcast({
          type: 'log',
          deviceId,
          entry: { ts: ts.toISOString(), level: log.level, source: log.source, message: log.message },
        });
      }
    }

    // 4) 廣播最新 device 狀態
    const view = await getDevice(deviceId);
    if (view) broadcast({ type: 'device', device: view });

    return reply.send({ ok: true });
  });
}
