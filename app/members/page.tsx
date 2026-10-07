import type { Metadata } from 'next';
import MemberBasecamp from './basecamp';
export const metadata: Metadata = { title: 'Member basecamp | SUMMIT', robots: { index: false, follow: false } };
export default function MembersPage() { return <MemberBasecamp/>; }
