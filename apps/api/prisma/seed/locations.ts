import type { PrismaClient } from '../../src/generated/prisma/client';

const places: [name: string, city: string, country: string, lat: number, lon: number][] = [
  ['Times Square', 'New York', 'United States', 40.758, -73.9855],
  ['Central Park', 'New York', 'United States', 40.7829, -73.9654],
  ['Statue of Liberty', 'New York', 'United States', 40.6892, -74.0445],
  ['Golden Gate Bridge', 'San Francisco', 'United States', 37.8199, -122.4783],
  ['Hollywood Sign', 'Los Angeles', 'United States', 34.1341, -118.3215],
  ['Eiffel Tower', 'Paris', 'France', 48.8584, 2.2945],
  ['Louvre Museum', 'Paris', 'France', 48.8606, 2.3376],
  ['Big Ben', 'London', 'United Kingdom', 51.5007, -0.1246],
  ['Tower Bridge', 'London', 'United Kingdom', 51.5055, -0.0754],
  ['Colosseum', 'Rome', 'Italy', 41.8902, 12.4922],
  ['Sagrada Familia', 'Barcelona', 'Spain', 41.4036, 2.1744],
  ['Brandenburg Gate', 'Berlin', 'Germany', 52.5163, 13.3777],
  ['Red Square', 'Moscow', 'Russia', 55.7539, 37.6208],
  ['Hermitage Museum', 'Saint Petersburg', 'Russia', 59.9398, 30.3146],
  ['Burj Khalifa', 'Dubai', 'United Arab Emirates', 25.1972, 55.2744],
  ['Shibuya Crossing', 'Tokyo', 'Japan', 35.6595, 139.7005],
  ['Sydney Opera House', 'Sydney', 'Australia', -33.8568, 151.2153],
  ['Christ the Redeemer', 'Rio de Janeiro', 'Brazil', -22.9519, -43.2105],
  ['Taj Mahal', 'Agra', 'India', 27.1751, 78.0421],
  ['Great Wall of China', 'Beijing', 'China', 40.4319, 116.5704],
  ['Registan', 'Samarkand', 'Uzbekistan', 39.6547, 66.9758],
  ['Istiqlol Park', 'Dushanbe', 'Tajikistan', 38.5598, 68.774],
  ['Hagia Sophia', 'Istanbul', 'Turkey', 41.0086, 28.9802],
  ['Marina Bay Sands', 'Singapore', 'Singapore', 1.2834, 103.8607],
];

// Та же схема, что в LocationsService.makeSlug.
function slugify(name: string, city: string): string {
  return `${name} ${city}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

// Идемпотентно: upsert по slug.
export async function seedLocations(prisma: PrismaClient): Promise<number> {
  for (const [name, city, country, latitude, longitude] of places) {
    await prisma.location.upsert({
      where: { slug: slugify(name, city) },
      update: {},
      create: { name, slug: slugify(name, city), city, country, latitude, longitude },
    });
  }
  return places.length;
}
