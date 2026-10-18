import { NavLink } from 'react-router-dom'

/**
 * Facebook-style profile header: cover banner, overlapping avatar, identity,
 * action buttons and a tab row.
 *
 * tabs: [{ key, label, count?, to? , active?, onClick? }]
 *   - with `to`      → renders a router link (page navigation)
 *   - with `onClick` → renders a tab button (in-page switching)
 */
export default function ProfileCover({
  actions = null,
  avatarText = '',
  badges = null,
  eyebrow = '',
  label = 'Profile',
  logo = '',
  showCover = true,
  subtitle = null,
  tabs = [],
  tabsLabel = 'Profile sections',
  title,
}) {
  return (
    <section aria-label={label} className={`fb-cover-card${showCover ? '' : ' fb-no-cover'}`}>
      {showCover && (
        <div aria-hidden="true" className="fb-cover">
          <span className="fb-cover-shape fb-cover-shape-a" />
          <span className="fb-cover-shape fb-cover-shape-b" />
        </div>
      )}

      <div className="fb-identity">
        <div aria-hidden="true" className="fb-avatar">
          {logo ? <img alt="" src={logo} /> : avatarText}
        </div>
        <div className="fb-identity-copy">
          {eyebrow && <span className="fb-eyebrow">{eyebrow}</span>}
          <h1>{title}</h1>
          {subtitle && <p className="fb-subtitle">{subtitle}</p>}
          {badges && <div className="fb-badges">{badges}</div>}
        </div>
        {actions && <div className="fb-actions">{actions}</div>}
      </div>

      {tabs.length > 0 && (
        <nav aria-label={tabsLabel} className="fb-tabs">
          {tabs.map((tab) => {
            const content = (
              <>
                {tab.label}
                {tab.count !== undefined && <span className="fb-tab-count">{tab.count}</span>}
              </>
            )
            if (tab.to) {
              return (
                <NavLink className={({ isActive }) => `fb-tab${isActive || tab.active ? ' is-active' : ''}`} end key={tab.key} to={tab.to}>
                  {content}
                </NavLink>
              )
            }
            return (
              <button
                aria-current={tab.active ? 'page' : undefined}
                className={`fb-tab${tab.active ? ' is-active' : ''}`}
                key={tab.key}
                onClick={tab.onClick}
                type="button"
              >
                {content}
              </button>
            )
          })}
        </nav>
      )}
    </section>
  )
}
