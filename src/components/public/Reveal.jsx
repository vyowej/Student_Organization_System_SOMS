import { useEffect, useRef, useState } from 'react'

export default function Reveal({ as: Element = 'div', className = '', children, ...props }) {
  const elementRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element || !('IntersectionObserver' in window)) {
      setVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(element)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -35px 0px' },
    )

    observer.observe(element)
    return () => observer.disconnect()
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
