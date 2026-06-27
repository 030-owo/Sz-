import { createReadStream, existsSync, statSync, watch } from 'node:fs';
import type { LogEntry, LogLevel } from '@sz/shared';

/**
 * tail 多個日誌檔：從目前檔尾開始，檔案有新內容追加時讀出新行、解析等級，
 * 推進共用緩衝區，由主迴圈批次取走。處理檔案輪替（truncate / 重建）。
 */
export class LogWatcher {
  private buffer: LogEntry[] = [];
  private positions = new Map<string, number>();
  private readonly maxBuffer = 1000;

  constructor(private readonly paths: string[]) {}

  start(): void {
    for (const path of this.paths) {
      this.initFile(path);
    }
  }

  /** 取走並清空目前累積的日誌（最多回傳 maxBuffer 筆）。 */
  drain(): LogEntry[] {
    const out = this.buffer;
    this.buffer = [];
    return out;
  }

  private initFile(path: string): void {
    // 從現有檔尾開始，避免一啟動就把歷史整包送出
    this.positions.set(path, existsSync(path) ? statSync(path).size : 0);

    // 監看檔案所在；檔案可能尚未存在，watch 目錄較穩，但 MVP 直接 watch 檔案 + 輪詢補強
    const tryWatch = () => {
      try {
        watch(path, () => this.readNew(path));
      } catch {
        /* 檔案還沒出現，靠下方輪詢 */
      }
    };
    tryWatch();
    // 輪詢補強（fs.watch 在某些平台/網路磁碟不可靠）
    setInterval(() => this.readNew(path), 2000).unref();
  }

  private readNew(path: string): void {
    if (!existsSync(path)) return;
    let size: number;
    try {
      size = statSync(path).size;
    } catch {
      return;
    }
    let pos = this.positions.get(path) ?? 0;
    if (size < pos) pos = 0; // 檔案被截斷/輪替，從頭讀
    if (size === pos) return;

    const stream = createReadStream(path, { start: pos, end: size - 1, encoding: 'utf8' });
    let tail = '';
    stream.on('data', (chunk) => {
      tail += chunk;
    });
    stream.on('end', () => {
      const lines = tail.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.push(trimmed);
      }
      this.positions.set(path, size);
    });
    stream.on('error', () => {
      /* 忽略單次讀取錯誤，下次輪詢再試 */
    });
  }

  private push(message: string): void {
    if (this.buffer.length >= this.maxBuffer) this.buffer.shift();
    this.buffer.push({
      level: detectLevel(message),
      source: 'file',
      message: message.slice(0, 8000),
    });
  }
}

/** 從一行文字粗略判斷等級。 */
function detectLevel(line: string): LogLevel {
  const u = line.toUpperCase();
  if (/\b(FATAL|CRITICAL|PANIC)\b/.test(u)) return 'fatal';
  if (/\b(ERROR|ERR|EXCEPTION|FAIL(ED|URE)?)\b/.test(u)) return 'error';
  if (/\b(WARN(ING)?)\b/.test(u)) return 'warn';
  if (/\b(DEBUG|TRACE)\b/.test(u)) return 'debug';
  return 'info';
}
