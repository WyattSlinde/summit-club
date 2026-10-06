import { createRoot } from 'react-dom/client';
import Summit from '../app/summit';
import Registration from '../app/register/registration';
import LeadershipPortal from '../app/leadership/portal';
import '../app/globals.css';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const path = window.location.pathname.slice(base.length).replace(/\/$/, '') || '/';
const page = path === '/register'
  ? <Registration signInHref="/register" signOutHref="/register" localPreview={false}/>
  : path === '/leadership'
    ? <LeadershipPortal account={null} signInHref="/leadership" signOutHref="/leadership" localPreview={false} previewOnly/>
    : <Summit/>;
createRoot(document.getElementById('root')!).render(page);
