import { useState } from 'react';
import { clearToken, getToken } from './api';
import { DeviceCard } from './components/DeviceCard';
import { DeviceDetail } from './components/DeviceDetail';
import { Login } from './components/Login';
import { useLiveDevices } from './useLiveDevices';

export function App() {
  const [authed, setAuthed] = useState(!!getToken());
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => { clearToken(); setAuthed(false); }} />;
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const { devices, connected, recentLogs } = useLiveDevices();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = devices.find((d) => d.id === selectedId) ?? null;

  const onlineCount = devices.filter((d) => d.online).length;

  return (
    <>
      <div className="topbar">
        <h1>設備監看儀表板</h1>
        <span className="conn">
          {devices.length} 台 · 在線 {onlineCount}
        </span>
        <div className="spacer" />
        <span className="conn">
          <span className={`dot ${connected ? 'on' : 'off'}`} />
          {connected ? '即時連線中' : '連線中斷'}
        </span>
        <button className="btn ghost" onClick={onLogout}>
          登出
        </button>
      </div>

      <div className="container">
        {selected ? (
          <DeviceDetail device={selected} liveLogs={recentLogs} onBack={() => setSelectedId(null)} />
        ) : devices.length === 0 ? (
          <div className="empty">
            尚未有任何機台回報。請在機台上設定並啟動 Agent（見 README）。
          </div>
        ) : (
          <div className="grid">
            {devices.map((d) => (
              <DeviceCard key={d.id} device={d} onClick={() => setSelectedId(d.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
