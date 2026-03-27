/**
 * This file maps D3/topojson ISO country names to the names our Neo4j API uses.
 */

import { ActiveModule, CountryProfile } from "../types";

export const COUNTRY_NAME_MAP: Record<string, string | null> = {
  "United States of America": "United States",
  Russia: "Russian Federation",
  "South Korea": "Korea, Republic of",
  "North Korea": "Korea, Democratic People's Republic of",
  "Bosnia and Herz.": "Bosnia and Herzegovina",
  "Central African Rep.": "Central African Republic",
  "Dem. Rep. Congo": "Democratic Republic Of Congo",
  "Dominican Rep.": "Dominican Republic",
  "Eq. Guinea": "Equatorial Guinea",
  eSwatini: "Eswatini",
  "Fr. S. Antarctic Lands": null,
  "Falkland Is.": "Falkland Islands",
  "Solomon Is.": "Solomon Islands",
  "S. Sudan": "South Sudan",
  "W. Sahara": "Western Sahara",
  "Czech Rep.": "Czechia",
  Taiwan: "Taiwan",
  Palestine: "Palestine",
  Syria: "Syrian Arab Republic",
  Iran: "Iran, Islamic Republic of",
  Bolivia: "Bolivia, Plurinational State of",
  Venezuela: "Venezuela, Bolivarian Republic of",
  Tanzania: "United Republic of Tanzania",
  Laos: "Lao People's Democratic Republic",
  Vietnam: "Viet Nam",
  USA: "United States",
  "U.S.A.": "United States",
  "United States": "United States",
};

export const COUNTRY_COORDS: Record<string, [number, number]> = {
  "United States": [-95.7, 37.1],
  "Russian Federation": [105.3, 61.5],
  China: [104.2, 35.9],
  "United Kingdom": [-3.4, 55.4],
  France: [2.2, 46.2],
  Germany: [10.5, 51.2],
  India: [79.0, 20.6],
  Pakistan: [69.3, 30.4],
  Brazil: [-51.9, -14.2],
  "Saudi Arabia": [45.1, 23.9],
  Israel: [34.9, 31.0],
  "Iran, Islamic Republic of": [53.7, 32.4],
  Ukraine: [31.2, 48.4],
  Japan: [138.3, 36.2],
  "Korea, Republic of": [127.8, 35.9],
  Turkey: [35.2, 39.0],
  Egypt: [30.8, 26.8],
  Nigeria: [8.7, 9.1],
  Indonesia: [113.9, -0.8],
  Australia: [133.8, -25.3],
  Canada: [-106.3, 56.1],
  Mexico: [-102.6, 23.6],
  Poland: [19.1, 51.9],
  Italy: [12.6, 41.9],
  Spain: [-3.7, 40.5],
  Netherlands: [5.3, 52.1],
  Belgium: [4.5, 50.5],
  Sweden: [18.6, 60.1],
  Norway: [8.5, 60.5],
  Finland: [25.7, 61.9],
  "South Africa": [24.0, -29.0],
  Belarus: [27.9, 53.7],
  "United Arab Emirates": [54.0, 24.0],
  Argentina: [-63.6, -38.4],
  Kazakhstan: [66.9, 48.0],
  Algeria: [1.6, 28.0],
  Thailand: [100.9, 15.8],
  Vietnam: [108.2, 14.0],
  Iraq: [44.3, 33.2],
  "North Korea": [127.0, 40.0],
  Greece: [21.8, 39.0],
  Switzerland: [8.2, 46.8],
  Austria: [14.5, 47.5],
  Portugal: [-8.2, 39.4],
  Denmark: [9.5, 56.2],
  Chile: [-71.5, -35.6],
  Philippines: [121.7, 12.8],
};

export function normalizeCountryName(d3name: string): string | null {
  if (d3name in COUNTRY_NAME_MAP) {
    return COUNTRY_NAME_MAP[d3name];
  }
  return d3name;
}

export const COLORS = {
  overview: { low: "#c8c4e8", mid: "#9490c8", high: "#6860a8" },
  defence: { low: "#fcd5d5", mid: "#e87a7a", high: "#b43c3c" },
  economy: { low: "#d5f0e2", mid: "#7ac4a0", high: "#328c50" },
  geopolitics: { low: "#d5e0f5", mid: "#7a9de8", high: "#3c64c8" },
  climate: { low: "#fce8d0", mid: "#e8a870", high: "#b4781e" },
  simulator: { low: "#ccc", mid: "#999", high: "#666" },
};

export function getColorForScore(
  score: number | undefined,
  colorSet: { low: string; mid: string; high: string },
): string {
  if (score === undefined || score === null || score === 0) return colorSet.low;
  // Using lower thresholds to make the map more multicolored/sensitive
  if (score < 0.2) return colorSet.low;
  if (score < 0.5) return colorSet.mid;
  return colorSet.high;
}

export function getModuleColor(
  profile: CountryProfile | null | undefined,
  module: ActiveModule,
): string {
  const colorSet = COLORS[module] || COLORS.overview;

  if (!profile) {
    // Return a visible, desaturated version of the module color instead of black
    // Using a higher alpha (99 = ~60% opacity) to ensure it's visible on dark themes
    return module === "overview" ? "#8ad0f0" : colorSet.low + "99";
  }

  const score = ((): number | undefined => {
    switch (module) {
      case "overview":
        return profile.defense_composite;
      case "defence":
        return profile.military_strength;
      case "economy":
        return (
          (profile.arms_export || 0) * 0.5 +
          (profile.defense_spending || 0) * 0.5
        );
      case "geopolitics":
        return profile.diplomatic_centrality;
      case "climate":
        return (
          (profile.live_risk || 0) * 0.7 + (profile.conflict_risk || 0) * 0.3
        );
      default:
        return undefined;
    }
  })();

  return getColorForScore(score, colorSet);
}
