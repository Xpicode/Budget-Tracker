import { beforeEach, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { LoginGate } from './App';
import Account from './pages/Account';

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: vi.fn() }));
vi.mock('./db', () => ({ db: { meta: { get: vi.fn() } } }));
vi.mock('./components/UpdateToast', () => ({ default: () => null }));

beforeEach(() => vi.clearAllMocks());

function renderGate(path = '/') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <LoginGate><div>Private budget content</div></LoginGate>
    </MemoryRouter>,
  );
}

test('loading the saved account never flashes private content', () => {
  useLiveQuery.mockReturnValue(undefined);
  const html = renderGate();
  expect(html).toContain('Loading your account...');
  expect(html).not.toContain('Private budget content');
});

test.each(['/', '/transactions', '/budgets', '/settings'])('signed-out visitors see login at %s', (path) => {
  useLiveQuery.mockReturnValue(null);
  const html = renderGate(path);
  expect(html).toContain('Log in to access your budget.');
  expect(html).toContain('type="password"');
  expect(html).toContain('Forgot password?');
  expect(html).not.toContain('Private budget content');
});

test('signed-in Settings exposes a current-password-protected change form', () => {
  useLiveQuery.mockReturnValue({ value: { id: 'owner', email: 'owner@example.com' } });
  const html = renderToStaticMarkup(<MemoryRouter><Account /></MemoryRouter>);
  expect(html).toContain('Change password');
  expect(html).toContain('name="current_password"');
  expect(html).toContain('name="confirmation"');
});

test('a saved login permits local access without a network request', () => {
  useLiveQuery.mockReturnValue({ id: 'owner', email: 'owner@example.com' });
  expect(renderGate('/transactions')).toContain('Private budget content');
});

test('email reset links show the new-password form even on a signed-in device', () => {
  useLiveQuery.mockReturnValue({ id: 'owner' });
  vi.stubGlobal('location', { hash: '#token=' + 'a'.repeat(64) });
  try {
    const html = renderGate('/reset-password');
    expect(html).toContain('Reset password');
    expect(html).toContain('name="confirmation"');
    expect(html).not.toContain('Private budget content');
    expect(html).not.toContain('name="recovery_code"');
  } finally {
    vi.unstubAllGlobals();
  }
});

test('the local account query distinguishes signed-out from loading', async () => {
  useLiveQuery.mockReturnValue(undefined);
  renderGate();
  const query = useLiveQuery.mock.calls[0][0];
  db.meta.get.mockResolvedValue(undefined);
  expect(await query()).toBeNull();
  const user = { id: 'owner' };
  db.meta.get.mockResolvedValue({ key: 'user', value: user });
  expect(await query()).toEqual(user);
});
