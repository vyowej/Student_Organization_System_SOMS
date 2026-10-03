import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

const publicLinks = [
  { label: 'Home', to: '/' },
  { label: 'Organizations', to: '/#organizations' },
  { label: 'Events', to: '/#events' },
  { label: 'About', to: '/#about' },
  { label: 'Community Feed', to: '/#community-feed' },
  { label: 'Leaderboard', to: '/#leaderboard' },
]

export default function PublicLayout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    function updateScrollState() {
      setIsScrolled(window.scrollY > 8)
      if (window.scrollY < 100) setActiveSection('')
    }

    updateScrollState()
    window.addEventListener('scroll', updateScrollState, { passive: true })

    const sections = document.querySelectorAll(
      '#organizations, #events, #about, #community-feed, #leaderboard',
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
          <span aria-hidden="true" className="brand-seal">WMSU</span>
          <span className="public-brand-copy">
            <strong>UNIDOS</strong>
            <span>WESTERN MINDANAO STATE UNIVERSITY · Student Organization Management System</span>
          </span>
        </Link>
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="public-menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          {menuOpen ? '×' : '☰'}
        </button>
        <nav aria-label="Main navigation" className={`public-links${menuOpen ? ' public-links-open' : ''}`}>
          {publicLinks.map((item, index) => (
            <Link
              aria-current={activeSection === item.to.split('#')[1] || (!activeSection && index === 0) ? 'location' : undefined}
              className={activeSection === item.to.split('#')[1] || (!activeSection && index === 0) ? 'active' : ''}
              key={item.label}
              onClick={() => setMenuOpen(false)}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
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
