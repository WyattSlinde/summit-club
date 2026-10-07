-- These three original examples were not selected by club leadership.
-- Foreign keys deliberately prevent deletion if a member added a rating or
-- photo since the audit. Never cascade into member content or remove new trails.
set local lock_timeout = '5s';
set local statement_timeout = '15s';

delete from public.hikes
where (id, name, area) in (
  ('torrey-guy-fleming', 'Guy Fleming Trail', 'Torrey Pines State Natural Reserve'),
  ('cowles-mountain', 'Cowles Mountain', 'Mission Trails Regional Park'),
  ('penasquitos-canyon', 'Los Peñasquitos Canyon', 'Los Peñasquitos Canyon Preserve')
);
