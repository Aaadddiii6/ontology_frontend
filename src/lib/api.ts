import { CountryProfile, ModuleConfig } from '../types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

async function fetchWithCache<T>(key: string, url: string): Promise<T | null> {
  const cachedItem = cache.get(key)
  if (cachedItem && Date.now() - cachedItem.timestamp < CACHE_DURATION) {
    return cachedItem.data as T
  }

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    cache.set(key, { data, timestamp: Date.now() })
    return data
  } catch (error) {
    console.error(`Failed to fetch from ${url}:`, error)
    return null
  }
}

export async function fetchAllProfiles(): Promise<CountryProfile[] | null> {
  try {
    const data = await fetchWithCache<{ profiles: CountryProfile[] }>(
      'all-profiles',
      `${BASE_URL}/simulator/profiles?limit=261`
    )
    return data ? data.profiles : null
  } catch (error) {
    console.error('Failed to fetch all profiles:', error)
    return null
  }
}

export async function fetchCountryProfile(name: string): Promise<CountryProfile | null> {
  try {
    const response = await fetch(`${BASE_URL}/defense/profile/${encodeURIComponent(name)}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error(`Failed to fetch profile for ${name}:`, error)
    return null
  }
}

export async function fetchHealth(): Promise<{ status: string; neo4j: string; total_nodes: number } | null> {
  try {
    const response = await fetch(`${BASE_URL}/health`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch health:', error)
    return null
  }
}

export async function fetchGraphSummary(): Promise<{ relationships: { rel: string; cnt: number }[] } | null> {
  try {
    const response = await fetch(`${BASE_URL}/graph/summary`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch graph summary:', error)
    return null
  }
}

export const MODULE_CONFIGS: Record<string, ModuleConfig> = {
  overview: { accent: '#1e293b', bgTint: 'rgba(30,41,59,0.02)', label: 'Overview' },
  defence: { accent: '#b43c3c', bgTint: 'rgba(180,60,60,0.03)', label: 'Defence' },
  economy: { accent: '#328c50', bgTint: 'rgba(50,140,80,0.03)', label: 'Economy' },
  geopolitics: { accent: '#3c64c8', bgTint: 'rgba(60,100,200,0.03)', label: 'Geopolitics' },
  climate: { accent: '#b4781e', bgTint: 'rgba(180,120,30,0.03)', label: 'Climate' },
}
