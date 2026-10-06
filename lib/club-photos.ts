/** Licensed documentary photography. These are examples, not SUMMIT trip records. */
export const clubPhotos = {
  arrival: {
    name: 'mountain-sunset',
    alt: 'Warm evening light on a mountain range above a valley of pine trees.',
    caption: 'A little perspective.',
    credit: 'Luke Peterson / Unsplash',
    source: 'https://unsplash.com/photos/eYBNVOJWnBc',
    width: 1600, height: 1067,
    position: '50% 60%',
  },
  hike: {
    name: 'group-hike',
    alt: 'A group of backpackers follows a sunlit forest trail below rocky peaks in the Tetons.',
    caption: 'On the trail · Teton County, Wyoming',
    credit: 'Kevin Doran / Unsplash',
    source: 'https://unsplash.com/photos/MH0Oxx6h550',
    width: 1600, height: 2133,
    position: '50% 66%',
  },
  cleanup: {
    name: 'beach-cleanup',
    alt: 'Three Groundwork volunteers use litter pickers and a trash bag to clean a beach at Fire Island.',
    caption: 'Beach cleanup · Fire Island, New York',
    credit: 'National Park Service',
    source: 'https://commons.wikimedia.org/wiki/File:VIPs_Keep_Our_Beaches_Clean_(1c6f315e-155d-451f-6726-180829323dd0).JPG',
    width: 1600, height: 1200,
    position: '50% 55%',
  },
  service: {
    name: 'trail-service',
    alt: 'Two volunteers use hand tools to trim brush along Lost Palms Oasis Trail in Joshua Tree.',
    caption: 'Trail care · Joshua Tree, California',
    credit: 'NPS / Donovan Smith',
    source: 'https://commons.wikimedia.org/wiki/File:Volunteer_Trail_Work_(54424524341).jpg',
    width: 1600, height: 1067,
    position: '66% 50%',
  },
} as const;

export const outingPhotos = [clubPhotos.hike, clubPhotos.cleanup, clubPhotos.service];
