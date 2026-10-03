export default function PageHeader({ title, description, eyebrow = 'Student Organization Management System' }) {
  return (
    <header className="page-header">
      <div className="page-eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  )
}
