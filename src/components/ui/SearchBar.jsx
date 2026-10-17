import { useId } from 'react'
import Icon from './Icon.jsx'

/**
 * Shared search field used across every portal. `sticky` pins it under the top bar
 * while the page scrolls (used on long, multi-section pages such as Attendance).
 */
export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  sticky = false,
  resultText = '',
  children = null,
}) {
  const id = useId()
  return (
    <div className={`search-bar ${sticky ? 'search-bar-sticky' : ''}`.trim()} role="search">
      <label className="search-bar-field" htmlFor={id}>
        <Icon className="search-bar-icon" name="search" size={18} />
        <span className="visually-hidden">{label}</span>
        <input
          autoComplete="off"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="search"
          value={value}
        />
        {value && (
          <button aria-label="Clear search" className="search-bar-clear" onClick={() => onChange('')} type="button">×</button>
        )}
      </label>
      {children}
      {resultText && <span aria-live="polite" className="search-bar-result">{resultText}</span>}
    </div>
  )
}

// Case-insensitive match of `query` against any of the given values.
export function matchesQuery(query, ...values) {
  const needle = query.trim().toLowerCase()
  return !needle || values.some((value) => String(value ?? '').toLowerCase().includes(needle))
}
