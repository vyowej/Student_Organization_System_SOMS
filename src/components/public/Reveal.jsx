import { useEffect, useRef, useState } from 'react'

export default function Reveal({ as: Element = 'div', className = '', children, ...props }) {
  const elementRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return undefined

    // Fail-safe 1: If element is already in or near viewport on mount, reveal immediately
    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800
    if (rect.top <= viewportHeight + 150) {
      setVisible(true)
    }

    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return undefined
    }

    // Fail-safe 2: Fallback timer ensures content NEVER stays permanently hidden
    const timer = setTimeout(() => {
      setVisible(true)
    }, 600)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          clearTimeout(timer)
          observer.unobserve(element)
        }
      },
      // threshold: 0 ensures any intersection (even 1px) triggers visibility
      // rootMargin expands the trigger area 100px before the element enters
      { threshold: 0, rootMargin: '100px 0px 100px 0px' },
    )

    observer.observe(element)
    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  return (
    <Element
      className={`reveal${visible ? ' is-visible' : ''} ${className}`.trim()}
      ref={elementRef}
      {...props}
    >
      {children}
    </Element>
  )
}
