/**
 * StudentOrganizationsPage.jsx
 *
 * Student portal — full organization directory with live search + category filter.
 *
 * Reads the `?q=` query-string parameter (set by the hero search bar on the
 * landing page) and pre-fills the search input with it on mount.
 * The existing filter/search logic is otherwise unchanged.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import FilterSelect from '../components/ui/FilterSelect.jsx'
import Icon from '../components/ui/Icon.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { organizationCategories, studentOrganizations } from '../data/studentOrganizations.js'

export default function StudentOrganizationsPage() {
  const { adminOrganizations = [] } = useOutletContext()

  // Read the optional ?q= param from the landing-page hero search
  const [searchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const [search, setSearch] = useState(initialQuery)
  const [category, setCategory] = useState('All')

  // Keep the search input in sync if the URL param changes (e.g. browser back/forward)
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

  const filteredOrganizations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return visibleOrganizations.filter((organization) => {
      const matchesCategory = category === 'All' || organization.category === category
      const searchableText = `${organization.name} ${organization.acronym} ${organization.category} ${organization.description} ${organization.adviser}`.toLowerCase()
      return matchesCategory && (!query || searchableText.includes(query))
    })
  }, [category, search, visibleOrganizations])

  return (
    <div className="student-organizations-page">
      <PageHeader
        description="Discover organizations, communities, and activities across WMSU."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="Student Organizations"
      />

      <div className="directory-toolbar">
        <label className="organization-search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search organizations"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search organizations..."
            type="search"
            value={search}
          />
        </label>
        <FilterSelect label="Category" onChange={setCategory} options={organizationCategories} value={category} />
        {(category !== 'All' || search) && (
          <button className="directory-toolbar-reset" onClick={() => { setCategory('All'); setSearch('') }} type="button">Clear</button>
        )}
      </div>

      <div aria-live="polite" className="organization-results-label">
        {filteredOrganizations.length} {filteredOrganizations.length === 1 ? 'organization' : 'organizations'}
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
                <span><small>Active members</small><strong>{organization.activeMembers ?? organization.memberCount ?? 0}</strong></span>
              </div>
              <Link className="button button-secondary organization-view-button" to={`/student/organizations/${organization.id}`}>
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
