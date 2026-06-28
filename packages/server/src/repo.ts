import type { DeviceView, Metrics } from '@sz/shared';
import { OFFLINE_THRESHOLD_SEC } from '@sz/shared';
import { pool } from './db.js';

/** 把 devices row + 最新一筆 metrics 組成儀表板用的 DeviceView。 */
const SELECT_DEVICE_VIEW = `
  SELECT
    d.id, d.name, d.vendor, d.os, d.agent_version, d.app_version, d.app_state,
    d.first_seen, d.last_seen, d.last_ip,
    m.cpu_pct, m.mem_used, m.mem_total, m.disk_used, m.disk_total, m.uptime_sec
  FROM devices d
  LEFT JOIN LATERAL (
    SELECT cpu_pct, mem_used, mem_total, disk_used, disk_total, uptime_sec
    FROM metrics WHERE device_id = d.id ORDER BY ts DESC LIMIT 1
  ) m ON true
`;

interface Row {
  id: string;
  name: string;
  vendor: string | null;
  os: string | null;
  agent_version: string | null;
  app_version: string | null;
  app_state: string | null;
  first_seen: Date;
  last_seen: Date;
  last_ip: string | null;
  cpu_pct: number | null;
  mem_used: string | null;
  mem_total: string | null;
  disk_used: string | null;
  disk_total: string | null;
  uptime_sec: string | null;
}

function toView(r: Row): DeviceView {
  const online = Date.now() - new Date(r.last_seen).getTime() < OFFLINE_THRESHOLD_SEC * 1000;
  const latest: Metrics | null =
    r.cpu_pct === null
      ? null
      : {
          cpuPct: Number(r.cpu_pct),
          memUsed: Number(r.mem_used),
          memTotal: Number(r.mem_total),
          diskUsed: Number(r.disk_used),
          diskTotal: Number(r.disk_total),
          uptimeSec: Number(r.uptime_sec),
        };
  return {
    id: r.id,
    name: r.name,
    vendor: r.vendor,
    os: r.os,
    agentVersion: r.agent_version,
    appVersion: r.app_version,
    appState: r.app_state,
    firstSeen: new Date(r.first_seen).toISOString(),
    lastSeen: new Date(r.last_seen).toISOString(),
    lastIp: r.last_ip,
    online,
    latest,
  };
}

export async function listDevices(): Promise<DeviceView[]> {
  const { rows } = await pool.query<Row>(`${SELECT_DEVICE_VIEW} ORDER BY d.name`);
  return rows.map(toView);
}

export async function getDevice(id: string): Promise<DeviceView | null> {
  const { rows } = await pool.query<Row>(`${SELECT_DEVICE_VIEW} WHERE d.id = $1`, [id]);
  return rows[0] ? toView(rows[0]) : null;
}
