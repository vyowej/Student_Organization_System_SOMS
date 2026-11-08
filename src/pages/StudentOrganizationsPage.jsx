/**
 * StudentOrganizationsPage.jsx
 *
 * Public Organizations Directory (`/organizations`) — full accredited organization
 * directory with live search, category filter, and dynamic active counter.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import FilterSelect from '../components/ui/FilterSelect.jsx'
import Icon from '../components/ui/Icon.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar from '../components/ui/SearchBar.jsx'
import { usePortalData } from '../context/usePortalData.js'
import { organizationCategories, studentOrganizations } from '../data/studentEvents.js'

export default function StudentOrganizationsPage() {
  const outletContext = useOutletContext() || {}
  const portalData = usePortalData()
  const adminOrganizations = outletContext.adminOrganizations || portalData?.adminOrganizations || []
  const adminSettings = outletContext.adminSettings || portalData?.adminSettings || null

  const [searchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const [search, setSearch] = useState(initialQuery)
  const [category, setCategory] = useState('All')

  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    setSearch(q)
  }, [searchParams])

  const visibleOrganizations = useMemo(() => {
    const currentOrganizations = new Map(studentOrganizations.map((organization) => [organization.id, organization]))
    adminOrganizations.forEach((organization) => {
      if (organization.status === 'ACTIVE') currentOrganizations.set(organization.id, organization)
      else currentOrganizations.delete(organization.id)
    })
    return [...currentOrganizations.values()]
  }, [adminOrganizations])

  const categoryOptions = useMemo(() => {
    const fromSettings = (adminSettings?.organizationCategories || []).filter((c) => c !== 'All')
    const fromDefaults = organizationCategories.filter((c) => c !== 'All')
    const fromOrgs = visibleOrganizations.map((o) => o.category).filter(Boolean)
    const combined = ['All', ...fromSettings, ...fromDefaults, ...fromOrgs]
    return [...new Set(combined)]
  }, [adminSettings?.organizationCategories, visibleOrganizations])

  const filteredOrganizations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return visibleOrganizations.filter((organization) => {
      const matchesCategory = category === 'All' ||
        String(organization.category || '').trim().toLowerCase() === category.trim().toLowerCase()
      const searchableText = `${organization.name} ${organization.acronym} ${organization.category} ${organization.college} ${organization.description} ${organization.adviser}`.toLowerCase()
      return matchesCategory && (!query || searchableText.includes(query))
    })
  }, [category, search, visibleOrganizations])

  return (
    <div className="student-organizations-page">
      <PageHeader
        description="Browse all accredited university, college, and departmental organizations across WMSU."
        eyebrow="UNIDOS CAMPUS DIRECTORY"
        title="Campus Organizations Directory"
      />

      <div className="directory-toolbar">
        <SearchBar
          label="Search organizations"
          onChange={setSearch}
          placeholder="Search organizations by name, acronym, college, or adviser…"
          value={search}
        />
        <FilterSelect label="Category" onChange={setCategory} options={categoryOptions} value={category} />
        {(category !== 'All' || search) && (
          <button className="directory-toolbar-reset" onClick={() => { setCategory('All'); setSearch('') }} type="button">Clear</button>
        )}
      </div>

      <div aria-live="polite" className="organization-results-label">
        <strong>{filteredOrganizations.length}</strong> active {filteredOrganizations.length === 1 ? 'organization' : 'organizations'}
        {visibleOrganizations.length !== filteredOrganizations.length ? ` (of ${visibleOrganizations.length} total)` : ''}
      </div>

      {filteredOrganizations.length > 0 ? (
        <div className="organization-directory-grid">
          {filteredOrganizations.map((organization, index) => (
            <article className="organization-directory-card" key={organization.id} style={{ '--organization-index': index }}>
              <div className="organization-card-heading">
                <div aria-hidden="true" className={`organization-directory-avatar organization-avatar-${organization.color || 'crimson'}`}>
                  {organization.logo ? (
                    <img
                      alt={`${organization.acronym || organization.name} logo`}
                      src={organization.logo}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                    />
                  ) : (
                    organization.acronym || organization.name.slice(0, 3).toUpperCase()
                  )}
                </div>
                <div className="organization-card-title">
                  <h2>{organization.name}</h2>
                  <span>{organization.acronym}</span>
                </div>
                <Badge tone="crimson">{organization.category}</Badge>
              </div>
              <p className="organization-card-description">{organization.description}</p>
              <div className="organization-card-meta">
                <span><small>Faculty adviser</small><strong>{organization.adviser}</strong></span>
                <span><small>Active officers</small><strong>{organization.activeMembers ?? organization.memberCount ?? 0}</strong></span>
              </div>
              <Link className="button button-secondary organization-view-button" to={`/organizations/${organization.id}`}>
                View Organization <Icon name="arrow-right" size={13} />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Try another search term or choose a different category."
          title="No organizations found"
        />
      )}
    </div>
  )
}
