export default function EmptyState({
  title = 'Nothing to show yet',
  description = 'When information is available, it will appear here.',
  action = null,
  children = null,
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-icon">i</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {(action || children) && <div className="empty-state-action" style={{ marginTop: '1rem' }}>{action || children}</div>}
    </div>
  )
}
