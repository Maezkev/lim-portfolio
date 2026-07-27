/* =============================================================================
   Wydia Kristiany — Portfolio
   Vanilla JS, no dependencies. Every behaviour here is an enhancement: with the
   file removed the page still renders, scrolls, and the reel cards still link
   out to Instagram.

     01  Mobile menu
     02  Header scroll state
     03  Scroll reveal
     04  Parallax
     05  Pinned horizontal gallery
     06  Table of contents
     07  Custom cursor
     08  Reel lightbox (on-demand Instagram embed)
     09  Footer year
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------------
     01  MOBILE MENU
     Toggles the full-screen overlay, locks body scroll, and closes on link
     click, Escape, or when the viewport grows past the desktop breakpoint.
     ------------------------------------------------------------------------ */
  var toggle = document.getElementById('menuToggle');
  var menu = document.getElementById('mobileMenu');

  function setMenu(open) {
    if (!toggle || !menu) return;
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('is-locked', open);
    var label = toggle.querySelector('.header__toggle-label');
    if (label) label.textContent = open ? 'Close' : 'Menu';
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      setMenu(menu.hidden);
    });

    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });

    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (event) {
      if (event.matches) setMenu(false);
    });
  }

  /* ---------------------------------------------------------------------------
     02  HEADER SCROLL STATE
     Frosts the header once the hero is behind us.
     ------------------------------------------------------------------------ */
  var header = document.getElementById('header');

  function updateHeader() {
    if (header) header.classList.toggle('is-stuck', window.scrollY > window.innerHeight * 0.6);
  }

  /* ---------------------------------------------------------------------------
     03  SCROLL REVEAL
     One IntersectionObserver for every [data-reveal]; each element is
     unobserved after it fires so nothing keeps running.
     ------------------------------------------------------------------------ */
  var revealables = document.querySelectorAll('[data-reveal]');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-inview'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-inview');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    revealables.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ---------------------------------------------------------------------------
     04  PARALLAX

     Each [data-parallax] element is offset vertically in proportion to its
     distance from the centre of the viewport:

         offset = (element centre − viewport centre) × speed

     A positive speed makes the element lag behind the scroll, a negative one
     makes it run ahead. The result is written to a --py / --px custom property
     rather than to `transform` directly, so it composes with the reveal offset
     and the card hover lift instead of overwriting them (see styles.css § 15).

     Only elements currently in view are touched, all reads happen in one pass
     before any writes, and the whole thing is gated behind an
     IntersectionObserver plus one rAF per scroll event.
     ------------------------------------------------------------------------ */
  var MAX_OFFSET = 160;   // px — keeps the effect subtle at any scroll speed
  var items = [];
  var active = [];
  var parallaxTicking = false;

  function collectParallax() {
    var nodes = document.querySelectorAll('[data-parallax], [data-parallax-x]');
    // Mobile viewports get a damped effect — large offsets read as jitter there.
    var damp = window.innerWidth < 768 ? 0.55 : 1;

    items = Array.prototype.map.call(nodes, function (el) {
      if (el.hasAttribute('data-reveal')) el.classList.add('has-parallax');
      return {
        el: el,
        y: parseFloat(el.getAttribute('data-parallax') || 0) * damp,
        x: parseFloat(el.getAttribute('data-parallax-x') || 0) * damp
      };
    });
  }

  function renderParallax() {
    var mid = window.innerHeight / 2;

    // Read phase — measure everything first to avoid layout thrash.
    var frames = active.map(function (item) {
      var rect = item.el.getBoundingClientRect();
      return { item: item, distance: rect.top + rect.height / 2 - mid };
    });

    // Write phase.
    frames.forEach(function (frame) {
      var d = frame.distance;
      var el = frame.item.el;

      if (frame.item.y) {
        var py = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, d * frame.item.y));
        el.style.setProperty('--py', py.toFixed(2) + 'px');
      }
      if (frame.item.x) {
        var px = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, d * frame.item.x));
        el.style.setProperty('--px', px.toFixed(2) + 'px');
      }
    });
  }

  /* ---------------------------------------------------------------------------
     04b SERVICE SCROLL-HOVER

     As the user scrolls through the Services section, the service item whose
     vertical centre is closest to the viewport centre gets the class
     `is-scroll-active`. CSS applies a hover-like lift, brighter text and a
     subtle glow — creating the illusion that scroll "hovers" through the list.

     Items outside the services section are ignored. When no service is near
     the centre (section out of view), all classes are removed.
     ------------------------------------------------------------------------ */
  var serviceItems = Array.prototype.slice.call(document.querySelectorAll('.service'));
  var activeServiceIdx = -1;

  function updateServiceHover() {
    if (!serviceItems.length) return;

    var vh = window.innerHeight;
    var centre = vh * 0.5;
    var bestIdx = -1;
    var bestDist = Infinity;

    serviceItems.forEach(function (el, i) {
      var rect = el.getBoundingClientRect();
      var elCentre = rect.top + rect.height * 0.5;
      var dist = Math.abs(elCentre - centre);

      // Only consider items that are at least partially visible
      if (rect.bottom > 0 && rect.top < vh && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });

    // Only apply if the best item is reasonably close to the viewport centre
    if (bestDist > vh * 0.45) bestIdx = -1;

    if (bestIdx !== activeServiceIdx) {
      if (activeServiceIdx > -1 && serviceItems[activeServiceIdx]) {
        serviceItems[activeServiceIdx].classList.remove('is-scroll-active');
      }
      if (bestIdx > -1) {
        serviceItems[bestIdx].classList.add('is-scroll-active');
      }
      activeServiceIdx = bestIdx;
    }
  }

  function onScroll() {
    if (parallaxTicking) return;
    parallaxTicking = true;
    window.requestAnimationFrame(function () {
      updateHeader();
      updateToc();
      if (!reduceMotion) {
        renderParallax();
        renderGallery();
      }
      updateServiceHover();
      parallaxTicking = false;
    });
  }

  if (!reduceMotion && 'IntersectionObserver' in window) {
    collectParallax();

    /* Track which parallax elements are on screen; everything else is skipped
       entirely on scroll. */
    var parallaxObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var item = items.filter(function (i) { return i.el === entry.target; })[0];
        if (!item) return;

        var index = active.indexOf(item);
        if (entry.isIntersecting && index === -1) active.push(item);
        if (!entry.isIntersecting && index > -1) active.splice(index, 1);
      });
      renderParallax();
    }, { rootMargin: '20% 0px 20% 0px' });

    items.forEach(function (item) { parallaxObserver.observe(item.el); });

    /* Re-derive the damping factor when the viewport crosses the breakpoint. */
    var resizeTimer;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        var previous = items;
        collectParallax();
        // Re-point the active list at the refreshed item objects.
        active = active
          .map(function (old) {
            return items[previous.indexOf(old)];
          })
          .filter(Boolean);
        renderParallax();
      }, 200);
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------------------
     05  PINNED HORIZONTAL GALLERY

     From 1024px up, the Selected Work section becomes taller than the viewport
     and its stage sticks to the top. The track is then slid sideways in
     proportion to how far the section has travelled, so vertical scrolling
     reads as the row of cards moving right to left.

         overflow = track width − stage width      (px of sideways travel)
         height   = viewport + overflow            (px of vertical scroll)
         progress = −rect.top / overflow           (0 → 1 while pinned)

     Because the height is set to viewport + overflow, `rect.height − viewport`
     equals the overflow exactly, so progress needs no separate measurement.

     Below that width — and whenever reduced motion is requested — none of this
     is applied and the track stays a native scroll-snap carousel.
     ------------------------------------------------------------------------ */
  var scroller = document.getElementById('workScroller');
  var track = document.getElementById('workTrack');
  var overflowX = 0;

  /* Lerp smoothing state for the horizontal gallery */
  var galleryTargetTx = 0;   // Where scroll says we should be (px)
  var galleryCurrentTx = 0;  // Where the track actually is (px, lerped)
  var GALLERY_LERP = 0.08;   // Interpolation factor — lower = smoother
  var galleryRafId = null;    // Persistent rAF handle

  var canPin = window.matchMedia('(min-width: 1024px)');

  function measureGallery() {
    if (!scroller || !track) return;

    if (!canPin.matches || reduceMotion) {
      // Tear pinned mode down and hand scrolling back to the browser.
      scroller.classList.remove('is-pinned');
      scroller.style.height = '';
      track.style.removeProperty('--tx');
      overflowX = 0;
      galleryTargetTx = 0;
      galleryCurrentTx = 0;
      if (galleryRafId) { cancelAnimationFrame(galleryRafId); galleryRafId = null; }
      return;
    }

    scroller.classList.add('is-pinned');

    /* Measure with the track untranslated, or the reading is skewed. */
    track.style.setProperty('--tx', '0px');

    /* Measured off the last card's layout box rather than track.scrollWidth:
       the track overflows visibly, and browsers disagree on whether scrollWidth
       includes that overflow plus trailing padding. offsetLeft/offsetWidth
       ignore the cards' rotation, which is what we want here. */
    var last = track.children[track.children.length - 1];
    var trailing = scroller.clientWidth * 0.14;   /* closing inset, mirrors the opening one */

    overflowX = last
      ? Math.max(0, last.offsetLeft + last.offsetWidth + trailing - scroller.clientWidth)
      : 0;

    scroller.style.height = (window.innerHeight + overflowX) + 'px';

    /* Kick off the smooth render loop if it isn't running yet */
    if (!galleryRafId) galleryLerpLoop();
  }

  /** Update the scroll-derived target — called on every scroll event */
  function renderGallery() {
    if (!overflowX || !scroller) return;

    var rect = scroller.getBoundingClientRect();
    var progress = Math.max(0, Math.min(1, -rect.top / overflowX));

    galleryTargetTx = -progress * overflowX;
  }

  /** Persistent rAF loop: ease currentTx → targetTx each frame */
  function galleryLerpLoop() {
    var diff = galleryTargetTx - galleryCurrentTx;

    /* Snap when close enough to avoid endless sub-pixel ticking */
    if (Math.abs(diff) < 0.5) {
      galleryCurrentTx = galleryTargetTx;
    } else {
      galleryCurrentTx += diff * GALLERY_LERP;
    }

    track.style.setProperty('--tx', galleryCurrentTx.toFixed(2) + 'px');

    if (overflowX) {
      galleryRafId = requestAnimationFrame(galleryLerpLoop);
    } else {
      galleryRafId = null;
    }
  }

  if (scroller && track) {
    measureGallery();
    renderGallery();

    canPin.addEventListener('change', function () {
      measureGallery();
      renderGallery();
    });

    /* Card widths derive from viewport height, so the track must be re-measured
       when the window resizes — and again once the lazy images have arrived,
       since they can alter the track's width. */
    var galleryTimer;
    window.addEventListener('resize', function () {
      window.clearTimeout(galleryTimer);
      galleryTimer = window.setTimeout(function () {
        measureGallery();
        renderGallery();
      }, 200);
    });

    track.querySelectorAll('img').forEach(function (img) {
      if (img.complete) return;
      img.addEventListener('load', function () {
        measureGallery();
        renderGallery();
      }, { once: true });
    });
  }

  /* ---------------------------------------------------------------------------
     06  TABLE OF CONTENTS

     Marks the entry whose section is currently in view. The active section is
     the last one whose top edge has passed 45% of the viewport height — which
     keeps the highlight in step with what the reader is actually looking at,
     rather than flipping the moment a section's first pixel appears.

     Each entry's target is read from its own href, so adding a section to the
     markup needs no change here.
     ------------------------------------------------------------------------ */
  var toc = document.getElementById('toc');
  var hero = document.getElementById('intro');
  var tocItems = [];
  var activeToc = -1;

  document.querySelectorAll('.toc__item').forEach(function (item) {
    var link = item.querySelector('a');
    var target = link && document.querySelector(link.getAttribute('href'));
    if (target) tocItems.push({ item: item, target: target });
  });

  function updateToc() {
    if (!tocItems.length) return;

    var line = window.innerHeight * 0.45;
    var index = 0;

    for (var i = 0; i < tocItems.length; i++) {
      if (tocItems[i].target.getBoundingClientRect().top <= line) index = i;
    }

    /* Hidden while the hero still covers the activation line. This is measured
       off the hero itself rather than the active index, because the list no
       longer has an entry for it — entry 0 is now About.
       Toggled before the early return below, which only guards the swap. */
    if (toc && hero) {
      toc.classList.toggle('is-hidden', hero.getBoundingClientRect().bottom > line);
    }

    if (index === activeToc) return;

    if (tocItems[activeToc]) tocItems[activeToc].item.classList.remove('is-active');
    tocItems[index].item.classList.add('is-active');
    activeToc = index;
  }

  /* The first onScroll() fires before the list above exists, so set the opening
     state here. */
  updateToc();

  /* ---------------------------------------------------------------------------
     07  CUSTOM CURSOR

     The dot is written straight to the pointer position; the ring chases it by
     covering a fixed fraction of the remaining gap each frame:

         ring += (pointer − ring) × EASE

     which is a frame-rate-independent-enough exponential ease, and settles on
     its own — the rAF loop stops once the gap closes below half a pixel and
     restarts on the next move, so an idle pointer costs nothing.

     Set up only for fine pointers (mouse/trackpad). Touch devices never reach
     this code, so they keep their native behaviour, and the native pointer is
     restored while the lightbox is open so the embed stays usable.
     ------------------------------------------------------------------------ */
  var CURSOR_EASE = 0.18;

  var cursorRing = document.getElementById('cursorRing');
  var cursorDot = document.getElementById('cursorDot');
  var cursorLabel = document.getElementById('cursorLabel');
  var cursorEl = cursorRing && cursorRing.parentNode;

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var cursorOn = false;

  var pointer = { x: -100, y: -100 };
  var ring = { x: -100, y: -100 };
  var cursorRunning = false;

  function writeCursor(el, x, y) {
    el.style.setProperty('--x', x.toFixed(2) + 'px');
    el.style.setProperty('--y', y.toFixed(2) + 'px');
  }

  function cursorFrame() {
    var dx = pointer.x - ring.x;
    var dy = pointer.y - ring.y;

    /* Reduced motion: no trailing, the ring simply sits on the pointer. */
    var ease = reduceMotion ? 1 : CURSOR_EASE;
    ring.x += dx * ease;
    ring.y += dy * ease;

    writeCursor(cursorRing, ring.x, ring.y);

    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      cursorRunning = false;      /* settled — stop burning frames */
      return;
    }
    window.requestAnimationFrame(cursorFrame);
  }

  function startCursorLoop() {
    if (cursorRunning) return;
    cursorRunning = true;
    window.requestAnimationFrame(cursorFrame);
  }

  function onPointerMove(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;

    writeCursor(cursorDot, pointer.x, pointer.y);
    startCursorLoop();

    /* Context: a labelled target wins over a plain link. */
    var labelled = event.target.closest('[data-cursor]');
    var interactive = event.target.closest('a, button, [role="button"]');

    cursorEl.classList.toggle('is-labelled', Boolean(labelled));
    cursorEl.classList.toggle('is-link', Boolean(interactive) && !labelled);
    cursorEl.classList.remove('is-out');

    var text = labelled ? labelled.getAttribute('data-cursor') : '';
    if (cursorLabel.textContent !== text) cursorLabel.textContent = text;
  }

  function enableCursor(on) {
    if (!cursorEl || on === cursorOn) return;
    cursorOn = on;

    document.documentElement.classList.toggle('has-cursor', on);

    if (on) {
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerdown', cursorDown);
      document.addEventListener('pointerup', cursorUp);
      document.addEventListener('mouseleave', cursorOut);
    } else {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerdown', cursorDown);
      document.removeEventListener('pointerup', cursorUp);
      document.removeEventListener('mouseleave', cursorOut);
      cursorEl.classList.remove('is-link', 'is-labelled', 'is-down');
    }
  }

  function cursorDown() { cursorEl.classList.add('is-down'); }
  function cursorUp() { cursorEl.classList.remove('is-down'); }
  function cursorOut() { cursorEl.classList.add('is-out'); }

  if (cursorEl) {
    enableCursor(finePointer.matches);
    finePointer.addEventListener('change', function (event) {
      enableCursor(event.matches);
    });
  }

  /* ---------------------------------------------------------------------------
     08  REEL LIGHTBOX

     Plays reels without shipping ten iframes. On click we build a single
     Instagram embed <iframe> and drop it into the modal; on close we remove the
     node, which stops playback and releases the memory. The cards keep their
     href so middle-click, "open in new tab" and no-JS all still work.
     ------------------------------------------------------------------------ */
  var lightbox = document.getElementById('lightbox');
  var frameWell = document.getElementById('lightboxFrame');
  var lbTitle = document.getElementById('lightboxTitle');
  var lbLink = document.getElementById('lightboxLink');
  var lbClose = document.getElementById('lightboxClose');
  var lastFocused = null;

  function mountEmbed(code, title) {
    var frame = document.createElement('iframe');
    frame.src = 'https://www.instagram.com/reel/' + encodeURIComponent(code) + '/embed/';
    frame.title = title + ' — Instagram';
    frame.loading = 'lazy';
    frame.scrolling = 'no';
    frame.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.addEventListener('load', function () {
      lightbox.classList.add('is-loaded');
    });
    frameWell.appendChild(frame);
  }

  function unmountEmbed() {
    var frame = frameWell.querySelector('iframe');
    if (frame) frame.remove();   // removing the node stops playback
    lightbox.classList.remove('is-loaded');
  }

  function openLightbox(card) {
    var code = card.getAttribute('data-reel');
    var title = card.getAttribute('data-title') || 'Reel';
    if (!code) return;

    lastFocused = document.activeElement;

    lbTitle.textContent = title;
    lbLink.href = card.href;
    lightbox.hidden = false;
    document.body.classList.add('is-locked');
    enableCursor(false);        /* native pointer, so the embed stays usable */

    mountEmbed(code, title);
    lbClose.focus();
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;

    lightbox.hidden = true;
    document.body.classList.remove('is-locked');
    unmountEmbed();
    enableCursor(finePointer.matches);

    if (lastFocused && lastFocused.focus) lastFocused.focus();
    lastFocused = null;
  }

  if (lightbox && frameWell) {
    document.addEventListener('click', function (event) {
      var card = event.target.closest('.card[data-reel]');
      if (!card) return;

      /* Let modified clicks through to the browser's own behaviour. */
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          event.button !== 0) return;

      event.preventDefault();
      openLightbox(card);
    });

    lightbox.addEventListener('click', function (event) {
      if (event.target.closest('[data-lightbox-close]')) closeLightbox();
    });

    /* Keep Tab inside the panel while the dialog is open. */
    lightbox.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab') return;

      var focusable = lightbox.querySelectorAll('button, a[href], iframe');
      if (!focusable.length) return;

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  /* Escape closes whichever overlay is open. */
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;

    if (lightbox && !lightbox.hidden) {
      closeLightbox();
    } else if (menu && !menu.hidden) {
      setMenu(false);
      if (toggle) toggle.focus();
    }
  });

  /* ---------------------------------------------------------------------------
     09  FOOTER YEAR
     ------------------------------------------------------------------------ */
  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
