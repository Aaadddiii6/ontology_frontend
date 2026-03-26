import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchAllProfiles } from '../lib/api'
import { CountryProfile } from '../types'

const useCountryData = () => {
  const [profiles, setProfiles] = useState<CountryProfile[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const profileMap = useMemo(() => {
    const map = new Map<string, CountryProfile>()
    profiles.forEach(profile => {
      map.set(profile.country, profile)
    })
    return map
  }, [profiles])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const fetchedProfiles = await fetchAllProfiles()
        if (fetchedProfiles) {
          setProfiles(fetchedProfiles)
        } else {
          throw new Error('Failed to fetch country profiles.')
        }
      } catch (e: any) {
        setError(e.message || 'An unknown error occurred.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const getCountry = useCallback((name: string): CountryProfile | undefined => {
    if (profileMap.has(name)) {
      return profileMap.get(name)
    }
    for (const [key, value] of profileMap.entries()) {
      if (key.toLowerCase() === name.toLowerCase()) {
        return value
      }
    }
    return undefined
  }, [profileMap]);

  return useMemo(() => ({ 
    profiles, profileMap, loading, error, getCountry 
  }), [profiles, profileMap, loading, error, getCountry]);
}

export default useCountryData
