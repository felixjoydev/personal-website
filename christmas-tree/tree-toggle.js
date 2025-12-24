(function(){
  const btn = document.getElementById('tree-toggle')
  const imgCurrent = document.getElementById('tree-img-current')
  const imgNext = document.getElementById('tree-img-next')
  const iconOff = document.querySelector('#tree-toggle .icon-off')
  const iconOn = document.querySelector('#tree-toggle .icon-on')
  const heroImg = document.querySelector('.page-hero .hero-svg')

  if (!btn || !imgCurrent || !imgNext || !iconOff || !iconOn) return

  // Initial state from attribute or default off
  let isOn = btn.matches('[aria-pressed=true]')

  const srcOn = imgCurrent.dataset.on
  const srcOff = imgCurrent.dataset.off

  // Preload helper
  const preload = (src) => new Promise(resolve => {
    const i = new Image()
    i.onload = () => resolve()
    i.onerror = () => resolve()
    i.src = src
  })

  const doSwap = async (targetSrc) => {
    // Preload target
    await preload(targetSrc)

    const updateDOM = () => {
      // For the fallback crossfade we will populate imgNext then show it,
      // then after transition ends swap the current src and hide imgNext.
      imgNext.src = targetSrc
      imgNext.setAttribute('aria-hidden', 'false')
      imgNext.classList.add('show')

      const onTransitionEnd = () => {
        imgNext.classList.remove('show')
        imgCurrent.src = targetSrc
        imgNext.removeAttribute('src')
        imgNext.setAttribute('aria-hidden', 'true')
        imgNext.removeEventListener('transitionend', onTransitionEnd)
      }

      // If reduced motion is preferred, skip waiting for transition
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prefersReduced) {
        imgNext.classList.remove('show')
        imgCurrent.src = targetSrc
        imgNext.removeAttribute('src')
        imgNext.setAttribute('aria-hidden', 'true')
      } else {
        imgNext.addEventListener('transitionend', onTransitionEnd)
      }
    }

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        // update aria state on wrapper
        btn.setAttribute('aria-pressed', String(isOn))
        // direct swap for view transitions; the UA will animate the change
        imgCurrent.src = targetSrc
      })
      // update icon opacities immediately so button reflects state
      updateIcons()
    } else {
      updateDOM()
      updateIcons()
    }
  }


  const updateIcons = () => {
    if (isOn) {
      iconOn.classList.add('active')
      iconOn.setAttribute('aria-pressed', 'true')
      iconOff.classList.remove('active')
      iconOff.setAttribute('aria-pressed', 'false')
      if (heroImg) {
        heroImg.classList.remove('dimmed')
      }
    } else {
      iconOff.classList.add('active')
      iconOff.setAttribute('aria-pressed', 'true')
      iconOn.classList.remove('active')
      iconOn.setAttribute('aria-pressed', 'false')
      if (heroImg) {
        heroImg.classList.add('dimmed')
      }
    }
    btn.setAttribute('aria-pressed', String(isOn))
  }

  // Click handlers for icons
  iconOn.addEventListener('click', async () => {
    if (isOn) return
    isOn = true
    const target = srcOn
    await doSwap(target)
  })
  iconOff.addEventListener('click', async () => {
    if (!isOn) return
    isOn = false
    const target = srcOff
    await doSwap(target)
  })

  // Keyboard support (Enter/Space)
  const keyHandler = (el, handler) => el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handler()
    }
  })
  keyHandler(iconOn, () => iconOn.click())
  keyHandler(iconOff, () => iconOff.click())

  // Initialize icons
  updateIcons()
  // Preload both images on startup (non-blocking)
  preload(srcOn)
  preload(srcOff)
})()
