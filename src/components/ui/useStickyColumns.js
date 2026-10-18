import { useEffect } from 'react'

// A column counts as an identifier when its key or label says so ("id", "userId", "Student ID").
export function isIdColumn(column) {
  return /(^id$|Id$)/.test(column.key ?? '') || /\bID\b/i.test(column.label ?? '')
}

// Name column is always pinned; an ID column in the first two positions is pinned beside it.
export function stickyColumnCount(columns) {
  if (!columns.length) return 0
  return columns.slice(0, 2).some(isIdColumn) && columns.length > 1 ? 2 : 1
}

export function stickyClass(index, count) {
  if (index >= count) return undefined
  return `cell-sticky cell-sticky-${index + 1}${index === count - 1 ? ' cell-sticky-last' : ''}`
}

/**
 * The 2nd pinned column must sit exactly after the 1st, whose width depends on its content.
 * Measure it and publish it as a CSS variable the stylesheet uses for `left`.
 */
export function useStickyOffset(tableRef, deps = []) {
  useEffect(() => {
    const table = tableRef.current
    if (!table) return undefined
    const measure = () => {
      const first = table.querySelector('thead th:first-child')
      if (first) table.style.setProperty('--sticky-left-2', `${first.offsetWidth}px`)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(table)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
