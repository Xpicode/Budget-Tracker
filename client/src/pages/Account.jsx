import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { api } from '../api';
import { sync, dirtyCount } from '../sync';

// The account section of the Settings page: log in / create account, or sync now / log out.
export default function Account({ emailReset = false }) {
  const navigate = useNavigate();
  const cachedUser = useLiveQuery(() => db.meta.get('user'))?.value;
  const user = emailReset ? null : cachedUser;
  const [token] = useState(() => emailReset ? new URLSearchParams(location.hash.slice(1)).get('token') ?? '' : '');
  const [mode, setMode] = useState(emailReset ? 'email-reset' : 'login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function requestReset(e) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email');
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof TypeError ? 'Connect to the internet to request a reset email.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setError('');
    setMessage('');
    if (f.get('password') !== f.get('confirmation')) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api(mode === 'email-reset' ? '/api/auth/reset-password-email' : '/api/auth/change-password', {
        method: 'POST',
        body: mode === 'email-reset' ? { token, password: f.get('password') }
          : { current_password: f.get('current_password'), password: f.get('password') },
      });
      form.reset();
      setMode('login');
      if (emailReset) navigate('/', { replace: true });
      setMessage(user ? 'Password changed. Existing sessions remain signed in.' : 'Password reset. Log in with your new password.');
    } catch (err) {
      setError(err instanceof TypeError ? 'Connect to the internet to change your password.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  const passwordFields = <>
    <label>New password<input type="password" name="password" required minLength={8} autoComplete="new-password" /></label>
    <label>Confirm new password<input type="password" name="confirmation" required minLength={8} autoComplete="new-password" /></label>
  </>;

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
        {message && <p role="status">{message}</p>}
        <div className="actions">
          <button type="button" onClick={() => sync()}>Sync now</button>
          <span className="spacer" />
          <button type="button" className="danger" onClick={logout}>Log out</button>
        </div>
        <details>
          <summary>Change password</summary>
          <form onSubmit={updatePassword} className="card">
            <label>Current password<input type="password" name="current_password" required autoComplete="current-password" /></label>
            {passwordFields}
            <button type="submit" disabled={busy}>Change password</button>
            <p className="hint">Requires internet. Your budget data is not changed.</p>
          </form>
        </details>
      </section>
    );
  }

  if (mode === 'forgot') {
    return <form className="card" onSubmit={requestReset}>
      <h2>Forgot password?</h2>
      <label>Email<input type="email" name="email" required autoComplete="email" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button type="submit" className="primary" disabled={busy}>Email me a reset link</button>
      <button type="button" className="link" disabled={busy} onClick={() => { setMode('login'); setError(''); setMessage(''); }}>Back to login</button>
      <p className="hint">Links expire in 15 minutes and work once. Wait a minute before requesting another.</p>
    </form>;
  }

  if (mode === 'email-reset') {
    return <form className="card" onSubmit={updatePassword}>
      <h2>Reset password</h2>
      {passwordFields}
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>Reset password</button>
      <button type="button" className="link" disabled={busy} onClick={() => { setMode('login'); setError(''); }}>Back to login</button>
      <p className="hint">Your email link works once and expires after 15 minutes.</p>
    </form>;
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
      {message && <p role="status">{message}</p>}
      <button type="submit" className="primary" disabled={busy}>{isLogin ? 'Log in' : 'Create account'}</button>
      <button type="button" className="link" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); }}>
        {isLogin ? 'No account yet? Create one' : 'Have an account? Log in'}
      </button>
      {isLogin && <button type="button" className="link" disabled={busy} onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}>Forgot password?</button>}
      <p className="hint">Log in online once on this device. You can then use your budget offline until you log out.</p>
    </form>
  );
}
