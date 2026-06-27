import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DeviceView, Metrics } from '@sz/shared';
import { fetchLogs, fetchMetrics, type LogRow } from '../api';
import { bytes, pct, timeAgo, timeOf, uptime } from '../format';
import type { LiveLog } from '../useLiveDevices';

export function DeviceDetail({
  device,
  liveLogs,
  onBack,
}: {
  device: DeviceView;
  liveLogs: LiveLog[];
  onBack: () => void;
}) {
  const [history, setHistory] = useState<(Metrics & { ts: string })[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);

  useEffect(() => {
    fetchMetrics(device.id).then((r) => setHistory(r.metrics)).catch(() => {});
    fetchLogs(device.id).then((r) => setLogs(r.logs)).catch(() => {});
  }, [device.id]);

  // 把這台機台的即時日誌合併到列表最前面
  const merged: LogRow[] = [
    ...liveLogs.filter((l) => l.deviceId === device.id).map((l) => ({
      ts: l.ts,
      level: l.level,
      source: l.source,
      message: l.message,
    })),
    ...logs,
  ].slice(0, 300);

  const chartData = history.map((m) => ({
    t: timeOf(m.ts),
    CPU: m.cpuPct,
    記憶體: pct(m.memUsed, m.memTotal),
    磁碟: pct(m.diskUsed, m.diskTotal),
  }));

  const m = device.latest;

  return (
    <div>
      <div className="detail-head">
        <button className="btn ghost" onClick={onBack}>
          ← 返回
        </button>
        <h2 style={{ margin: 0 }}>{device.name}</h2>
        <span className={`badge ${device.online ? 'on' : 'off'}`}>
          {device.online ? '在線' : '離線'}
        </span>
      </div>

      <div className="panel">
        <h3>基本資訊</h3>
        <div className="kv">
          <div>
            <span>廠商</span>
            {device.vendor || '—'}
          </div>
          <div>
            <span>作業系統</span>
            {device.os || '—'}
          </div>
          <div>
            <span>軟體版本</span>
            {device.appVersion || '—'}
          </div>
          <div>
            <span>軟體狀態</span>
            {device.appState || '—'}
          </div>
          <div>
            <span>Agent 版本</span>
            {device.agentVersion || '—'}
          </div>
          <div>
            <span>開機時間</span>
            {m ? uptime(m.uptimeSec) : '—'}
          </div>
          <div>
            <span>最後 IP</span>
            {device.lastIp || '—'}
          </div>
          <div>
            <span>最後回報</span>
            {timeAgo(device.lastSeen)}
          </div>
        </div>
        {m && (
          <div className="kv" style={{ marginTop: 12 }}>
            <div>
              <span>CPU</span>
              {m.cpuPct}%
            </div>
            <div>
              <span>記憶體</span>
              {bytes(m.memUsed)} / {bytes(m.memTotal)} ({pct(m.memUsed, m.memTotal)}%)
            </div>
            <div>
              <span>磁碟</span>
              {bytes(m.diskUsed)} / {bytes(m.diskTotal)} ({pct(m.diskUsed, m.diskTotal)}%)
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>指標走勢（%）</h3>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2c3a4f" />
              <XAxis dataKey="t" stroke="#8b98a9" fontSize={11} minTickGap={40} />
              <YAxis domain={[0, 100]} stroke="#8b98a9" fontSize={11} />
              <Tooltip contentStyle={{ background: '#1a2230', border: '1px solid #2c3a4f' }} />
              <Area type="monotone" dataKey="CPU" stroke="#388bfd" fill="#388bfd33" />
              <Area type="monotone" dataKey="記憶體" stroke="#2ea043" fill="#2ea04333" />
              <Area type="monotone" dataKey="磁碟" stroke="#d29922" fill="#d2992233" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty">指標累積中，稍候會出現走勢…</div>
        )}
      </div>

      <div className="panel">
        <h3>日誌與錯誤（即時）</h3>
        <div className="logs">
          {merged.length === 0 && <div className="empty">目前沒有日誌</div>}
          {merged.map((l, i) => (
            <div className="logrow" key={i}>
              <span className="t">{timeOf(l.ts)}</span>
              <span className={`lvl ${l.level}`}>{l.level.toUpperCase()}</span>
              <span className="src">{l.source}</span>
              <span>{l.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
