import { env } from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('Club database unavailable');return env.DB;}
