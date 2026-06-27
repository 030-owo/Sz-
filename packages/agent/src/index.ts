import { platform, release, type } from 'node:os';
import type { LogEntry, Telemetry } from '@sz/shared';
import { loadConfig } from './config.js';
import { LocalApi } from './localapi.js';
import { LogWatcher } from './logwatch.js';
import { collectMetrics } from './metrics.js';

const AGENT_VERSION = '0.1.0';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const osLabel = `${type()} ${release()} (${platform()})`;
  console.log(`[agent] starting "${cfg.name}" → ${cfg.serverUrl} (every ${cfg.intervalMs}ms)`);

  const watcher = new LogWatcher(cfg.logPaths);
  watcher.start();
  const localApi = new LocalApi(cfg.localApiPort);
  localApi.start();

  // 斷線時暫存未送出的日誌，連回來一起補送（不掉資料）
  let pendingLogs: LogEntry[] = [];

  const tick = async (): Promise<void> => {
    let metrics: Telemetry['metrics'];
    try {
      metrics = await collectMetrics();
    } catch (e) {
      console.error('[agent] collectMetrics failed:', (e as Error).message);
    }

    const fresh = [...pendingLogs, ...watcher.drain(), ...localApi.drain()].slice(-500);
    pendingLogs = [];

    const payload: Telemetry = {
      name: cfg.name,
      vendor: cfg.vendor,
      os: osLabel,
      agentVersion: AGENT_VERSION,
      appVersion: cfg.appVersion,
      appState: localApi.takeAppState(),
      metrics,
      logs: fresh.length ? fresh : undefined,
    };

    const ok = await sendWithRetry(cfg.serverUrl, cfg.token, payload);
    if (!ok) {
      // 送失敗：把這批日誌留到下次（指標可丟，反正下個週期會有新的）
      pendingLogs = fresh;
      console.error('[agent] telemetry not delivered, will retry next cycle');
    }
  };

  // 立即送一次，之後固定週期
  await tick();
  setInterval(() => {
    tick().catch((e) => console.error('[agent] tick error:', e));
  }, cfg.intervalMs);
}

/** POST telemetry，失敗時指數退避重試 2/4/8/16 秒。 */
async function sendWithRetry(serverUrl: string, token: string, payload: Telemetry): Promise<boolean> {
  const delays = [0, 2000, 4000, 8000, 16000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await sleep(delays[i]);
    try {
      const res = await fetch(`${serverUrl}/api/v1/telemetry`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return true;
      // 認證/格式錯誤重試也沒用，直接放棄
      if (res.status === 401 || res.status === 400) {
        console.error(`[agent] server rejected (${res.status}):`, await safeText(res));
        return false;
      }
    } catch (e) {
      // 網路錯誤 → 繼續退避重試
      if (i === delays.length - 1) {
        console.error('[agent] send failed:', (e as Error).message);
      }
    }
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

main().catch((err) => {
  console.error('[agent] fatal:', err);
  process.exit(1);
});
