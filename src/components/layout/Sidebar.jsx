import { NavLink } from 'react-router-dom'

export default function Sidebar({ role, pages, onNavigate }) {
  return (
    <aside aria-label={`${role} navigation`} className="sidebar">
      <p className="sidebar-label">Workspace</p>
      <nav className="sidebar-nav">
        {pages.map((page, index) => (
          <NavLink
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            key={`${page.to}-${page.title}`}
            onClick={onNavigate}
            to={page.to}
          >
            <span aria-hidden="true" className="nav-mark">{String(index + 1).padStart(2, '0')}</span>
            <span>{page.title}</span>
          </NavLink>
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
