import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { api } from '../api';
import { sync, dirtyCount } from '../sync';

// The account section of the Settings page: log in / create account, or sync now / log out.
export default function Account() {
  const navigate = useNavigate();
  const user = useLiveQuery(() => db.meta.get('user'))?.value;
  const [mode, setMode] = useState('login'); // login | register
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = { email: f.get('email'), password: f.get('password') };
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') await api('/api/auth/register', { method: 'POST', body });
      const me = await api('/api/auth/login', { method: 'POST', body });
      await db.meta.put({ key: 'user', value: me });
      sync();
      navigate('/');
    } catch (err) {
      setError(err instanceof TypeError ? 'Cannot reach the server. Try again when online.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setError('');
    const pending = await dirtyCount();
    if (pending > 0) {
      setError(`${pending} change${pending === 1 ? '' : 's'} not synced yet. Press Sync now first.`);
      return;
    }
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      setError('Cannot reach the server. Connect to the internet to log out.');
      return;
    }
    await db.delete();   // shared PC: nothing of this account stays in the browser
    location.href = '/'; // full reload reopens an empty database
  }

  if (user) {
    return (
      <section className="card">
        <p>Logged in as <strong>{user.email}</strong></p>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" onClick={() => sync()}>Sync now</button>
          <span className="spacer" />
          <button type="button" className="danger" onClick={logout}>Log out</button>
        </div>
      </section>
    );
  }

  const isLogin = mode === 'login';
  return (
    <form className="card" onSubmit={submit}>
      <label>
        Email
        <input type="email" name="email" required autoComplete="email" />
      </label>
      <label>
        Password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>{isLogin ? 'Log in' : 'Create account'}</button>
      <button type="button" className="link" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); }}>
        {isLogin ? 'No account yet? Create one' : 'Have an account? Log in'}
      </button>
      <p className="hint">Your data stays on this device. Logging in backs it up and syncs it to other devices.</p>
    </form>
  );
}
