import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CANONICAL_PROGRAMS } from '../../data/officerHierarchy.js'

/**
 * Accessible searchable dropdown for Course / Academic Program and large option sets.
 */
export default function SearchableSelect({
  id,
  name,
  value = '',
  onChange,
  options = [],
  placeholder = 'Search and select course / program…',
  required = false,
  disabled = false,
  ariaLabel,
  className = '',
}) {
  const generatedId = useId()
  const inputId = id || generatedId
  const listboxId = `${inputId}-listbox`
  const containerRef = useRef(null)

  const normalizedOptions = useMemo(() => {
    const source = Array.isArray(options) && options.length > 0 ? options : CANONICAL_PROGRAMS
    const seen = new Set()
    const list = []
    for (const raw of source) {
      if (!raw) continue
      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        if (!trimmed || seen.has(trimmed.toLowerCase())) continue
        seen.add(trimmed.toLowerCase())
        list.push({ value: trimmed, label: trimmed, sublabel: '', searchText: trimmed.toLowerCase() })
      } else {
        const label = String(raw.label || raw.name || raw.value || '').trim()
        const acronym = String(raw.acronym || '').trim()
        const val = String(raw.value || raw.name || raw.label || '').trim()
        if (!label || !val || seen.has(val.toLowerCase())) continue
        seen.add(val.toLowerCase())
        const displayLabel = acronym && !label.includes(`(${acronym})`) ? `${label} (${acronym})` : label
        const sublabel = String(raw.sublabel || raw.college || raw.college_name || '').trim()
        list.push({
          value: val,
          label: displayLabel,
          rawName: label,
          acronym,
          sublabel,
          searchText: `${displayLabel} ${acronym} ${sublabel} ${val}`.toLowerCase(),
        })
      }
    }
    return list
  }, [options])

  const selectedOption = useMemo(() => {
    if (!value) return null
    const lower = String(value).trim().toLowerCase()
    return (
      normalizedOptions.find(
        (opt) =>
          opt.value.toLowerCase() === lower ||
          opt.label.toLowerCase() === lower ||
          (opt.acronym && opt.acronym.toLowerCase() === lower)
      ) || { value: String(value), label: String(value), sublabel: '' }
    )
  }, [normalizedOptions, value])

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return normalizedOptions
    return normalizedOptions.filter((opt) => opt.searchText.includes(q))
  }, [normalizedOptions, query])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  function selectOption(opt) {
    onChange?.(opt ? opt.value : '')
    setOpen(false)
    setQuery('')
  }

  function handleKeyDown(event) {
    if (disabled) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        setHighlightIndex(0)
      } else {
        setHighlightIndex((idx) => Math.min(filteredOptions.length - 1, idx + 1))
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightIndex((idx) => Math.max(0, idx - 1))
    } else if (event.key === 'Enter' && open) {
      event.preventDefault()
      if (filteredOptions[highlightIndex]) {
        selectOption(filteredOptions[highlightIndex])
      }
    } else if (event.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  const displayText = open ? query : (selectedOption ? selectedOption.label : '')

  return (
    <div className={`searchable-select ${open ? 'is-open' : ''} ${className}`.trim()} ref={containerRef}>
      <div className="searchable-select-control">
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-label={ariaLabel}
          autoComplete="off"
          className="searchable-select-input"
          disabled={disabled}
          id={inputId}
          name={name}
          onChange={(event) => {
            setQuery(event.target.value)
            setHighlightIndex(0)
            if (!open) setOpen(true)
            if (!event.target.value && value) {
              onChange?.('')
            }
          }}
          onFocus={() => {
            if (!disabled) {
              setOpen(true)
              setQuery('')
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedOption && open ? selectedOption.label : placeholder}
          required={required && !value}
          role="combobox"
          type="text"
          value={displayText}
        />
        {value && !disabled && (
          <button
            aria-label="Clear selected program"
            className="searchable-select-clear"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              selectOption(null)
            }}
            tabIndex={-1}
            type="button"
          >
            ×
          </button>
        )}
        <span aria-hidden="true" className="searchable-select-chevron">▾</span>
      </div>

      {open && !disabled && (
        <ul className="searchable-select-menu" id={listboxId} role="listbox">
          {filteredOptions.length === 0 ? (
            <li className="searchable-select-empty">No matching courses or programs found.</li>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = selectedOption && selectedOption.value === opt.value
              const isHighlighted = idx === highlightIndex
              return (
                <li
                  aria-selected={Boolean(isSelected)}
                  className={`searchable-select-option${isSelected ? ' is-selected' : ''}${isHighlighted ? ' is-highlighted' : ''}`}
                  key={opt.value}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    selectOption(opt)
                  }}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  role="option"
                >
                  <span className="searchable-select-option-label">{opt.label}</span>
                  {opt.sublabel && <small className="searchable-select-option-sub">{opt.sublabel}</small>}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
