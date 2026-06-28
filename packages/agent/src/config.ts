import { existsSync, readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { resolve } from 'node:path';

/** agent.json 結構 */
export interface AgentConfig {
  /** 後端 server 基底位址，例如 https://fleet.example.com 或 http://localhost:8080 */
  serverUrl: string;
  /** 此機台的 bearer token（由 seed-token 產生） */
  token: string;
  /** 機台顯示名稱；省略時用主機名 */
  name?: string;
  vendor?: string;
  /** 你的軟體目前版本（選填，純顯示） */
  appVersion?: string;
  /** 要 tail 的日誌檔路徑清單 */
  logPaths?: string[];
  /** 回報週期（毫秒），預設 10 秒 */
  intervalMs?: number;
  /** 本機事件 API 監聽埠，預設 9900；設 0 可關閉 */
  localApiPort?: number;
}

const DEFAULTS = {
  intervalMs: 10_000,
  localApiPort: 9900,
};

export function loadConfig(): Required<Omit<AgentConfig, 'vendor' | 'appVersion'>> &
  Pick<AgentConfig, 'vendor' | 'appVersion'> {
  // 優先讀環境變數指定的路徑，否則找工作目錄下的 agent.json / agent.local.json
  const path =
    process.env.AGENT_CONFIG ||
    ['agent.local.json', 'agent.json'].map((p) => resolve(p)).find((p) => existsSync(p)) ||
    resolve('agent.json');

  if (!existsSync(path)) {
    throw new Error(
      `找不到設定檔 ${path}。請複製 agent.example.json 為 agent.json 並填入 serverUrl 與 token。`,
    );
  }

  const raw = JSON.parse(readFileSync(path, 'utf8')) as AgentConfig;
  if (!raw.serverUrl) throw new Error('agent.json 缺少 serverUrl');
  if (!raw.token) throw new Error('agent.json 缺少 token');

  return {
    serverUrl: raw.serverUrl.replace(/\/+$/, ''),
    token: raw.token,
    name: raw.name || hostname(),
    vendor: raw.vendor,
    appVersion: raw.appVersion,
    logPaths: raw.logPaths ?? [],
    intervalMs: raw.intervalMs ?? DEFAULTS.intervalMs,
    localApiPort: raw.localApiPort ?? DEFAULTS.localApiPort,
  };
}
