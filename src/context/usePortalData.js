import { createContext, useContext } from 'react'

export const PortalDataContext = createContext(null)

export function usePortalData() {
  const context = useContext(PortalDataContext)
  if (!context) throw new Error('usePortalData must be used inside PortalDataProvider')
  return context
}

export default PortalDataContext
