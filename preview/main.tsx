import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { cloudConfigured } from '../lib/cloud-client';
import '../app/globals.css';

// Keep account and friend controls out of the hike's initial route bundle.
const Summit = lazy(() => import('../app/summit'));
const Registration = lazy(() => import('../app/register/registration'));
const LeadershipPortal = lazy(() => import('../app/leadership/portal'));
const MemberProfile = lazy(() => import('../app/profile/profile'));
const CloudLeadership = lazy(() => import('../app/leadership/cloud-portal'));
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const path = window.location.pathname.slice(base.length).replace(/\/$/, '') || '/';
const page = path === '/profile' ? <MemberProfile/>
  : path === '/register' ? <Registration signInHref="/register" signOutHref="/register" localPreview={false}/>
  : path === '/leadership' ? cloudConfigured ? <CloudLeadership/> : <LeadershipPortal account={null} signInHref="/leadership" signOutHref="/leadership" localPreview={false} previewOnly/>
  : <Summit/>;
createRoot(document.getElementById('root')!).render(<Suspense fallback={<div role="status" style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', background: '#10231d', color: '#f4eee4', font: '14px Arial' }}>Opening SUMMIT…</div>}>{page}</Suspense>);
