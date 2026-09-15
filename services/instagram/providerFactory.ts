import type { AppSession } from '@/store/authStore';
import { AppError } from '@/types/errors';

import type { InstagramProvider } from './InstagramProvider';
import { ManualInstagramProvider } from './ManualInstagramProvider';
import { MetaInstagramProvider } from './MetaInstagramProvider';
import { MockInstagramProvider } from './MockInstagramProvider';
import { PublicInstagramProvider } from './PublicInstagramProvider';

const cache = new Map<string, InstagramProvider>();

/**
 * Picks the provider for the current session. The UI never imports a concrete
 * provider — it only ever sees `InstagramProvider`.
 */
export function getInstagramProvider(session: AppSession | null): InstagramProvider {
  if (!session) throw new AppError('auth_expired', 'No active session');
  const existing = cache.get(session.accountKey);
  if (existing) return existing;

  let provider: InstagramProvider;
  switch (session.source) {
    case 'demo':
      provider = new MockInstagramProvider();
      break;
    case 'public':
      provider = new PublicInstagramProvider(session.username);
      break;
    case 'manual':
      provider = new ManualInstagramProvider(session.accountId ?? session.username);
      break;
    case 'live':
      if (!session.sessionToken) throw new AppError('auth_expired', 'Missing session token');
      provider = new MetaInstagramProvider(session.sessionToken);
      break;
    default:
      provider = new MockInstagramProvider();
  }
  cache.set(session.accountKey, provider);
  return provider;
}

export async function invalidateProvider(session: AppSession | null): Promise<void> {
  if (!session) return;
  const provider = cache.get(session.accountKey);
  await provider?.invalidate?.();
  cache.delete(session.accountKey);
}

export function dropAllProviders(): void {
  cache.clear();
}
