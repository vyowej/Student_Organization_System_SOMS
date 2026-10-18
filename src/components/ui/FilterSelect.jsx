import { useId } from 'react'

/**
 * Compact dropdown filter. Replaces long rows of "pill" buttons so a page
 * with many filter options stays tidy (one control per filter, not one per option).
 * `options` is a list of strings or { value, label } objects.
 */
export default function FilterSelect({ label, value, onChange, options, className = '' }) {
  const id = useId()
  return (
    <div className={`filter-select ${className}`.trim()}>
      <label htmlFor={id}>{label}</label>
      <div className="filter-select-control">
        <select id={id} onChange={(event) => onChange(event.target.value)} value={value}>
          {options.map((option) => {
            const item = typeof option === 'string' ? { value: option, label: option } : option
            return <option key={item.value} value={item.value}>{item.label}</option>
          })}
        </select>
        <svg aria-hidden="true" className="filter-select-caret" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
      </div>
    </div>
  )
}
