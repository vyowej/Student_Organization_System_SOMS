import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import WmsuLogo from '../ui/WmsuLogo.jsx'

const publicLinks = [
  { label: 'Home', to: '/' },
  { label: 'Organizations', to: '/#organizations' },
  { label: 'Events', to: '/#events' },
  { label: 'About', to: '/#about' },
]

export default function PublicLayout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    if (location.pathname !== '/') return undefined
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return undefined
    }

    const targetId = decodeURIComponent(location.hash.slice(1))
    const frameId = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [location.hash, location.pathname])

  useEffect(() => {
    function updateScrollState() {
      setIsScrolled(window.scrollY > 8)
      if (window.scrollY < 100) setActiveSection('')
    }

    updateScrollState()
    window.addEventListener('scroll', updateScrollState, { passive: true })

    const sections = document.querySelectorAll(
      '#organizations, #events, #about',
    )
    if (!('IntersectionObserver' in window) || sections.length === 0) {
      return () => window.removeEventListener('scroll', updateScrollState)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0]
        if (visibleSection) setActiveSection(visibleSection.target.id)
      },
      { rootMargin: '-18% 0px -68% 0px', threshold: [0, 0.15, 0.35, 0.6] },
    )
    sections.forEach((section) => observer.observe(section))

    return () => {
      window.removeEventListener('scroll', updateScrollState)
      observer.disconnect()
    }
  }, [location.hash, location.pathname])

  return (
    <div className="app-shell public-page">
      <header className={`public-navbar${isScrolled ? ' is-scrolled' : ''}`}>
        <Link aria-label="UNIDOS home" className="public-brand" to="/">
          <WmsuLogo className="brand-seal" />
          <span className="public-brand-copy">
            <strong>UNIDOS</strong>
            <span>WMSU Student Organization Management System</span>
          </span>
        </Link>
        <button
          aria-expanded={menuOpen}
          aria-controls="public-navigation"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="public-menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <svg aria-hidden="true" className="menu-toggle-icon" viewBox="0 0 24 24">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        <nav aria-label="Main navigation" className={`public-links${menuOpen ? ' public-links-open' : ''}`} id="public-navigation">
          {publicLinks.map((item, index) => {
            const sectionId = item.to.split('#')[1]
            const isHome = !sectionId && index === 0 && location.pathname === '/' && !location.hash && !activeSection
            const isActive = sectionId ? activeSection === sectionId : isHome

            return (
              <Link
                aria-current={isActive ? 'location' : undefined}
                className={isActive ? 'active' : ''}
                key={item.label}
                onClick={() => setMenuOpen(false)}
                to={item.to}
              >
                {item.label}
              </Link>
            )
          })}
          <Link className="public-sign-in" onClick={() => setMenuOpen(false)} to="/login">Sign in</Link>
          <Link className="button button-primary public-get-started" onClick={() => setMenuOpen(false)} to="/register">Get Started</Link>
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
    </div>
  )
}
