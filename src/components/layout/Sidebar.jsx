import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'

function sectionForPage(title) {
  if (title.includes('Dashboard')) return 'Overview'
  if (['Users', 'Students', 'Organizations'].includes(title)) return 'People & organizations'
  if (['Campus Events', 'Events', 'Approvals', 'Approval Center', 'Organization Applications'].includes(title)) return 'Activities & approvals'
  return 'Reports & settings'
}

export default function Sidebar({ role, pages, onNavigate }) {
  const groupedNavigation = role === 'Student Affairs Admin'
  const navigationItems = pages.map((page) => ({
    ...page,
    section: sectionForPage(page.title),
  }))

  return (
    <aside aria-label={`${role} navigation`} className="sidebar" id="portal-sidebar">
      <p className="sidebar-label">Navigation</p>
      <nav className="sidebar-nav">
        {navigationItems.map((page, index) => (
          <Fragment key={`${page.to}-${page.title}`}>
            {groupedNavigation && page.section !== navigationItems[index - 1]?.section && (
              <span className="sidebar-group-label">{page.section}</span>
            )}
            <NavLink
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              onClick={onNavigate}
              to={page.to}
            >
              <span aria-hidden="true" className="nav-mark" />
              <span>{page.title}</span>
            </NavLink>
          </Fragment>
        ))}
      </nav>
      <div className="sidebar-bottom">
        Western Mindanao State University
        <br />
        Student Organization Management System
      </div>
    </aside>
  )
}
