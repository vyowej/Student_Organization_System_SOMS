export default function EmptyState({
  title = 'Nothing to show yet',
  description = 'When information is available, it will appear here.',
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-icon">i</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
