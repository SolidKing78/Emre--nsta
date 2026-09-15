import NetInfo from '@react-native-community/netinfo';

import { AppError } from '@/types/errors';

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  /** When true a 401/403 maps to auth errors; default true. */
  authAware?: boolean;
}

async function ensureOnline(): Promise<void> {
  try {
    const state = await NetInfo.fetch();
    if (state.isConnected === false || state.isInternetReachable === false) {
      throw new AppError('offline');
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // NetInfo not available (e.g. tests) — assume online.
  }
}

/**
 * fetch() with timeout, offline detection and status → AppError mapping.
 * Returns the parsed JSON body (unknown) — callers validate with Zod.
 */
export async function httpJson(url: string, options: HttpOptions = {}): Promise<unknown> {
  await ensureOnline();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if ((err as { name?: string }).name === 'AbortError') {
      throw new AppError('network', 'Request timed out', { cause: err });
    }
    throw new AppError('network', err instanceof Error ? err.message : 'Network request failed', { cause: err });
  }
  clearTimeout(timeout);

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    throw mapHttpError(response.status, json, options.authAware ?? true);
  }
  if (json === null && text) {
    throw new AppError('invalid_response', 'Expected JSON response', { status: response.status });
  }
  return json;
}

export function mapHttpError(status: number, body: unknown, authAware: boolean): AppError {
  const message = extractMessage(body);
  if (status === 429) return new AppError('rate_limit', message, { status });
  if (status === 404) return new AppError('not_found', message, { status });
  if (authAware && (status === 401 || status === 403)) {
    const lower = (message ?? '').toLowerCase();
    if (lower.includes('permission') || lower.includes('scope')) {
      return new AppError('insufficient_permission', message, { status });
    }
    if (lower.includes('professional') || lower.includes('business')) {
      return new AppError('not_professional', message, { status });
    }
    return new AppError('auth_expired', message, { status });
  }
  if (status >= 500) return new AppError('network', message, { status, retryable: true });
  return new AppError('unknown', message, { status });
}

function extractMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;
  if (record.error && typeof record.error === 'object') {
    const inner = record.error as Record<string, unknown>;
    if (typeof inner.message === 'string') return inner.message;
  }
  return undefined;
}
