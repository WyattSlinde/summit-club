import { sitePath } from '../lib/site-path';
const router = { push:(href:string)=>window.location.assign(sitePath(href)), replace:(href:string)=>window.location.replace(sitePath(href)) };
export function useRouter(){return router;}
