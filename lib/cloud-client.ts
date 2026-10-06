import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import config from './cloud-config.json';

// Publishable configuration only. Never put a secret/service-role key in this file.
export const cloudConfigured = Boolean(config.url && config.publishableKey);
export const cloudAuthReady = cloudConfigured && config.authReady;
let instance: SupabaseClient | undefined;
export function cloudClient() {
  if (!cloudConfigured) throw new Error('Online member accounts are not connected yet.');
  if (!instance) instance = createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'summit-member-session-v1' },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(20000)]) }) },
  });
  return instance;
}
async function request<T>(rpc: string, operation: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await cloudClient().rpc(rpc, { operation, payload });
  if (error) {
    if (error.code === 'P0001') throw new Error(error.message);
    if (['23514', '23502', '22P02'].includes(error.code)) throw new Error('Check the form fields and try again.');
    if (error.code === '23505') throw new Error('This was already saved. Refresh and try again.');
    throw new Error('Could not connect to your club account. Check your connection and try again.');
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
export function clubRequest<T>(operation: string, payload: Record<string, unknown> = {}) { return request<T>('summit_request', operation, payload); }
export function communityRequest<T>(operation: string, payload: Record<string, unknown> = {}) { return request<T>('community_request', operation, payload); }
export function announceMemberChange() { window.dispatchEvent(new Event('summit:member-change')); }
export async function signOutMember() {
  const { error } = await cloudClient().auth.signOut({ scope: 'local' });
  if (error) throw new Error('Could not sign out. Please try again.');
  announceMemberChange();
}
