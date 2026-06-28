import type { WebSocket } from '@fastify/websocket';
import type { ServerMessage } from '@sz/shared';

/**
 * 簡單的 WebSocket hub：儀表板連進來後加入集合，
 * 有新 telemetry 進來時把更新廣播給所有連線。
 */
const clients = new Set<WebSocket>();

export function addClient(socket: WebSocket): void {
  clients.add(socket);
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
}

export function broadcast(msg: ServerMessage): void {
  const data = JSON.stringify(msg);
  for (const socket of clients) {
    if (socket.readyState === socket.OPEN) {
      socket.send(data);
    }
  }
}
