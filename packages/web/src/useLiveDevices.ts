import { useEffect, useRef, useState } from 'react';
import type { DeviceView, ServerMessage } from '@sz/shared';
import { getToken } from './api';

export interface LiveLog {
  deviceId: string;
  ts: string;
  level: string;
  source: string;
  message: string;
}

/**
 * 透過 WebSocket 維持儀表板即時更新：
 * 連線時收 snapshot，之後 device / log 增量更新。斷線自動重連。
 */
export function useLiveDevices() {
  const [devices, setDevices] = useState<DeviceView[]>([]);
  const [connected, setConnected] = useState(false);
  const [recentLogs, setRecentLogs] = useState<LiveLog[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      const token = getToken();
      if (!token) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as ServerMessage;
        if (msg.type === 'snapshot') {
          setDevices(msg.devices);
        } else if (msg.type === 'device') {
          setDevices((prev) => {
            const i = prev.findIndex((d) => d.id === msg.device.id);
            if (i === -1) return [...prev, msg.device].sort((a, b) => a.name.localeCompare(b.name));
            const next = [...prev];
            next[i] = msg.device;
            return next;
          });
        } else if (msg.type === 'log') {
          setRecentLogs((prev) =>
            [{ deviceId: msg.deviceId, ...msg.entry }, ...prev].slice(0, 200),
          );
        }
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  return { devices, connected, recentLogs };
}
