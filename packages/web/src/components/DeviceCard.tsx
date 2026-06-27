import type { DeviceView } from '@sz/shared';
import { bytes, pct, timeAgo } from '../format';

function Meter({ label, used, total, suffix }: { label: string; used: number; total: number; suffix?: string }) {
  const p = pct(used, total);
  const color = p > 90 ? 'var(--red)' : p > 75 ? 'var(--yellow)' : 'var(--green)';
  return (
    <div className="meter">
      <div className="meter-label">
        <span>{label}</span>
        <span>
          {p}% {suffix}
        </span>
      </div>
      <div className="bar">
        <span style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

export function DeviceCard({ device, onClick }: { device: DeviceView; onClick: () => void }) {
  const m = device.latest;
  const errState = device.appState && /error|crash|fail|stop/i.test(device.appState);
  return (
    <div className={`card ${device.online ? '' : 'offline'}`} onClick={onClick}>
      <div className="card-head">
        <span className="name">{device.name}</span>
        <span className={`badge ${device.online ? 'on' : 'off'}`}>
          {device.online ? '在線' : '離線'}
        </span>
      </div>
      <div className="sub">
        {device.vendor ? `${device.vendor} · ` : ''}
        最後回報 {timeAgo(device.lastSeen)}
      </div>

      {m ? (
        <>
          <Meter label="CPU" used={m.cpuPct} total={100} />
          <Meter label="記憶體" used={m.memUsed} total={m.memTotal} suffix={`(${bytes(m.memUsed)}/${bytes(m.memTotal)})`} />
          <Meter label="磁碟" used={m.diskUsed} total={m.diskTotal} suffix={`(${bytes(m.diskUsed)}/${bytes(m.diskTotal)})`} />
        </>
      ) : (
        <div className="sub">尚無指標資料</div>
      )}

      {device.appState && (
        <span className={`appstate ${errState ? 'err' : ''}`}>軟體：{device.appState}</span>
      )}
    </div>
  );
}
