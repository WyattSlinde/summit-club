import { sitePath } from '../lib/site-path';

export function useRouter() {
  return {
    push: (href: string) => window.location.assign(sitePath(href)),
    replace: (href: string) => window.location.replace(sitePath(href)),
  };
}
