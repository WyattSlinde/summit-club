import type { Metadata } from 'next';
import { chatGPTSignInPath, chatGPTSignOutPath } from '../chatgpt-auth';
import Registration from './registration';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Join the crew | SUMMIT', robots: { index: false, follow: false } };

export default function RegisterPage() {
  return <Registration signInHref={chatGPTSignInPath('/register')} signOutHref={chatGPTSignOutPath('/register')} localPreview={import.meta.env.DEV}/>;
}
