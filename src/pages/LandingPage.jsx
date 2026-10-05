import { useState } from 'react'
import { Link } from 'react-router-dom'
import WmsuLogo from '../components/ui/WmsuLogo.jsx'
import { EventCard, LeaderCard, OrganizationCard } from '../components/public/LandingCards.jsx'
import AnimatedStatistic from '../components/public/AnimatedStatistic.jsx'
import Reveal from '../components/public/Reveal.jsx'
import {
  campusLeaderboard,
  communityUpdates,
  organizationCategories,
  organizations,
  studentLeaders,
  upcomingEvents,
} from '../data/landingPage.js'

function SectionTitle({ eyebrow, title, description, action, id }) {
  return (
    <div className="landing-section-title">
      <div>
        <span className="landing-eyebrow">{eyebrow}</span>
        <h2 id={id}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

function LandingPage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const filteredOrganizations = activeCategory === 'All'
    ? organizations
    : organizations.filter((organization) => organization.category === activeCategory)

  return (
    <div className="landing-page">
      <section aria-labelledby="hero-title" className="landing-hero">
        <div className="hero-copy">
          <span className="hero-kicker"><i /> YOUR CAMPUS, YOUR COMMUNITY</span>
          <h1 id="hero-title">Discover Your <span>Campus Community with UNIDOS.</span></h1>
          <p className="hero-tagline">Join. Lead. Make an Impact.</p>
          <p className="hero-description">
            UNIDOS brings WMSU students and organizations together as one campus community to
            discover, participate, and stay connected to everything happening on campus.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/student/organizations">
              Explore Organizations <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button-secondary" to="/student/events">
              <span aria-hidden="true">▣</span> View Upcoming Events
            </Link>
          </div>
          <div className="hero-social-proof">
            <div className="mini-avatars" aria-hidden="true"><span>AS</span><span>MD</span><span>JF</span><span>+</span></div>
            <span><strong>Find your people.</strong> Get involved at WMSU.</span>
          </div>
        </div>
        <div aria-label="Campus community illustration" className="hero-art">
          <div className="hero-art-orbit orbit-one" />
          <div className="hero-art-orbit orbit-two" />
          <div className="hero-art-center">
            <WmsuLogo className="hero-art-seal" />
            <span className="hero-art-center-label">One campus<br />many communities</span>
          </div>
          <div className="hero-float-card float-organizations"><span className="float-icon">✳</span><span><strong>50+</strong><small>Organizations</small></span></div>
          <div className="hero-float-card float-events"><span className="float-icon">▣</span><span><strong>Campus life</strong><small>Happening here</small></span></div>
          <span className="hero-spark spark-one">✦</span>
          <span className="hero-spark spark-two">✦</span>
        </div>
      </section>

      <Reveal as="section" aria-labelledby="leaders-title" className="landing-section leaders-section reveal-group">
        <SectionTitle
          description="Meet the students who bring ideas to life and make our campus community stronger."
          eyebrow="Student voices"
          id="leaders-title"
          title="Campus leaders"
        />
        <div className="leader-grid">
          {studentLeaders.map((leader) => <LeaderCard key={leader.name} leader={leader} />)}
        </div>
      </Reveal>

      <Reveal as="section" aria-label="WMSU community statistics" className="statistics-strip reveal-group">
        <AnimatedStatistic label="Organizations" suffix="+" value={50} />
        <AnimatedStatistic label="Students" suffix="+" value={2000} />
        <AnimatedStatistic label="Events" suffix="+" value={100} />
        <AnimatedStatistic label="Activities" suffix="+" value={500} />
        <AnimatedStatistic label="Campus connection" suffix="/7" value={24} />
      </Reveal>

      <Reveal as="section" aria-labelledby="organizations-title" className="landing-section organizations-section reveal-group" id="organizations">
        <SectionTitle
          action={<Link className="text-link" to="/student/organizations">Explore all organizations <span aria-hidden="true">→</span></Link>}
          description="Whatever you are passionate about, there is a place for you here."
          eyebrow="Find your people"
          id="organizations-title"
          title="Student organizations"
        />
        <div aria-label="Filter organizations by category" className="category-filters">
          {organizationCategories.map((category) => (
            <button
              aria-controls="organization-results"
              aria-pressed={activeCategory === category}
              className={`category-filter${activeCategory === category ? ' selected' : ''}`}
              key={category}
              onClick={() => setActiveCategory(category)}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>
        <div className="organization-grid" id="organization-results">
          {filteredOrganizations.map((organization) => (
            <OrganizationCard key={organization.id} organization={organization} />
          ))}
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="events-title" className="landing-section events-section reveal-group" id="events">
        <SectionTitle
          action={<Link className="text-link" to="/student/events">Explore all events <span aria-hidden="true">→</span></Link>}
          description="Make plans, meet new people, and be part of what is happening at WMSU."
          eyebrow="Mark your calendar"
          id="events-title"
          title="Upcoming events"
        />
        <div className="event-grid">
          {upcomingEvents.map((event) => <EventCard event={event} key={event.id} />)}
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="community-title" className="community-section reveal-group" id="community-feed">
        <div className="community-copy">
          <span className="landing-eyebrow">Around WMSU</span>
          <h2 id="community-title">The community is always moving.</h2>
          <p>Keep up with what student organizations are sharing and discover a new way to get involved.</p>
          <Link className="text-link" to="/student/notifications">Visit your community feed <span aria-hidden="true">→</span></Link>
        </div>
        <div className="community-updates">
          {communityUpdates.map((update, index) => (
            <Link className="community-update" key={update.title} to={update.link}>
              <span className="update-number">0{index + 1}</span>
              <span className="update-copy"><small>{update.label}</small><strong>{update.title}</strong></span>
              <span aria-hidden="true" className="update-arrow">↗</span>
            </Link>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="how-title" className="landing-section how-section reveal-group" id="about">
        <SectionTitle
          description="Getting involved is simple. Start with what interests you and see where it takes you."
          eyebrow="Your next chapter"
          id="how-title"
          title="How UNIDOS works"
        />
        <div className="how-grid">
          <article className="how-step">
            <span aria-label="Step 1" className="step-number">01</span>
            <span aria-hidden="true" className="step-icon">⌕</span>
            <h3>Discover</h3>
            <p>Find organizations and campus activities that match your interests.</p>
          </article>
          <article className="how-step">
            <span aria-label="Step 2" className="step-number">02</span>
            <span aria-hidden="true" className="step-icon">＋</span>
            <h3>Join</h3>
            <p>Apply to organizations and become part of your campus community.</p>
          </article>
          <article className="how-step">
            <span aria-label="Step 3" className="step-number">03</span>
            <span aria-hidden="true" className="step-icon">✦</span>
            <h3>Participate</h3>
            <p>Attend events, connect with students, and make an impact.</p>
          </article>
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="leaderboard-title" className="leaderboard-section reveal-group" id="leaderboard">
        <div className="leaderboard-intro">
          <span className="landing-eyebrow">Campus in action</span>
          <h2 id="leaderboard-title">Celebrating student initiative.</h2>
          <p>Organizations are making a difference through the activities and communities they build.</p>
        </div>
        <div className="leaderboard-list">
          {campusLeaderboard.map((item) => (
            <div className="leaderboard-row" key={item.rank}>
              <span className="leaderboard-rank">{item.rank}</span>
              <span className="leaderboard-mark">{item.name.slice(0, 2).toUpperCase()}</span>
              <span className="leaderboard-name"><strong>{item.name}</strong><small>{item.detail}</small></span>
              <span className="leaderboard-score">{item.score}</span>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="cta-title" className="landing-cta">
        <div aria-hidden="true" className="cta-orbit cta-orbit-outer" />
        <div aria-hidden="true" className="cta-orbit cta-orbit-inner" />
        <span className="landing-eyebrow">Your campus is calling</span>
        <h2 id="cta-title">Create Your WMSU Community Experience</h2>
        <p>Discover organizations, join campus communities, and participate in activities that make an impact.</p>
        <div className="cta-actions">
          <Link className="button button-primary" to="/register">Get Started <span aria-hidden="true">→</span></Link>
          <Link className="button button-secondary" to="/student/organizations">Explore Organizations</Link>
        </div>
      </Reveal>

      <footer className="landing-footer">
        <div className="footer-main">
          <div className="footer-school">
            <Link aria-label="UNIDOS home" className="public-brand footer-brand" to="/">
              <WmsuLogo className="brand-seal" />
              <span className="public-brand-copy"><strong>UNIDOS</strong><span>Student Organization Management System</span></span>
            </Link>
            <p className="footer-university">Western Mindanao State University</p>
            <p>Connecting WMSU students with organizations, activities, and campus communities.</p>
          </div>
          <nav aria-label="Quick links" className="footer-column">
            <strong>Quick Links</strong>
            <Link to="/">Home</Link>
            <Link to="/student/organizations">Organizations</Link>
            <Link to="/student/events">Events</Link>
            <Link to="/#about">About</Link>
          </nav>
          <nav aria-label="Student links" className="footer-column">
            <strong>Student</strong>
            <Link to="/student/my-organizations">My Organizations</Link>
            <Link to="/student/registrations">My Registrations</Link>
            <Link to="/student/attendance">Attendance</Link>
            <Link to="/student/notifications">Notifications</Link>
          </nav>
          <nav aria-label="Account links" className="footer-column">
            <strong>Account</strong>
            <Link to="/login">Sign In</Link>
            <Link to="/register">Create Account</Link>
          </nav>
          <div className="footer-column footer-contact">
            <strong>Contact</strong>
            <span><span aria-hidden="true">⌖</span> Western Mindanao State University</span>
            <span><span aria-hidden="true">✉</span> Student Affairs</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Western Mindanao State University</span>
          <span>Student Organization Management System</span>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
