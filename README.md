# 設備監看儀表板 (Device Monitoring Dashboard)

出貨到各地廠商的 Windows 機台，分散在客戶端、躲在 NAT/防火牆後面無法直接連入。
本系統讓你只要在公司開一個網頁，就能**即時**看到每一台只要有連網路的機台回報的
**在線狀態、系統指標、軟體狀態與錯誤日誌**，方便遠端維護與即時抓 bug。

採用**「機台主動往外推資料」的 push 模型**：機台上的 Agent 主動連你的伺服器回報，
克服無法直連的限制。你只需要一台有公網 IP / 網域的 VPS。

```
客戶端機台 (Windows)                          你的 VPS (Docker)
┌─────────────────────────┐                 ┌──────────────────────────────┐
│ 你的軟體(任何語言)       │                 │ Caddy (自動 HTTPS)            │
│  ├ 寫 log 到資料夾 ──┐   │                 │   └ server (Fastify + WS)     │
│  └ 出錯 POST 本機API ┤   │  HTTPS push     │       ├ /api/v1/telemetry     │
│ Agent                │   │ ──────────────▶ │       ├ /api/v1/devices       │
│  ├ 收集系統指標 ─────┤   │  每 N 秒        │       └ /ws (即時推儀表板)    │
│  ├ tail 日誌檔 ──────┤   │                 │   PostgreSQL                  │
│  └ 本機 :9900 API ───┘   │                 │   React 儀表板                │
└─────────────────────────┘                 └──────────────────────────────┘
        你在公司用瀏覽器開 ───── HTTPS ─────▶ 儀表板
```

## 專案結構

```
packages/
├─ shared/   共用 TypeScript 型別與 zod 驗證 schema（三端單一真相）
├─ server/   後端 Fastify + WebSocket + PostgreSQL
├─ agent/    機台端 Agent（跨平台，可打包成 Windows exe）
└─ web/      React 儀表板
```

## 快速開始（本機開發 / 試跑）

需求：Node 20+、Docker（或本機 PostgreSQL）。

```bash
# 1. 安裝相依套件
npm install

# 2. 建置 shared 型別（其他套件相依它）
npm run build:shared

# 3. 啟動資料庫（用 Docker）
cp .env.example .env          # 視需要改密碼
docker compose up -d db

# 4. 啟動後端（會自動跑 migration 建表）
npm run dev:server            # 監聽 :8080

# 5. 啟動前端儀表板（開發模式，會把 /api 與 /ws 代理到 :8080）
npm run dev:web               # 開 http://localhost:5173
```

預設儀表板登入帳密來自 `.env` 的 `ADMIN_USER` / `ADMIN_PASS`。

### 讓一台機台上線

```bash
# A. 在伺服器端為這台機台產生 token（會印出明文 token，只出現這一次）
npm run seed-token -w packages/server -- "客戶A-產線1號機" "客戶A"
#   （Docker 部署時：docker compose exec server node packages/server/dist/seed-token.js "機台名" "廠商")

# B. 在機台上建立 agent.json（參考 packages/agent/agent.example.json）
#    填入 serverUrl、上一步的 token、要 tail 的 log 檔路徑

# C. 啟動 Agent
npm run build -w packages/agent
AGENT_CONFIG=/path/to/agent.json node packages/agent/dist/index.js
```

幾秒內就會在儀表板看到該機台上線、指標跳動。

## 正式部署到 VPS

```bash
# 在 VPS 上
cp .env.example .env
#  - 改強密碼 (POSTGRES_PASSWORD / ADMIN_PASS / JWT_SECRET)
#  - 把 DATABASE_URL 密碼同步改掉
#  - SITE_ADDRESS 設成你的網域，例如 fleet.example.com（Caddy 會自動簽 HTTPS 憑證）

# 帶起 db + server + caddy（caddy 走 prod profile）
docker compose --profile prod up -d --build

# 為每台出貨機台各產生一組 token
docker compose exec server node packages/server/dist/seed-token.js "機台名稱" "廠商名稱"
```

> 本機測試不想用 Caddy，可省略 `--profile prod`，直接連 `http://<vps-ip>:8080`，
> 並把 `agent.json` 的 `serverUrl` 設成該位址。

### 把 Agent 裝成 Windows 開機自啟服務

把 `agent.json` 與 Agent（建議用 `pkg` / Node SEA 打包成單一 `agent.exe`）放到機台上，
用 [NSSM](https://nssm.cc/) 註冊成服務：

```powershell
nssm install SzFleetAgent "C:\SzAgent\agent.exe"
nssm set SzFleetAgent AppEnvironmentExtra AGENT_CONFIG=C:\SzAgent\agent.json
nssm start SzFleetAgent
```

## 把你的軟體接進來（兩種方式，可並用）

你的軟體是其他語言也沒關係，Agent 用兩種**語言無關**的方式取得狀態與錯誤：

**方式一：tail 日誌檔（不動你的程式碼）**
讓你的軟體把 log 寫到固定檔案，在 `agent.json` 的 `logPaths` 列出該檔路徑即可。
Agent 會持續讀取新行、自動判斷等級（含 `ERROR`/`WARN`/`FATAL` 等關鍵字）。

**方式二：本機 API（出錯時主動回報，含軟體狀態）**
你的軟體在發生錯誤時，POST 到 Agent 的本機端點（只綁 `127.0.0.1`，不對外）：

```bash
curl -X POST http://127.0.0.1:9900/event \
  -H "content-type: application/json" \
  -d '{"level":"error","message":"資料庫連線中斷","appState":"error"}'
```

`appState` 會更新該機台在儀表板上的「軟體狀態」標籤。

## agent.json 設定欄位

| 欄位 | 說明 | 預設 |
|---|---|---|
| `serverUrl` | 後端伺服器位址 | （必填）|
| `token` | 此機台的 bearer token | （必填）|
| `name` / `vendor` | 機台名稱 / 廠商 | 主機名 |
| `appVersion` | 你的軟體版本（顯示用） | — |
| `logPaths` | 要 tail 的日誌檔路徑清單 | `[]` |
| `intervalMs` | 回報週期（毫秒） | `10000` |
| `localApiPort` | 本機事件 API 埠（設 `0` 關閉） | `9900` |

## 設計重點

- **斷線不掉資料**：Agent 送失敗時本機緩衝日誌，指數退避重試（2/4/8/16s），連回來補送。
- **在線狀態即時推算**：不存欄位，由 `now() - last_seen` 計算；超過 90 秒無心跳即視為離線。
- **認證**：每台機台一組 token（DB 只存 sha256 hash）；儀表板用管理員帳密登入發 JWT。
- **即時更新**：儀表板開頁先 REST 載入，之後靠 WebSocket 增量更新卡片與日誌。

## 後續可擴充（本次 MVP 未做，架構已預留）

- 遠端下指令 / 操控機台（沿用同一條 WebSocket 反向下發）
- 告警通知（Email / Line / Webhook）
- 多使用者角色權限、指標長期降採樣保存

## 技術棧

Node/TypeScript · Fastify · @fastify/websocket · PostgreSQL · React · Vite · Recharts · systeminformation · zod · Docker · Caddy
