/** Keep the full app at / while allowing static previews in a project subdirectory. */
export function sitePath(href: string, base = import.meta.env?.BASE_URL || '/'): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  return `${base.replace(/\/$/, '')}${href}`;
}
