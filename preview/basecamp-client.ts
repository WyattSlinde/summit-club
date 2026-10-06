import status from './status.json';
import { cloudConfigured, clubRequest } from '../lib/cloud-client';
export type { BasecampState, Member, VoteState } from '../lib/basecamp-client';

/** Static hosting uses Supabase for authenticated, shared records when configured. */
export async function basecampRequest<T>(init?: RequestInit): Promise<T> {
  if (cloudConfigured) {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    return clubRequest<T>(body?.action || 'basecamp', body || {});
  }
  if (init?.method && init.method.toUpperCase() !== 'GET') {
    throw new Error('Registration, voting, and suggestions will open when the live club backend is connected.');
  }
  return structuredClone(status) as T;
}
