export type Hike = { id: string; name: string; area: string; official_url: string; average: number | null; rating_count: number; rank: number | null; my_rating: { stars: number; hiked_on: string } | null };
export type MonthlyHikes = { month: string; today: string; minimum_ratings: number; hikes: Hike[] };
export type HikePhoto = { id: string; hike_id: string; hike_name: string; object_path: string; caption: string; alt_text: string; author_name: string; hiked_on: string; published_at: string | null; status: 'draft' | 'published' | 'hidden' | 'deleting'; mine: boolean };
export type Gallery = { photos: HikePhoto[] };
export const trailCatalog: Omit<Hike, 'average' | 'rating_count' | 'rank' | 'my_rating'>[] = [
  { id: 'torrey-guy-fleming', name: 'Guy Fleming Trail', area: 'Torrey Pines State Natural Reserve', official_url: 'https://www.parks.ca.gov/?page_id=23207' },
  { id: 'cowles-mountain', name: 'Cowles Mountain', area: 'Mission Trails Regional Park', official_url: 'https://www.sandiego.gov/cowles-mountain-summit' },
  { id: 'penasquitos-canyon', name: 'Los Peñasquitos Canyon', area: 'Los Peñasquitos Canyon Preserve', official_url: 'https://www.sandiego.gov/park-and-recreation/parks/osp/lospenasquitos' },
];
export function pacificDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => parts.find(value => value.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function monthOptions(today = pacificDate()) {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - index, 1, 12));
    return { value: date.toISOString().slice(0, 10), label: date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }) };
  });
}
export function monthEnd(month: string, today: string) {
  const [year, number] = month.split('-').map(Number);
  return [new Date(Date.UTC(year, number, 0, 12)).toISOString().slice(0, 10), today].sort()[0];
}
export const starLabels = ['Not for me', 'It was okay', 'A good hike', 'Would go again', 'An absolute favorite'];
