import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { checkAdminLogin, issueAdminToken } from '../auth.js';

const LoginSchema = z.object({ user: z.string(), pass: z.string() });

/** 儀表板登入：POST /api/v1/login → 回 JWT。 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/login', async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid payload' });
    const { user, pass } = parsed.data;
    if (!checkAdminLogin(user, pass)) {
      return reply.code(401).send({ error: 'invalid credentials' });
    }
    return { token: issueAdminToken() };
  });
}
