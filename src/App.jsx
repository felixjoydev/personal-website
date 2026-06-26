import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const products = [
  {
    id: 'supergoal',
    name: 'SuperGoal',
    logo: '/assets/supergoal-logo.png',
    roundedLogo: true,
    badge: 'LAUNCHED',
    badgeColor: 'green',
    description: 'World Cup 2026 in your menu bar',
    link: '/supergoal/',
  },
  {
    id: 'guestbook',
    name: 'Guestbook',
    logo: '/assets/guestbook-logo.svg',
    badge: 'LAUNCHED',
    badgeColor: 'green',
    description: 'Sign, scribble, share online',
    link: 'https://guestbook.cv',
  },
  {
    id: 'swag',
    name: 'Swag',
    logo: '/assets/swag-logo.svg',
    badge: 'LAUNCHED',
    badgeColor: 'green',
    description: 'Linkedin/Resume to website',
    link: 'https://swag.li',
  },
  {
    id: 'superclip',
    name: 'SuperClip',
    logo: '/assets/superclip-logo.svg',
    roundedLogo: true,
    badge: 'IN PROGRESS',
    badgeColor: 'yellow',
    description: 'The last clipboard app you ever need',
    link: 'https://superclip.app',
  },
  {
    id: 'stumble',
    name: 'Stumble',
    logo: '/assets/placeholder-logo.svg',
    badge: 'SOON',
    badgeColor: 'gray',
    description: '--',
  },
]

const playground = [
  {
    id: 'orb',
    name: 'Orb',
    logo: '/assets/orb-logo.svg',
    roundedLogo: true,
    description: 'A living globe of movies',
    link: '/playground/orb/',
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    logo: '/assets/typewriter-logo.svg',
    description: 'A minimal typing speed test',
    link: '/playground/typewriter/',
  },
]

const contacts = [
  {
    id: 'email',
    label: 'Email',
    value: 'felixjoyco@gmail.com',
    href: 'mailto:felixjoyco@gmail.com',
  },
  {
    id: 'twitter',
    label: 'X (Twitter)',
    value: '@felixjoydc',
    href: 'https://x.com/felixjoydc',
    external: true,
  },
  {
    id: 'linkedin',
    label: 'Linkedin',
    value: '/in/felixjoydc',
    href: 'https://linkedin.com/in/felixjoydc',
    external: true,
  },
  {
    id: 'call',
    label: 'Book a call',
    value: '15-min meeting',
    href: 'https://cal.com/felix-joy-zkizzh/15-min-meeting?overlayCalendar=true',
    external: true,
  },
]

