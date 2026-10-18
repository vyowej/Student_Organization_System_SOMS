/**
 * Page title block. When `children` are given (stat tiles, an organization strip…)
 * the header and its children share ONE box instead of floating as separate cards.
 */
export default function PageHeader({ title, description, eyebrow = 'Student Organization Management System', children = null }) {
  const header = (
    <header className="page-header">
      <div className="page-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  )
  if (!children) return header
  return (
    <section className="page-hero">
      {header}
      <div className="page-hero-body">{children}</div>
    </section>
  )
}
