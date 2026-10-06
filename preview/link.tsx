import type { AnchorHTMLAttributes } from 'react';
import { sitePath } from '../lib/site-path';

/** Static preview pages use ordinary navigation; the full app keeps Next routing. */
export default function PreviewLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={props.href ? sitePath(props.href) : undefined}/>;
}
