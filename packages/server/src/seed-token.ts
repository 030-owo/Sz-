import { randomBytes } from 'node:crypto';
import { pool } from './db.js';
import { sha256 } from './auth.js';

/**
 * 建立一台機台 + 一組 Agent token，把明文 token 印出來（只會出現這一次）。
 * 用法：
 *   npm run seed-token -w packages/server -- "機台名稱" "廠商名稱"
 *   (docker) docker compose exec server node dist/seed-token.js "機台名稱" "廠商名稱"
 */
async function main(): Promise<void> {
  const name = process.argv[2] || 'demo-device';
  const vendor = process.argv[3] || null;

  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  const { rows } = await pool.query<{ id: string }>(
    'INSERT INTO devices (name, vendor) VALUES ($1, $2) RETURNING id',
    [name, vendor],
  );
  const deviceId = rows[0].id;

  const token = randomBytes(24).toString('hex');
  await pool.query(
    'INSERT INTO device_tokens (token_hash, device_id, label) VALUES ($1, $2, $3)',
    [sha256(token), deviceId, name],
  );

  console.log('─'.repeat(60));
  console.log(`device_id : ${deviceId}`);
  console.log(`name      : ${name}`);
  console.log(`TOKEN     : ${token}`);
  console.log('─'.repeat(60));
  console.log('把上面的 TOKEN 填進該機台的 agent.json 的 "token" 欄位。');
  console.log('（token 只會顯示這一次，資料庫只存 hash）');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
