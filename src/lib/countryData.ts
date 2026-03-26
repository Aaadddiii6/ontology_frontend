'''
This file maps D3/topojson ISO country names to the names our Neo4j API uses.
'''

import { ActiveModule, CountryProfile } from '../types'

export const COUNTRY_NAME_MAP: Record<string, string | null> = {
  'United States of America': 'United States',
  Russia: 'Russian Federation',
  'South Korea': 'Korea, Republic of',
  'North Korea': "Korea, Democratic People's Republic of",
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Central African Rep.': 'Central African Republic',
  'Dem. Rep. Congo': 'Democratic Republic Of Congo',
  'Dominican Rep.': 'Dominican Republic',
  'Eq. Guinea': 'Equatorial Guinea',
  eSwatini: 'Eswatini',
  'Fr. S. Antarctic Lands': null,
  'Falkland Is.': 'Falkland Islands',
  'Solomon Is.': 'Solomon Islands',
  'S. Sudan': 'South Sudan',
  'W. Sahara': 'Western Sahara',
  'Czech Rep.': 'Czechia',
  Taiwan: 'Taiwan',
  Palestine: 'Palestine',
  Syria: 'Syrian Arab Republic',
  Iran: 'Iran, Islamic Republic of',
  Bolivia: 'Bolivia, Plurinational State of',
  Venezuela: 'Venezuela, Bolivarian Republic of',
  Tanzania: 'United Republic of Tanzania',
  Laos: "Lao People's Democratic Republic",
  Vietnam: 'Viet Nam',
}

export function normalizeCountryName(d3name: string): string | null {
  if (d3name in COUNTRY_NAME_MAP) {
    return COUNTRY_NAME_MAP[d3name]
  }
  return d3name
}

const COLORS = {
  overview: { low: '#c8c4e8', mid: '#9490c8', high: '#6860a8' },
  defence: { low: '#fcd5d5', mid: '#e87a7a', high: '#b43c3c' },
  economy: { low: '#d5f0e2', mid: '#7ac4a0', high: '#328c50' },
  geopolitics: { low: '#d5e0f5', mid: '#7a9de8', high: '#3c64c8' },
  climate: { low: '#fce8d0', mid: '#e8a870', high: '#b4781e' },
}

function getColorForScore(score: number | undefined, colorSet: { low: string; mid: string; high: string }): string {
  if (score === undefined || score === null) return colorSet.low
  if (score < 0.4) return colorSet.low
  if (score < 0.7) return colorSet.mid
  return colorSet.high
}

export function getModuleColor(profile: CountryProfile | null | undefined, module: ActiveModule): string {
  switch (module) {
    case 'overview':
      return getColorForScore(profile?.defense_composite, COLORS.overview)
    case 'defence':
      return getColorForScore(profile?.military_strength, COLORS.defence)
    case 'economy':
      return getColorForScore(profile?.defense_spending, COLORS.economy)
    case 'geopolitics':
      return getColorForScore(profile?.diplomatic_centrality, COLORS.geopolitics)
    case 'climate':
      // No data field specified for climate, returning default
      return COLORS.climate.low
    default:
      return '#d1d5db' // Default gray
  }
}
