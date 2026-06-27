import { useState } from 'react';
import { login } from '../api';

export function Login({ onDone }: { onDone: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await login(user, pass);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login" onSubmit={submit}>
        <h2>設備監看儀表板</h2>
        {err && <div className="err">{err}</div>}
        <input
          placeholder="帳號"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoFocus
        />
        <input
          placeholder="密碼"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        <button className="btn" style={{ width: '100%' }} disabled={busy}>
          {busy ? '登入中…' : '登入'}
        </button>
      </form>
    </div>
  );
}
