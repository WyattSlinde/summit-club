import { createAuthEmailHandler } from './handler.ts';
declare const Deno: { env: { get: (name: string) => string | undefined }; serve: (handler: (request: Request) => Promise<Response>) => void };
const value = (name: string) => Deno.env.get(name) || '';
Deno.serve(createAuthEmailHandler({
  url: value('SUPABASE_URL'), from: value('SUMMIT_MAIL_FROM'),
  brevoKey: value('BREVO_API_KEY'), hookSecret: value('SEND_EMAIL_HOOK_SECRET'),
}));
