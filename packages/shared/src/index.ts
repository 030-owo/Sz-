import { z } from 'zod';

/**
 * 共用型別與驗證 schema — Agent、Server、Web 三端的單一真相。
 * telemetry payload 由 Agent 送出、Server 用 zod 驗證、Web 顯示。
 */

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** 一筆日誌 / 事件（來自 tail 日誌檔，或軟體主動 POST 到本機 API） */
export const LogEntrySchema = z.object({
  ts: z.string().datetime().optional(), // ISO8601；省略時由 server 蓋上接收時間
  level: z.enum(LOG_LEVELS).default('info'),
  source: z.enum(['file', 'api']).default('file'),
  message: z.string().min(1).max(8000),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;

/** 系統指標快照 */
export const MetricsSchema = z.object({
  cpuPct: z.number().min(0).max(100),
  memUsed: z.number().nonnegative(), // bytes
  memTotal: z.number().positive(), // bytes
  diskUsed: z.number().nonnegative(), // bytes
  diskTotal: z.number().positive(), // bytes
  uptimeSec: z.number().nonnegative(),
});
export type Metrics = z.infer<typeof MetricsSchema>;

/** Agent 每個週期送出的 telemetry 封包 */
export const TelemetrySchema = z.object({
  /** Agent 自報的識別資訊（device_id 由 server 依 token 決定，這裡僅供顯示/更新） */
  name: z.string().min(1).max(200).optional(),
  vendor: z.string().max(200).optional(),
  os: z.string().max(200).optional(),
  agentVersion: z.string().max(50).optional(),
  appVersion: z.string().max(50).optional(),
  /** 你的軟體當前運作狀態，例如 running / stopped / error */
  appState: z.string().max(50).optional(),
  metrics: MetricsSchema.optional(),
  logs: z.array(LogEntrySchema).max(500).optional(),
});
export type Telemetry = z.infer<typeof TelemetrySchema>;

/** 軟體 POST 到 Agent 本機 API (127.0.0.1:9900/event) 的格式 */
export const LocalEventSchema = z.object({
  level: z.enum(LOG_LEVELS).default('info'),
  message: z.string().min(1).max(8000),
  appState: z.string().max(50).optional(),
});
export type LocalEvent = z.infer<typeof LocalEventSchema>;

/** Server 回給儀表板的 device 視圖 */
export interface DeviceView {
  id: string;
  name: string;
  vendor: string | null;
  os: string | null;
  agentVersion: string | null;
  appVersion: string | null;
  appState: string | null;
  firstSeen: string;
  lastSeen: string;
  lastIp: string | null;
  online: boolean;
  latest: Metrics | null;
}

/** WebSocket 從 server 推給儀表板的訊息 */
export type ServerMessage =
  | { type: 'snapshot'; devices: DeviceView[] }
  | { type: 'device'; device: DeviceView }
  | { type: 'log'; deviceId: string; entry: Required<Pick<LogEntry, 'level' | 'source' | 'message'>> & { ts: string } };

/** 機台多久沒回報就視為離線（秒） */
export const OFFLINE_THRESHOLD_SEC = 90;
