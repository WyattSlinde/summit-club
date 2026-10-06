import type { Metadata } from 'next';
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from '../chatgpt-auth';
import { isLeader } from '@/lib/leader';
import LeadershipPortal from './portal';
import CloudLeadership from './cloud-portal';
import config from '@/lib/cloud-config.json';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Leadership | SUMMIT', robots: { index: false, follow: false } };

export default async function LeadershipPage() {
  if (config.url && config.publishableKey) return <CloudLeadership/>;
  const user = await getChatGPTUser();
  return <LeadershipPortal
    account={user ? { name: user.displayName, code: user.userId, leader: isLeader(user) } : null}
    signInHref={chatGPTSignInPath('/leadership')}
    signOutHref={chatGPTSignOutPath('/leadership')}
    localPreview={import.meta.env.DEV}
  />;
}
