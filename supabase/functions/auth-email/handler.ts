import { Webhook } from 'standardwebhooks';

type Config = { url: string; from: string; brevoKey: string; hookSecret: string };
type AuthEmail = {
  user: { email: string; new_email?: string };
  email_data: { email_action_type: string; redirect_to?: string; token_hash?: string; token_hash_new?: string; token?: string };
};
const site = 'https://wyattslinde.github.io/summit-club/';
const redirects = new Set([site, `${site}register/?complete=1`, `${site}profile/`, `${site}profile/?recovery=1`]);
const emailAddress = (value: unknown): value is string => typeof value === 'string' && value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const titles: Record<string, string> = {
  signup: 'Confirm your SUMMIT account', magiclink: 'Sign in to SUMMIT',
  recovery: 'Reset your SUMMIT password', invite: 'Your SUMMIT invitation',
  email_change: 'Confirm your SUMMIT email change', reauthentication: 'Your SUMMIT verification code',
};
const fail = (status: number, message: string) => Response.json({ error: { http_code: status, message } }, { status });

async function providerKey(identity: string) {
  // Brevo requires UUID-shaped keys. Derive one stable 122-bit identifier per
  // signed delivery instead of generating a different key on every retry.
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function authMessages(payload: AuthEmail, config: Config, id: string) {
  const data = payload?.email_data, user = payload?.user;
  if (!data || !user || !Object.hasOwn(titles, data.email_action_type) || !emailAddress(user.email)) throw new Error('Invalid email request');
  const action = data.email_action_type, title = titles[action];
  const redirect = data.redirect_to || site;
  if (!redirects.has(redirect)) throw new Error('Invalid redirect');
  const recipients = action === 'email_change'
    ? [...(data.token_hash_new ? [{ email: user.email, hash: data.token_hash_new, suffix: 'current' }] : []),
       { email: user.new_email, hash: data.token_hash, suffix: 'new' }]
    : [{ email: user.email, hash: data.token_hash, suffix: 'account' }];
  return recipients.map(({ email, hash, suffix }) => {
    if (!emailAddress(email)) throw new Error('Invalid recipient');
    let text: string, html: string;
    if (action === 'reauthentication') {
      if (!/^\d{6,10}$/.test(data.token || '')) throw new Error('Invalid verification code');
      text = `Your SUMMIT verification code is ${data.token}.`;
      html = `<p>Your verification code:</p><p style="font-size:30px;letter-spacing:5px">${data.token}</p>`;
    } else {
      if (typeof hash !== 'string' || !/^[a-f0-9]{32,128}$/i.test(hash)) throw new Error('Invalid confirmation token');
      const link = new URL('/auth/v1/verify', config.url);
      link.searchParams.set('token', hash); link.searchParams.set('type', action); link.searchParams.set('redirect_to', redirect);
      const label = action === 'recovery' ? 'Choose a password' : action === 'signup' ? 'Confirm my email' : 'Continue to SUMMIT';
      text = `${title}\n\n${label}:\n${link.href}`;
      html = `<h1 style="font-size:26px;font-weight:500">${title}</h1><p>One step closer to getting outside with the crew.</p><p style="margin:32px 0"><a href="${escapeHtml(link.href)}" style="background:#304e3b;color:#fff;padding:15px 24px;text-decoration:none;border-radius:6px">${label}</a></p>`;
    }
    const footer = 'If you did not request this email, you can ignore it. Keep this link or code private.\nSUMMIT · Cathedral Catholic High School';
    return {
      sender: { name: 'SUMMIT', email: config.from }, to: [{ email }], subject: title,
      textContent: `${text}\n\n${footer}`,
      htmlContent: `<!doctype html><html><body style="margin:0;background:#f4f2e9;color:#23382c;font-family:Arial,sans-serif"><div style="max-width:520px;margin:30px auto;padding:32px"><p style="letter-spacing:5px;font-weight:bold">SUMMIT</p><p style="font-size:11px;letter-spacing:2px">EXPLORE. SERVE. LEAD.</p>${html}<p style="font-size:12px;line-height:1.6;margin-top:36px">${escapeHtml(footer).replace('\n', '<br>')}</p></div></body></html>`,
      headers: { idempotencyKey: `summit-auth-${id}-${suffix}` }, tags: ['summit-auth'],
    };
  });
}

export function createAuthEmailHandler(config: Config, transport: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return fail(405, 'Method not allowed');
    if (!config.hookSecret || !config.brevoKey || !emailAddress(config.from) || !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url)) return fail(503, 'Email service is not configured');
    let payload: AuthEmail;
    const body = await request.text();
    if (body.length > 65536) return fail(413, 'Invalid email request');
    try {
      // Verify the raw payload and timestamp before reading recipients or tokens.
      payload = new Webhook(config.hookSecret.replace(/^v1,whsec_/, '')).verify(body, Object.fromEntries(request.headers)) as AuthEmail;
    } catch { return fail(401, 'Invalid email signature'); }
    const id = request.headers.get('webhook-id') || '';
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return fail(400, 'Invalid email request');
    let messages;
    try { messages = authMessages(payload, config, id); }
    catch { return fail(400, 'Invalid email request'); }
    try {
      const results = await Promise.all(messages.map(async message => {
        message.headers.idempotencyKey = await providerKey(message.headers.idempotencyKey);
        const response = await transport('https://api.brevo.com/v3/smtp/email', {
          method: 'POST', headers: { 'api-key': config.brevoKey, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(message), signal: AbortSignal.timeout(3500),
        });
        if (!response.ok) {
          const problem = await response.json().catch(() => ({})) as { code?: unknown; message?: unknown };
          // Keep addresses, tokens, provider credentials, and raw bodies out of logs.
          const code = typeof problem.code === 'string' && /^[a-z_]{1,50}$/i.test(problem.code) ? problem.code : 'unknown';
          const detail = typeof problem.message === 'string' ? problem.message.toLowerCase() : '';
          const category = ['idempotency','sender','account','key','permission','quota'].find(word => detail.includes(word)) || 'other';
          console.warn(JSON.stringify({ event:'auth_mail_rejected', status:response.status, code, category }));
          return false;
        }
        const result = await response.json() as { messageId?: unknown };
        return typeof result.messageId === 'string' && result.messageId.length > 0 && result.messageId.length <= 100;
      }));
      if (!results.every(Boolean)) return fail(502, 'The email provider could not accept this message. Please try again.');
      return Response.json({});
    } catch { return fail(502, 'The email provider could not accept this message. Please try again.'); }
  };
}
