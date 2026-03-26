import { useState } from 'react'
import { MapMode } from '../types'

const useMapMode = () => {
  const [mode, setMode] = useState<MapMode>('flat')
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false)

  const toggleMode = () => {
    setIsTransitioning(true)
    setTimeout(() => {
      if (mode === 'flat') {
        setMode('globe')
      } else if (mode === 'globe') {
        setMode('flat')
      } else if (mode === 'globe-3d') {
        setMode('globe')
      }
      setIsTransitioning(false)
    }, 500) // Corresponds to GSAP animation time
  }

  const setGlobe3D = () => {
    setMode('globe-3d')
  }

  return { mode, toggleMode, setGlobe3D, isTransitioning }
}

export default useMapMode