function App() {
  const [hoveredItem, setHoveredItem] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showFooterProfile, setShowFooterProfile] = useState(false)
  const [hoveredProfileLink, setHoveredProfileLink] = useState(null)
  const [hoveredFooterLink, setHoveredFooterLink] = useState(null)
  const profileTimeout = useRef(null)
  const footerProfileTimeout = useRef(null)

  const openProfile = () => {
    clearTimeout(profileTimeout.current)
    setShowProfile(true)
  }

  const closeProfile = () => {
    profileTimeout.current = setTimeout(() => setShowProfile(false), 150)
  }

  const openFooterProfile = () => {
    clearTimeout(footerProfileTimeout.current)
    setShowFooterProfile(true)
  }

  const closeFooterProfile = () => {
    footerProfileTimeout.current = setTimeout(() => setShowFooterProfile(false), 150)
  }

  const profileLinks = [
    { id: 'houseofbrands', label: 'House of Brands', icon: '/assets/globe.svg', href: 'https://www.houseofbrands.cv' },
    { id: 'xtwitter', label: 'X (Twitter)', icon: '/assets/x.svg', href: 'https://x.com/felixjoydc' },
    { id: 'linkedin', label: 'LinkedIn', icon: '/assets/linkedin.svg', href: 'https://linkedin.com/in/felixjoydc' },
  ]

  return (
    <>
      <motion.div
        className="dim-overlay"
        animate={{ opacity: (hoveredItem || showProfile || showFooterProfile) ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />

      <div className="container">
        <header>
          <img src="/assets/logo.svg" alt="Felix Joy" width="27" height="32" />
        </header>

        <main>
          <section className="description">
            <p>
              I'm{' '}
              <span className="profile-trigger" onMouseEnter={openProfile} onMouseLeave={closeProfile}>
                <span className="avatar-name"><img className="avatar" src="/assets/felix.webp" alt="Felix Joy" /><span className="text-emphasis">Felix Joy</span></span>
                <AnimatePresence>
                  {showProfile && (
                    <motion.div
                      className="profile-dropdown"
                      initial={{ clipPath: 'inset(0 0 100% 0)', opacity: 0 }}
                      animate={{ clipPath: 'inset(0 0 0% 0)', opacity: 1 }}
                      exit={{ clipPath: 'inset(0 0 100% 0)', opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                      onMouseEnter={openProfile}
                      onMouseLeave={closeProfile}
                    >
                      {profileLinks.map((link) => (
                        <a
                          key={link.id}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="profile-link"
                          onMouseEnter={() => setHoveredProfileLink(link.id)}
                          onMouseLeave={() => setHoveredProfileLink(null)}
                        >
                          {hoveredProfileLink === link.id && (
                            <motion.div
                              className="profile-link-bg"
                              layoutId="profile-hover"
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            />
                          )}
                          <span className="profile-link-label">
                            <img src={link.icon} alt="" className="profile-link-icon" />
                            {link.label}
                          </span>
                          <img src="/assets/external-link.svg" alt="" />
                        </a>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </span>, a multi-disciplinary designer based in Kochi, India. My work spans product
              design, web design and branding, taking ideas from first sketch to shipped product.
            </p>
            <p>
              Over the years I have designed for enterprises and startups alike, shipping both
              B2C and B2B products. On the side, I build small products of my own to keep my
              craft sharp.
            </p>
            <p>
              Currently <span className="text-emphasis">available for work</span> -{' '}
              <a className="text-link" href="https://cal.com/felix-joy-zkizzh/15-min-meeting?overlayCalendar=true" target="_blank" rel="noopener noreferrer">book a call</a>.
            </p>
          </section>

          <section className="products">
            <p className="products-label">Side projects</p>
            <div
              className="products-list"
              onMouseLeave={() => setHoveredItem(null)}
            >
              {products.map((product) => {
                const CardTag = product.link ? 'a' : 'div'
                const linkProps = product.link
                  ? { href: product.link, target: '_blank', rel: 'noopener noreferrer' }
                  : {}
                const isHovered = hoveredItem === product.id

                return (
                  <CardTag
                    key={product.id}
                    className={`product-card${product.link ? ' active' : ''}${isHovered ? ' hovered' : ''}`}
                    onMouseEnter={() => setHoveredItem(product.id)}
                    {...linkProps}
                  >
                    {isHovered && (
                      <motion.div
                        className="hover-bg"
                        layoutId="hover-highlight"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <div className="product-info">
                      <img className={`product-logo${product.roundedLogo ? ' product-logo--rounded' : ''}`} src={product.logo} alt={product.name} />
                      <div className="product-details">
                        <div className="product-name-row">
                          <span className="product-name">{product.name}</span>
                          <span className="badge">
                            <span className={`dot dot--${product.badgeColor}`}></span>{' '}
                            {product.badge}
                          </span>
                        </div>
                        <p className="product-description">{product.description}</p>
                      </div>
                    </div>
                    {product.link && (
                      <span className="external-link">
                        <img src="/assets/external-link.svg" alt={`Visit ${product.name}`} />
                      </span>
                    )}
                  </CardTag>
                )
              })}
            </div>
          </section>

          <section className="products">
            <p className="products-label">Playground</p>
            <div
              className="products-list"
              onMouseLeave={() => setHoveredItem(null)}
            >
              {playground.map((product) => {
                const CardTag = product.link ? 'a' : 'div'
                const linkProps = product.link
                  ? { href: product.link, target: '_blank', rel: 'noopener noreferrer' }
                  : {}
                const isHovered = hoveredItem === product.id

                return (
                  <CardTag
                    key={product.id}
                    className={`product-card${product.link ? ' active' : ''}${isHovered ? ' hovered' : ''}`}
                    onMouseEnter={() => setHoveredItem(product.id)}
                    {...linkProps}
                  >
                    {isHovered && (
                      <motion.div
                        className="hover-bg"
                        layoutId="hover-highlight"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <div className="product-info">
                      <img className={`product-logo${product.roundedLogo ? ' product-logo--rounded' : ''}`} src={product.logo} alt={product.name} />
                      <div className="product-details">
                        <div className="product-name-row">
                          <span className="product-name">{product.name}</span>
                          {product.badge && (
                            <span className="badge">
                              <span className={`dot dot--${product.badgeColor}`}></span>{' '}
                              {product.badge}
                            </span>
                          )}
                        </div>
                        <p className="product-description">{product.description}</p>
                      </div>
                    </div>
                    {product.link && (
                      <span className="external-link">
                        <img src="/assets/external-link.svg" alt={`Visit ${product.name}`} />
                      </span>
                    )}
                  </CardTag>
                )
              })}
            </div>
          </section>

          <section className="contact">
            <p className="products-label">Connect</p>
            <div
              className="contact-list"
              onMouseLeave={() => setHoveredItem(null)}
            >
            {contacts.map((contact) => {
              const isHovered = hoveredItem === contact.id

              return (
                <div
                  key={contact.id}
                  className={`contact-row${isHovered ? ' hovered' : ''}`}
                  onMouseEnter={() => setHoveredItem(contact.id)}
                >
                  {isHovered && (
                    <motion.div
                      className="hover-bg"
                      layoutId="hover-highlight"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="contact-label">{contact.label}</span>
                  <div className="contact-value">
                    <a
                      href={contact.href}
                      {...(contact.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {contact.value}
                    </a>
                    <a
                      href={contact.href}
                      className="external-link"
                      {...(contact.external
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      <img src="/assets/external-link.svg" alt={contact.label} />
                    </a>
                  </div>
                </div>
              )
            })}
            </div>
          </section>
        </main>

        <footer>
          <div className="signature">
            <img src="/assets/signature.svg" alt="Felix Joy signature" />
            <span className="footer-profile-trigger" onMouseEnter={openFooterProfile} onMouseLeave={closeFooterProfile}>
              <p className="signature-text">
                Made by <strong>Felix Joy</strong>
              </p>
              <AnimatePresence>
                {showFooterProfile && (
                  <motion.div
                    className="profile-dropdown profile-dropdown--up"
                    initial={{ clipPath: 'inset(100% 0 0 0)', opacity: 0 }}
                    animate={{ clipPath: 'inset(0% 0 0 0)', opacity: 1 }}
                    exit={{ clipPath: 'inset(100% 0 0 0)', opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    onMouseEnter={openFooterProfile}
                    onMouseLeave={closeFooterProfile}
                  >
                    {profileLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="profile-link"
                        onMouseEnter={() => setHoveredFooterLink(link.id)}
                        onMouseLeave={() => setHoveredFooterLink(null)}
                      >
                        {hoveredFooterLink === link.id && (
                          <motion.div
                            className="profile-link-bg"
                            layoutId="footer-profile-hover"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        )}
                        <span className="profile-link-label">
                          <img src={link.icon} alt="" className="profile-link-icon" />
                          {link.label}
                        </span>
                        <img src="/assets/external-link.svg" alt="" />
                      </a>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </span>
          </div>
          <span>&copy;2026</span>
        </footer>
      </div>
    </>
  )
}

export default App
