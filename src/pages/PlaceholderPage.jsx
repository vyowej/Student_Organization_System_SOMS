import { Link, useLocation, useParams } from 'react-router-dom'
import Card from '../components/ui/Card.jsx'
import Badge from '../components/ui/Badge.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { roleNavigation } from '../data/navigation.js'

export default function PlaceholderPage({ page, role }) {
  const location = useLocation()
  const params = useParams()
  const navigation = roleNavigation[role]
  const relevantPages = navigation.pages
    .filter((item) => item.to !== location.pathname)
    .slice(0, 3)

  return (
    <>
      <PageHeader
        description={page.description}
        eyebrow="WESTERN MINDANAO STATE UNIVERSITY"
        title={page.title}
      />
      <div className="page-placeholder">
        <Card className="placeholder-main">
          <Badge tone="crimson">Frontend preview</Badge>
          <h2>{page.title}{params.id ? ` · ${params.id}` : ''}</h2>
          <p>
            This page is part of the {role} workspace. Detailed tools and live records will be
            added in a later implementation step.
          </p>
          <nav aria-label="Relevant navigation" className="placeholder-nav">
            {relevantPages.map((item) => (
              <Link key={`${item.to}-${item.title}`} to={item.to}>{item.title}</Link>
            ))}
          </nav>
        </Card>
        <Card className="placeholder-aside">
          <Badge>{role}</Badge>
          <p>
            You are viewing the {role.toLowerCase()} area of the Student Organization
            Management System.
          </p>
        </Card>
      </div>
    </>
  )
}
