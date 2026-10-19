/**
 * Shared React Context instance for portal-wide state (organizations, events,
 * memberships, documents, notifications, and audit logs).
 */
import { createContext } from 'react'

const PortalDataContext = createContext(null)

export default PortalDataContext
