export type LeaderMember = {
  contact_email?: string; note?: string; notification_status?: string;
  name: string; grade: string; interest: string; created_at: string; choices: string | null;
};
export type LeaderData = {
  reports?: { id: string; reason: string; details: string; created_at: string; reported_name: string }[];
  members: LeaderMember[];
  memberCount: number;
  proposals: { id: string; title: string; description: string; category: string; name?: string; created_at: string }[];
  events: { id: string; title: string; starts_at: string; location: string; details: string; status: string; count: number }[];
  attendees: { event_id: string; name: string; grade: string }[];
  votes: { adventure_id: string; count: number }[];
  interests: { interest: string; count: number }[];
  totalIdeas: number;
};

/** Spreadsheet programs must treat student input as text, never as formulas. */
export function csvCell(value: string) {
  const safe = /^[\s]*[=+@\-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function rosterCSV(members: LeaderMember[], choiceName: (id: string) => string) {
  return [['Name', 'Grade', 'Interest', 'Outing votes', 'Joined', 'Email', 'Student note', 'Signup email'], ...members.map(member => [
    member.name, member.grade, member.interest,
    (member.choices ?? '').split(',').filter(Boolean).map(choiceName).join('; '),
    member.created_at.slice(0, 10), member.contact_email || '', member.note || '', member.notification_status || '',
  ])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
