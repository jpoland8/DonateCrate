/**
 * City landing page data.
 *
 * Each entry generates a static /cities/{slug} page optimized for
 * local SEO. Add new cities here as service areas expand.
 */

export type CityData = {
  /** URL slug — /cities/{slug} */
  slug: string;
  /** Display name */
  name: string;
  /** State abbreviation */
  state: string;
  /** Full state name for SEO */
  stateFull: string;
  /** Whether pickups are currently active here */
  active: boolean;
  /** Primary zip codes served or targeted */
  zipCodes: string[];
  /** Short tagline for the hero */
  tagline: string;
  /** SEO meta description */
  metaDescription: string;
  /** Neighborhood names for local flavor */
  neighborhoods: string[];
  /** Partner nonprofit name if applicable */
  partnerName?: string;
};

export const cities: CityData[] = [
  {
    slug: "knoxville",
    name: "Knoxville",
    state: "TN",
    stateFull: "Tennessee",
    active: true,
    zipCodes: ["37922", "37919", "37923", "37934", "37932"],
    tagline: "Monthly donation pickup is live in West Knoxville.",
    metaDescription:
      "DonateCrate offers monthly doorstep donation pickup in Knoxville, TN. Bag your gently used clothing and household items — we pick up on your scheduled day.",
    neighborhoods: [
      "Farragut",
      "Cedar Bluff",
      "West Hills",
      "Bearden",
      "Rocky Hill",
      "Hardin Valley",
    ],
  },
  {
    slug: "knoxville-farragut",
    name: "Farragut",
    state: "TN",
    stateFull: "Tennessee",
    active: true,
    zipCodes: ["37934"],
    tagline: "Donation pickup at your door in Farragut.",
    metaDescription:
      "DonateCrate monthly donation pickup is active in Farragut, TN. Set out your bag once a month — we handle the rest.",
    neighborhoods: ["Concord", "Fox Den", "Village Green", "Turkey Creek"],
  },
  {
    slug: "maryville",
    name: "Maryville",
    state: "TN",
    stateFull: "Tennessee",
    active: false,
    zipCodes: ["37801", "37803", "37804"],
    tagline: "Maryville is next on the DonateCrate expansion list.",
    metaDescription:
      "DonateCrate is expanding to Maryville, TN. Join the waitlist to be first when monthly donation pickup launches in your neighborhood.",
    neighborhoods: ["Alcoa", "Louisville", "Friendsville", "Wildwood"],
  },
  {
    slug: "oak-ridge",
    name: "Oak Ridge",
    state: "TN",
    stateFull: "Tennessee",
    active: false,
    zipCodes: ["37830", "37831"],
    tagline: "Oak Ridge donation pickup is coming soon.",
    metaDescription:
      "DonateCrate is planning monthly donation pickup for Oak Ridge, TN. Join the waitlist to help us launch in your area.",
    neighborhoods: ["Woodland", "Highland View", "Scarboro", "Jefferson"],
  },
];

export function getCityBySlug(slug: string): CityData | undefined {
  return cities.find((city) => city.slug === slug);
}
