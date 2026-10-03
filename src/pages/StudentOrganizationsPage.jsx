import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { organizationCategories, studentOrganizations } from '../data/studentOrganizations.js'

export default function StudentOrganizationsPage() {
  const { adminOrganizations = [] } = useOutletContext()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
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

      <div className="organization-directory-controls">
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
        <div aria-label="Filter organizations by category" className="organization-category-filters" role="group">
          {organizationCategories.map((item) => (
            <button
              aria-pressed={category === item}
              className={`organization-category-filter${category === item ? ' is-active' : ''}`}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite" className="organization-results-label">
        {filteredOrganizations.length} {filteredOrganizations.length === 1 ? 'organization' : 'organizations'}
      </div>

      {filteredOrganizations.length > 0 ? (
        <div className="organization-directory-grid">
          {filteredOrganizations.map((organization, index) => (
            <article className="organization-directory-card" key={organization.id} style={{ '--organization-index': index }}>
              <div className="organization-card-heading">
                <div aria-hidden="true" className={`organization-directory-avatar organization-avatar-${organization.color}`}>
                  {organization.acronym}
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
                <span><small>Active members</small><strong>{organization.activeMembers}</strong></span>
              </div>
              <Link className="button button-secondary organization-view-button" to={`/student/organizations/${organization.id}`}>
                View Organization <span aria-hidden="true">→</span>
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
