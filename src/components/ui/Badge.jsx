export default function Badge({ children, tone = 'neutral', className = '' }) {
  const toneClass = tone === 'neutral' ? '' : ` badge-${tone}`

  return <span className={`badge${toneClass} ${className}`.trim()}>{children}</span>
}
