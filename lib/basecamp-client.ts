export type Member = { name: string; grade: string; interest: string; created_at: string };
export type VoteState = { votes: { adventure_id: string; count: number }[]; myVotes: { adventure_id: string }[] };
export type BasecampState = VoteState & {
  previewOnly?: boolean;
  signedIn: boolean; leader: boolean; member: Member | null;
  events: { id: string; title: string; starts_at: string; location: string; details: string; status: string }[];
  rsvps: { event_id: string }[];
  proposals: { id: string; title: string; category: string; description: string }[];
};

export async function basecampRequest<T>(init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch('/api/basecamp', { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) }); }
  catch { throw new Error('Could not reach basecamp. Please check your connection and try again.'); }
  const data = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !data) throw new Error(data?.error || 'Basecamp is temporarily unavailable. Please try again.');
  return data;
}
