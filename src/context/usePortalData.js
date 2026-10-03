import { useContext } from 'react'
import PortalDataContext from './PortalData.js'

export function usePortalData() {
  const context = useContext(PortalDataContext)
  if (!context) throw new Error('usePortalData must be used inside PortalDataProvider')
  return context
}
