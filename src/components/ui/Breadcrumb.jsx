import { Link } from 'react-router-dom'

/**
 * Accessible breadcrumb navigation trail for important directory, detail,
 * and portal pages.
 *
 * `items` is an ordered list of `{ label, to? }`. Ancestor items with `to`
 * render links; the last item renders as the current page label.
 */
export default function Breadcrumb({ items = [], standalone = false, className = '' }) {
  const validItems = Array.isArray(items) ? items.filter((item) => item && item.label) : []
  if (!validItems.length) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className={`breadcrumb-nav${standalone ? ' breadcrumb-nav--standalone' : ''}${className ? ` ${className}` : ''}`}
    >
      <ol className="breadcrumb-list">
        {validItems.map((item, index) => {
          const isLast = index === validItems.length - 1
          return (
            <li className="breadcrumb-item" key={`${item.label}-${index}`}>
              {index > 0 && (
                <span aria-hidden="true" className="breadcrumb-sep">/</span>
              )}
              {item.to && !isLast ? (
                <Link className="breadcrumb-link" to={item.to}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? 'page' : undefined} className="breadcrumb-current">
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
