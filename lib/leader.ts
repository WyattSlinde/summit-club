import {env} from 'cloudflare:workers';
import type {ChatGPTUser} from '../app/chatgpt-auth';
/** Only site-scoped identities configured on the server can see member records. */
export function isLeader(user: ChatGPTUser | null) {
  if (!user) return false;
  const config = env as unknown as { SUMMIT_LEADER_ID?: string; SUMMIT_LEADER_IDS?: string };
  const leaders = [config.SUMMIT_LEADER_ID, ...(config.SUMMIT_LEADER_IDS ?? '').split(',')]
    .map(value => value?.trim()).filter(Boolean);
  return leaders.includes(user.userId) || (import.meta.env.DEV && user.userId === 'local_seedy');
}
