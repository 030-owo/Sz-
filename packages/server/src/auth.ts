import { createHash } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// ── 儀表板（管理員）認證 ──

export function checkAdminLogin(user: string, pass: string): boolean {
  return user === ADMIN_USER && pass === ADMIN_PASS;
}

export function issueAdminToken(): string {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
}

export function verifyAdminToken(token: string): boolean {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { role?: string };
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

/** Fastify preHandler：保護需要管理員登入的儀表板 API。 */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !verifyAdminToken(token)) {
    reply.code(401).send({ error: 'unauthorized' });
  }
}

// ── Agent 認證（每台機台一組 bearer token）──

/** 依 Authorization bearer token 解析出 device_id；無效則回傳 null。 */
export async function deviceIdFromToken(req: FastifyRequest): Promise<string | null> {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const { rows } = await pool.query<{ device_id: string }>(
    'SELECT device_id FROM device_tokens WHERE token_hash = $1 AND revoked = false',
    [sha256(token)],
  );
  return rows[0]?.device_id ?? null;
}
