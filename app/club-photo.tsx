import { sitePath } from '@/lib/site-path';
import type { clubPhotos } from '@/lib/club-photos';

type Photo = (typeof clubPhotos)[keyof typeof clubPhotos];

export function ClubPhoto({ photo, sizes }: { photo: Photo; sizes: string }) {
  return <img
    src={sitePath(`/photos/${photo.name}-1600.webp`)}
    srcSet={`${sitePath(`/photos/${photo.name}-800.webp`)} 800w, ${sitePath(`/photos/${photo.name}-1600.webp`)} 1600w`}
    sizes={sizes}
    width={photo.width}
    height={photo.height}
    alt={photo.alt}
    loading="lazy"
    decoding="async"
    style={{ objectPosition: photo.position }}
  />;
}

export function PhotoCredit({ photo }: { photo: Photo }) {
  return <figcaption className="club-photo-credit">
    <span>{photo.caption}</span>
    <a href={photo.source} target="_blank" rel="noopener noreferrer" aria-label={`Photo by ${photo.credit} — view original (opens in a new tab)`}>{photo.credit} ↗</a>
  </figcaption>;
}
