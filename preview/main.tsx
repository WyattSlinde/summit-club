import { createRoot } from 'react-dom/client';
import Summit from '../app/summit';
import Registration from '../app/register/registration';
import LeadershipPortal from '../app/leadership/portal';
import '../app/globals.css';

const path = window.location.pathname;
const page = path === '/register'
  ? <Registration signInHref="/register" signOutHref="/register" localPreview={false}/>
  : path === '/leadership'
    ? <LeadershipPortal account={null} signInHref="/leadership" signOutHref="/leadership" localPreview={false} previewOnly/>
    : <Summit/>;
createRoot(document.getElementById('root')!).render(page);
