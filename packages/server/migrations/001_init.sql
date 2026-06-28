-- 設備監看儀表板 — 初始 schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 機台主檔。online 狀態不存欄位，由 now() - last_seen 即時推算。
CREATE TABLE IF NOT EXISTS devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL DEFAULT 'unnamed',
  vendor        text,
  os            text,
  agent_version text,
  app_version   text,
  app_state     text,
  first_seen    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz NOT NULL DEFAULT now(),
  last_ip       text
);

-- Agent 認證用 token。只存 sha256 hash，明文僅在發行時交給機台。
CREATE TABLE IF NOT EXISTS device_tokens (
  token_hash text PRIMARY KEY,
  device_id  uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  label      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked    boolean NOT NULL DEFAULT false
);

-- 系統指標時序。MVP 用一般表；資料量大時可改 TimescaleDB / 分區。
CREATE TABLE IF NOT EXISTS metrics (
  id          bigserial PRIMARY KEY,
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ts          timestamptz NOT NULL DEFAULT now(),
  cpu_pct     real NOT NULL,
  mem_used    bigint NOT NULL,
  mem_total   bigint NOT NULL,
  disk_used   bigint NOT NULL,
  disk_total  bigint NOT NULL,
  uptime_sec  bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS metrics_device_ts_idx ON metrics (device_id, ts DESC);

-- 日誌 / 錯誤事件（source: file = tail 日誌檔, api = 軟體主動回報）
CREATE TABLE IF NOT EXISTS logs (
  id         bigserial PRIMARY KEY,
  device_id  uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ts         timestamptz NOT NULL DEFAULT now(),
  level      text NOT NULL DEFAULT 'info',
  source     text NOT NULL DEFAULT 'file',
  message    text NOT NULL
);
CREATE INDEX IF NOT EXISTS logs_device_ts_idx ON logs (device_id, ts DESC);
CREATE INDEX IF NOT EXISTS logs_device_level_idx ON logs (device_id, level);
