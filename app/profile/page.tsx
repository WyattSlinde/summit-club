import type { Metadata } from 'next';
import MemberProfile from './profile';
export const metadata: Metadata = { title: 'Your profile | SUMMIT', robots: { index: false, follow: false } };
export default function ProfilePage() { return <MemberProfile/>; }
