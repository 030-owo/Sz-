import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

export const pool = new pg.Pool({ connectionString, max: 10 });

/** 啟動時依序套用 migrations/ 下的 .sql（冪等，重複跑安全）。 */
export async function runMigrations(): Promise<void> {
  // 在 dist 與 src 兩種執行情境下都能找到 migrations 目錄
  const candidates = [
    join(__dirname, '..', 'migrations'),
    join(__dirname, '..', '..', 'migrations'),
  ];
  const dir = candidates.find((d) => {
    try {
      readdirSync(d);
      return true;
    } catch {
      return false;
    }
  });
  if (!dir) throw new Error('migrations directory not found');

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    await pool.query(sql);
    console.log(`[db] applied migration ${f}`);
  }
}
