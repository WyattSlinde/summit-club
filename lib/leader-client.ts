import { cloudConfigured, clubRequest } from './cloud-client';
import type { LeaderData } from './leader-data';
export async function leaderRequest(body?: Record<string, unknown>, signal?: AbortSignal): Promise<LeaderData> {
  if (cloudConfigured) return clubRequest<LeaderData>('leader', body ? { ...body, verb: body.action } : {});
  const response = await fetch('/api/leader', { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15000)]) });
  const result = await response.json() as LeaderData & { error?: string };
  if (!response.ok) throw new Error(result.error || 'Could not connect to the leadership desk.');
  return result;
}
