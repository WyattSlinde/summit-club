import { createMailHandler } from './worker.ts';
declare const Deno:{env:{get:(key:string)=>string|undefined};serve:(handler:(request:Request)=>Promise<Response>)=>void};
const value=(key:string)=>Deno.env.get(key)||'';
Deno.serve(createMailHandler({url:value('SUPABASE_URL'),serviceKey:value('SUPABASE_SERVICE_ROLE_KEY'),resendKey:value('RESEND_API_KEY'),from:value('SUMMIT_MAIL_FROM'),workerSecret:value('SUMMIT_MAIL_WORKER_SECRET')}));
