import os from 'node:os';
import si from 'systeminformation';
import type { Metrics } from '@sz/shared';

/** 用 systeminformation 抓跨平台系統指標（Windows / Linux 皆可）。 */
export async function collectMetrics(): Promise<Metrics> {
  const [load, mem, fs] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize().catch(() => []),
  ]);

  // 磁碟：加總所有實體磁碟（避免重複計算 overlay/tmpfs 等）
  let diskUsed = 0;
  let diskTotal = 0;
  for (const d of fs) {
    if (d.size && d.type && !['tmpfs', 'overlay', 'squashfs', 'devtmpfs'].includes(d.type)) {
      diskTotal += d.size;
      diskUsed += d.used;
    }
  }
  // 萬一抓不到任何磁碟，至少回報一個非零 total 以符合 schema
  if (diskTotal === 0) {
    diskTotal = 1;
    diskUsed = 0;
  }

  return {
    cpuPct: Math.max(0, Math.min(100, Number(load.currentLoad.toFixed(1)))),
    memUsed: mem.active ?? mem.used,
    memTotal: mem.total,
    diskUsed,
    diskTotal,
    uptimeSec: Math.floor(os.uptime()),
  };
}
