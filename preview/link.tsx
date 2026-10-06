import type { AnchorHTMLAttributes } from 'react';

/** Static preview pages use ordinary navigation; the full app keeps Next routing. */
export default function PreviewLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props}/>;
}
