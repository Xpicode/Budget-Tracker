import { test, expect, vi, afterEach } from 'vitest';
import { api } from './api';

const respond = (status, text) => vi.stubGlobal('fetch', async () => new Response(text, { status }));

afterEach(() => {
  vi.unstubAllGlobals();
});

test('returns the JSON body on success', async () => {
  respond(200, '{"ok":true}');
  expect(await api('/api/health')).toEqual({ ok: true });
});

test('an error response throws with its status and message', async () => {
  respond(401, '{"error":"Not logged in"}');
  await expect(api('/api/auth/me')).rejects.toMatchObject({ status: 401, message: 'Not logged in' });
});

test('a 200 that is not JSON is an error, so sync can never mark unsent rows as saved', async () => {
  respond(200, '<!doctype html><html></html>');
  await expect(api('/api/sync/push')).rejects.toThrow('unexpected response');
});

test('an Android build with no server address fails like being offline, without calling fetch', async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubGlobal('Capacitor', { isNativePlatform: () => true });
  await expect(api('/api/sync/pull')).rejects.toBeInstanceOf(TypeError);
  expect(fetchSpy).not.toHaveBeenCalled();
});
