import { describe, expect, it, vi } from 'vitest';
import { apiError, json, mockFetch } from '@test/mockFetch';
import { ApiError, NETWORK_ERROR_CODE, apiUrl, asApiError, request } from './client';

describe('apiUrl', () => {
  it('fills path parameters from the config', () => {
    expect(apiUrl('vote', { matchId: 7 })).toMatch(/\/7\/vote$/);
    expect(apiUrl('battle', { battleId: '12' })).toMatch(/\/12$/);
  });
});

describe('request', () => {
  const url = apiUrl('battle', { battleId: 1 });

  it('returns parsed JSON on success', async () => {
    mockFetch({ [`GET ${url}`]: () => json({ id: 1 }) });
    await expect(request(url)).resolves.toEqual({ id: 1 });
  });

  it('sends a JSON body with POST', async () => {
    const fetchMock = mockFetch({ [`POST ${url}`]: () => json({ ok: true }) });
    await request(url, { method: 'POST', body: { code: 'abc' } });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe('{"code":"abc"}');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('turns a contract error into ApiError with code and message', async () => {
    mockFetch({ [`GET ${url}`]: () => apiError(409, 'already_voted', 'Ты уже голосовал в этой дуэли') });
    const error = await request(url).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'already_voted', message: 'Ты уже голосовал в этой дуэли' });
  });

  it('reports an HTTP error without a contract body by status', async () => {
    mockFetch({ [`GET ${url}`]: () => new Response('<html>Bad gateway</html>', { status: 502 }) });
    const error = await request(url).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 502, code: 'http_error' });
    expect((error as ApiError).message).toContain('502');
  });

  it('reports a network failure as network_error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const error = await request(url).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 0, code: NETWORK_ERROR_CODE });
    expect((error as ApiError).message).toMatch(/Нет связи/);
  });

  it('accepts an empty successful body', async () => {
    mockFetch({ [`GET ${url}`]: () => new Response('', { status: 200 }) });
    await expect(request(url)).resolves.toBeNull();
  });
});

describe('asApiError', () => {
  it('keeps ApiError and wraps anything else', () => {
    const original = new ApiError(404, 'not_found', 'Нет');
    expect(asApiError(original)).toBe(original);
    expect(asApiError(new Error('boom'))).toMatchObject({ code: 'unknown' });
  });
});
