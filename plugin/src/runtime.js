import { animate } from "motion";

(() => {
  const root = document.querySelector('[data-web-presentation]');
  if (!root) return;
  const slides = [...root.querySelectorAll('.wp-slide')];
  if (!slides.length) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const userTransitions = window.webPresentationTransitions || {};
  const IDLE_MS = 260;
  const INTENT_PX = 10;
  const VERSION = '2026.09.26-outline-contrast.1';
  let slideIndex = Math.max(0, slides.findIndex(s => s.classList.contains('is-active')));
  let stateIndex = 0;
  let isAnimating = false;
  let gesture = null;
  let wheelSession = null;
  let wheelTimer = 0;
  let touchSession = null;
  let suppressClickUntil = 0;

  const statesFor = slide => [...slide.querySelectorAll(':scope > .wp-states > .wp-state')];
  const activeState = () => statesFor(slides[slideIndex])[stateIndex];
  const slideTitle = state => {
    const heading = state?.querySelector('[data-slide-title], h1, h2, h3');
    const title = heading?.textContent?.replace(/\s+/g, ' ').trim();
    if (title) return title;
    return (state?.getAttribute('aria-label') || '').replace(/^slide\s+[\d.]+[a-z]?\s*[:—-]?\s*/i, '').trim();
  };
  const extent = axis => axis === 'x' ? root.clientWidth : root.clientHeight;
  const threshold = axis => Math.min(360, Math.max(120, extent(axis) * 0.3));
  const stateLabel = (si = slideIndex, pi = stateIndex) => `${si + 1}${pi ? String.fromCharCode(96 + pi) : ''}`;
  function closePopovers() {
    root.querySelectorAll('[popover]').forEach(el => { try { el.hidePopover?.(); } catch {} });
  }
  function refresh() {
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === slideIndex);
      slide.setAttribute('aria-hidden', String(i !== slideIndex));
      statesFor(slide).forEach((state, j) => {
        const on = i === slideIndex && j === stateIndex;
        state.classList.toggle('is-active', on);
        state.setAttribute('aria-hidden', String(!on));
        state.inert = !on;
      });
    });
    const current = stateLabel();
    const label = root.querySelector('[data-wp-current]');
    const total = root.querySelector('[data-wp-total]');
    const progress = root.querySelector('[data-wp-progress]');
    const status = root.querySelector('[data-wp-status]');
    const states = statesFor(slides[slideIndex]);
    const subcontrols = root.querySelector('[data-wp-subcontrols]');
    const subCurrent = root.querySelector('[data-wp-sub-current]');
    const subTotal = root.querySelector('[data-wp-sub-total]');
    const subPrevious = root.querySelector('[data-wp-sub-prev]');
    const subNext = root.querySelector('[data-wp-sub-next]');
    if (label) label.textContent = current;
    if (total) total.textContent = String(slides.length);
    if (subcontrols) subcontrols.hidden = states.length < 2;
    if (subCurrent) subCurrent.textContent = String(stateIndex + 1);
    if (subTotal) subTotal.textContent = String(states.length);
    if (subPrevious) subPrevious.disabled = stateIndex === 0;
    if (subNext) subNext.disabled = stateIndex === states.length - 1;
    if (progress) progress.style.width = `${(slideIndex + 1) / slides.length * 100}%`;
    if (status) status.textContent = `Slide ${current} of ${slides.length}`;
    root.querySelectorAll('[data-wp-persistent]').forEach(el => {
      const targets = (el.dataset.showOn || 'all').split(/[ ,]+/).filter(Boolean);
      const visible = targets.includes('all') || targets.includes(current);
      el.setAttribute('aria-hidden', String(!visible));
      el.style.opacity = visible ? '1' : '0';
    });
    const previous = root.querySelector('[data-wp-prev]');
    const next = root.querySelector('[data-wp-next]');
    if (previous) previous.disabled = slideIndex === 0;
    if (next) next.disabled = slideIndex === slides.length - 1;
    applyControlsTone();
    buildOutline();
    document.title = `${current} · ${root.dataset.title || 'Presentation'}`;
  }
  function toneHint(element) {
    for (let el = element; el && root.contains(el); el = el.parentElement) {
      const value = el.dataset.wpControlsTone;
      if (value === 'dark' || value === 'light') return value;
      if (el === root) break;
    }
    return '';
  }
  function opaqueColor(element) {
    const value = getComputedStyle(element).backgroundColor;
    const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i);
    if (!match) return null;
    const alpha = match[4] ? parseFloat(match[4]) / (match[4].includes('%') ? 100 : 1) : 1;
    if (alpha < 0.96) return null;
    const rgb = match.slice(1, 4).map(Number);
    const linear = rgb.map(channel => { const c = channel / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }
  function applyControlsTone() {
    const controls = root.querySelector('[data-wp-controls]');
    if (!controls) return;
    const hint = toneHint(activeState());
    if (hint) { controls.dataset.controlsTone = hint; return; }
    // Sample the visible stage so large state or slide backgrounds can override the deck theme.
    const bounds = root.getBoundingClientRect();
    const luminance = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) {
      const x = bounds.left + bounds.width * (col + 0.5) / 7;
      const y = bounds.top + bounds.height * (row + 0.5) / 5;
      const hit = document.elementFromPoint(x, y);
      if (!(hit instanceof Element) || controls.contains(hit)) continue;
      for (let el = hit; el && root.contains(el); el = el.parentElement) {
        const value = opaqueColor(el);
        if (value !== null) { luminance.push(value); break; }
        if (el === activeState() || el === root) break;
      }
    }
    const fallback = opaqueColor(activeState()) ?? opaqueColor(slides[slideIndex]) ?? opaqueColor(root) ?? 0.12;
    const average = luminance.length ? luminance.reduce((sum, value) => sum + value, 0) / luminance.length : fallback;
    controls.dataset.controlsTone = average < 0.42 ? 'dark' : 'light';
  }
  function buildOutline() {
    const outline = root.querySelector('[data-wp-outline]');
    if (!outline) return;
    outline.replaceChildren();
    slides.forEach((slide, i) => {
      const states = statesFor(slide);
      states.forEach((state, j) => {
        const label = `${i + 1}${j ? String.fromCharCode(96 + j) : ''}`;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `wp-outline-item${j ? ' is-subslide' : ''}`;
        button.dataset.wpOutlineSlide = String(i);
        button.dataset.wpOutlineState = String(j);
        button.setAttribute('aria-current', String(i === slideIndex && j === stateIndex));
        const number = document.createElement('span');
        number.className = 'wp-outline-number';
        number.textContent = label;
        const title = document.createElement('span');
        title.className = 'wp-outline-title';
        title.textContent = slideTitle(state) || (j ? `Sub-slide ${label}` : `Slide ${i + 1}`);
        button.append(number, title);
        button.addEventListener('click', () => { closeOutline(); goTo(i, j); });
        outline.append(button);
      });
    });
  }
  const outline = root.querySelector('[data-wp-outline]');
  const outlineToggle = root.querySelector('[data-wp-outline-toggle]');
  function closeOutline() {
    if (!outline || !outlineToggle) return;
    outline.hidden = true;
    outlineToggle.setAttribute('aria-expanded', 'false');
  }
  function toggleOutline() {
    if (!outline || !outlineToggle) return;
    buildOutline();
    outline.hidden = !outline.hidden;
    outlineToggle.setAttribute('aria-expanded', String(!outline.hidden));
    if (!outline.hidden) outline.querySelector('[aria-current="true"]')?.focus();
  }
  outlineToggle?.addEventListener('click', toggleOutline);
  document.addEventListener('pointerdown', event => {
    if (!root.contains(event.target) || !(event.target instanceof Element) || !event.target.closest('.wp-outline-wrap')) closeOutline();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && outline && !outline.hidden) { closeOutline(); outlineToggle?.focus(); } });
  function alignPanels() {
    slides.forEach((slide, i) => {
      slide.hidden = i !== slideIndex;
      slide.classList.remove('is-preparing', 'is-transitioning');
      slide.style.transform = '';
      slide.style.opacity = '';
      const panel = slide.querySelector('.wp-states');
      if (panel) panel.style.transform = `translateX(${i === slideIndex ? -stateIndex * 100 : 0}vw)`;
    });
  }
  function targetFor(axis, direction) {
    if (axis === 'y') {
      const slide = slideIndex + direction;
      return slide >= 0 && slide < slides.length ? { slide, state: 0 } : null;
    }
    const state = stateIndex + direction;
    return state >= 0 && state < statesFor(slides[slideIndex]).length ? { slide: slideIndex, state } : null;
  }
  function canScroll(el, axis, direction) {
    const max = axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
    const position = axis === 'y' ? el.scrollTop : el.scrollLeft;
    return max > 2 && (direction > 0 ? position < max - 1 : position > 1);
  }
  function contentCanScroll(target, axis, direction) {
    const state = activeState();
    let el = target instanceof Element ? target : state;
    if (!state?.contains(el)) el = state;
    while (el && state?.contains(el)) {
      const style = getComputedStyle(el);
      const overflow = axis === 'y' ? style.overflowY : style.overflowX;
      if (/(auto|scroll|overlay)/.test(overflow) && canScroll(el, axis, direction)) return true;
      if (el === state) break;
      el = el.parentElement;
    }
    return false;
  }
  function nativeControl(target) {
    return target instanceof Element && !!target.closest('input,textarea,select,video,audio,[contenteditable="true"],[data-wp-native-scroll],[data-wp-controls]');
  }
  function contextFor(g) {
    return {
      from: g.from, to: g.to, axis: g.axis, direction: g.direction,
      kind: g.axis === 'x' ? 'state' : 'slide', name: 'scroll', input: g.input,
      fromLabel: stateLabel(g.fromSlide, g.fromState), toLabel: stateLabel(g.toSlide, g.toState)
    };
  }
  // Shared elements follow the same progress as the panels, including a canceled drag.
  function sharedElements(g) {
    if (reduceMotion.matches) return [];
    const targets = [...g.to.querySelectorAll('[data-magic-move]')];
    return [...g.from.querySelectorAll('[data-magic-move]')].flatMap(source => {
      const target = targets.find(el => el.dataset.magicMove === source.dataset.magicMove);
      if (!target) return [];
      const a = source.getBoundingClientRect(), b = target.getBoundingClientRect();
      const end = { left: b.left - (g.axis === 'x' ? (g.toState - g.fromState) * extent('x') : 0), top: b.top, width: b.width, height: b.height };
      const clone = source.cloneNode(true);
      clone.removeAttribute('id'); clone.removeAttribute('data-magic-move');
      clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      clone.inert = true; clone.setAttribute('aria-hidden', 'true'); clone.dataset.wpMagicClone = '';
      Object.assign(clone.style, { position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: '0', zIndex: '9998', pointerEvents: 'none', transformOrigin: 'top left' });
      root.append(clone);
      const item = { source, target, clone, a, b: end, sourceVisibility: source.style.visibility, targetVisibility: target.style.visibility };
      source.style.visibility = target.style.visibility = 'hidden';
      return [item];
    });
  }
  function clearShared(g) {
    for (const item of g.shared) {
      item.clone.remove(); item.source.style.visibility = item.sourceVisibility; item.target.style.visibility = item.targetVisibility;
    }
  }
  function beginGesture(axis, direction, target, input) {
    const fromSlide = slides[slideIndex], toSlide = slides[target.slide];
    const g = { axis, direction, input, fromSlide: slideIndex, fromState: stateIndex, toSlide: target.slide, toState: target.state, from: activeState(), to: statesFor(toSlide)[target.state], progress: 0, distance: 0, shared: [], settling: null, animation: null };
    closePopovers();
    fromSlide.classList.add('is-transitioning'); toSlide.classList.add('is-preparing'); toSlide.hidden = false;
    if (axis === 'y') toSlide.querySelector('.wp-states').style.transform = `translateX(${-target.state * 100}vw)`;
    g.shared = sharedElements(g);
    gesture = g;
    root.dispatchEvent(new CustomEvent('webpresentation:beforechange', { detail: contextFor(g) }));
    renderGesture(g, 0);
    return g;
  }
  function renderGesture(g, p) {
    g.progress = p;
    const size = extent(g.axis);
    if (g.axis === 'y') {
      slides[g.fromSlide].style.transform = `translate3d(0, ${-g.direction * p * size}px, 0)`;
      slides[g.toSlide].style.transform = `translate3d(0, ${g.direction * (1 - p) * size}px, 0)`;
    } else {
      slides[g.fromSlide].querySelector('.wp-states').style.transform = `translate3d(${-g.fromState * size - (g.toState - g.fromState) * p * size}px, 0, 0)`;
    }
    for (const item of g.shared) {
      for (const key of ['left', 'top', 'width', 'height']) item.clone.style[key] = `${item.a[key] + (item.b[key] - item.a[key]) * p}px`;
    }
  }
  function disposeGesture(g, commit) {
    clearShared(g);
    if (commit) { slideIndex = g.toSlide; stateIndex = g.toState; }
    alignPanels(); refresh();
    if (gesture === g) gesture = null;
    if (commit) root.dispatchEvent(new CustomEvent('webpresentation:change', { detail: { ...contextFor(g), slideIndex, stateIndex, label: stateLabel() } }));
  }
  function finishGesture(commit, duration = 0.3) {
    const g = gesture;
    if (!g) return Promise.resolve();
    if (g.settling) return g.settling;
    isAnimating = true;
    g.settling = (async () => {
      try {
        if (reduceMotion.matches || duration === 0) renderGesture(g, commit ? 1 : 0);
        else {
          g.animation = animate(g.progress, commit ? 1 : 0, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: p => renderGesture(g, p) });
          await g.animation.finished;
        }
      } finally { disposeGesture(g, commit); isAnimating = false; }
    })();
    return g.settling;
  }
  function moveGesture(g, distance) {
    // Signed distance lets a reversal undo the preview instead of advancing a slide.
    g.distance = distance;
    renderGesture(g, Math.max(0, Math.min(1, distance / extent(g.axis))));
  }
  function markWheelConsumed() {
    clearTimeout(wheelTimer);
    if (wheelSession) wheelSession.owner = 'consumed';
  }
  async function goTo(targetSlide, targetState = 0, direction, options = {}) {
    if (isAnimating || !Number.isFinite(targetSlide) || !Number.isFinite(targetState)) return;
    markWheelConsumed();
    if (gesture) await finishGesture(false, 0.16);
    if (isAnimating) return;
    targetSlide = Math.max(0, Math.min(slides.length - 1, Math.trunc(targetSlide)));
    targetState = Math.max(0, Math.min(statesFor(slides[targetSlide]).length - 1, Math.trunc(targetState)));
    if (targetSlide === slideIndex && targetState === stateIndex) return;
    const axis = targetSlide === slideIndex ? 'x' : 'y';
    direction = direction ?? Math.sign(axis === 'x' ? targetState - stateIndex : targetSlide - slideIndex);
    const name = options.transition || slides[targetSlide].dataset.transition || 'scroll';
    const raw = Number(slides[targetSlide].dataset.duration);
    const duration = reduceMotion.matches ? 0 : Number.isFinite(raw) && raw >= 0 ? raw : 0.45;
    const g = beginGesture(axis, direction, { slide: targetSlide, state: targetState }, 'command');
    if (name === 'scroll' || name === 'slide' || (!['fade', 'zoom'].includes(name) && typeof userTransitions[name] !== 'function')) {
      await finishGesture(true, duration); return;
    }
    // Explicit effects apply only to buttons/keys/API. Wheel and touch always scroll.
    isAnimating = true;
    try {
      clearShared(g); g.shared = [];
      slides[g.fromSlide].style.transform = slides[g.toSlide].style.transform = '';
      if (typeof userTransitions[name] === 'function') {
        await userTransitions[name]({ ...contextFor(g), name, duration, animate, reducedMotion: reduceMotion.matches });
      } else {
        const from = axis === 'y' ? slides[g.fromSlide] : g.from;
        const to = axis === 'y' ? slides[g.toSlide] : g.to;
        const offset = axis === 'x' ? -(targetState - stateIndex) * extent('x') : 0;
        if (axis === 'x') to.style.transform = `translateX(${offset}px)`;
        try { await Promise.all([
          animate(from, name === 'zoom' ? { opacity: [1, 0], scale: [1, 0.96] } : { opacity: [1, 0] }, { duration }).finished,
          animate(to, name === 'zoom' ? { opacity: [0, 1], scale: [0.96, 1] } : { opacity: [0, 1] }, { duration }).finished
        ]); } finally { from.style.opacity = to.style.opacity = ''; from.style.transform = to.style.transform = ''; }
      }
    } finally { disposeGesture(g, true); isAnimating = false; }
  }
  const nextSlide = () => slideIndex < slides.length - 1 ? goTo(slideIndex + 1, 0, 1) : undefined;
  const previousSlide = () => slideIndex > 0 ? goTo(slideIndex - 1, 0, -1) : undefined;
  const nextState = () => stateIndex < statesFor(slides[slideIndex]).length - 1 ? goTo(slideIndex, stateIndex + 1, 1) : undefined;
  const previousState = () => stateIndex > 0 ? goTo(slideIndex, stateIndex - 1, -1) : undefined;

  function wheelPixels(event) {
    const line = parseFloat(getComputedStyle(activeState()).lineHeight) || 20;
    return { x: event.deltaX * (event.deltaMode === 1 ? line : event.deltaMode === 2 ? extent('x') : 1), y: event.deltaY * (event.deltaMode === 1 ? line : event.deltaMode === 2 ? extent('y') : 1) };
  }
  function onWheel(event) {
    if (event.ctrlKey || event.metaKey || nativeControl(event.target)) return;
    const d = wheelPixels(event);
    if (!d.x && !d.y) return;
    const now = performance.now();
    if (!wheelSession || now - wheelSession.last > IDLE_MS && !gesture) wheelSession = { last: now, x: 0, y: 0, axis: null, owner: 'pending', target: event.target };
    const session = wheelSession; session.last = now;
    if (isAnimating || touchSession) session.owner = 'consumed';
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      if (wheelSession !== session) return;
      if (session.owner === 'slides' && gesture?.input === 'wheel') {
        session.owner = 'consumed';
        finishGesture(gesture.distance >= threshold(gesture.axis));
      }
    }, IDLE_MS);
    if (session.owner === 'content') return;
    if (session.owner === 'consumed') { event.preventDefault(); return; }
    session.x += d.x; session.y += d.y;
    if (!session.axis) {
      const axis = Math.abs(session.x) > Math.abs(session.y) * 1.15 ? 'x' : 'y';
      const amount = axis === 'x' ? session.x : session.y;
      if (contentCanScroll(session.target, axis, Math.sign(amount))) { session.owner = 'content'; return; }
      event.preventDefault();
      if (Math.max(Math.abs(session.x), Math.abs(session.y)) < INTENT_PX) return;
      session.axis = axis; session.direction = Math.sign(amount);
      const target = targetFor(axis, session.direction);
      if (!target) { session.owner = 'consumed'; return; }
      session.owner = 'slides'; beginGesture(axis, session.direction, target, 'wheel');
    } else event.preventDefault();
    if (gesture && !gesture.settling) moveGesture(gesture, (session.axis === 'x' ? session.x : session.y) * session.direction);
  }
  root.addEventListener('wheel', onWheel, { passive: false });

  root.addEventListener('touchstart', event => {
    markWheelConsumed();
    if (gesture && !isAnimating) finishGesture(false);
    if (event.touches.length !== 1 || isAnimating || nativeControl(event.target)) {
      touchSession = { owner: 'content' }; return;
    }
    const touch = event.touches[0];
    touchSession = { id: touch.identifier, x: touch.clientX, y: touch.clientY, target: event.target, owner: 'pending', axis: null };
  }, { passive: true });
  root.addEventListener('touchmove', event => {
    const session = touchSession;
    if (!session || session.owner === 'content') return;
    if (event.touches.length !== 1 || !event.cancelable) {
      session.owner = 'content'; if (gesture?.input === 'touch') finishGesture(false); return;
    }
    const touch = [...event.touches].find(t => t.identifier === session.id);
    if (!touch) return;
    const dx = session.x - touch.clientX, dy = session.y - touch.clientY;
    if (!session.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < INTENT_PX) return;
      session.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y';
      session.direction = Math.sign(session.axis === 'x' ? dx : dy);
      if (contentCanScroll(session.target, session.axis, session.direction)) { session.owner = 'content'; return; }
      const target = targetFor(session.axis, session.direction);
      if (!target) { session.owner = 'blocked'; event.preventDefault(); return; }
      session.owner = 'slides'; beginGesture(session.axis, session.direction, target, 'touch');
    }
    event.preventDefault();
    if (session.owner === 'slides' && gesture && !gesture.settling) moveGesture(gesture, (session.axis === 'x' ? dx : dy) * session.direction);
  }, { passive: false });
  function endTouch(event, canceled) {
    if (!touchSession) return;
    const session = touchSession; touchSession = null;
    if (gesture?.input === 'touch' && !gesture.settling) {
      suppressClickUntil = performance.now() + 400;
      finishGesture(!canceled && session.owner === 'slides' && gesture.distance >= threshold(gesture.axis));
    }
  }
  root.addEventListener('touchend', event => endTouch(event, false), { passive: true });
  root.addEventListener('touchcancel', event => endTouch(event, true), { passive: true });
  root.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }, true);

  function scrollContent(direction, target) {
    if (contentCanScroll(target, 'y', direction)) {
      // Let a focused nested scroller handle its own arrows; scroll the state otherwise.
      if (target instanceof Element && target !== document.body && target !== root && activeState().contains(target)) {
        let el = target;
        while (el && el !== activeState()) {
          if (/(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY) && canScroll(el, 'y', direction)) { el.scrollBy({ top: direction * Math.max(160, el.clientHeight * 0.72), behavior: reduceMotion.matches ? 'instant' : 'smooth' }); return true; }
          el = el.parentElement;
        }
      }
      activeState().scrollBy({ top: direction * Math.max(160, activeState().clientHeight * 0.72), behavior: reduceMotion.matches ? 'instant' : 'smooth' });
      return true;
    }
    return false;
  }
  document.addEventListener('keydown', event => {
    if (nativeControl(event.target) || event.target instanceof Element && event.target.closest('button,a,summary') || event.altKey || event.ctrlKey || event.metaKey) return;
    const actions = { ArrowDown: nextSlide, PageDown: nextSlide, ' ': nextSlide, ArrowUp: previousSlide, PageUp: previousSlide, ArrowRight: nextState, ArrowLeft: previousState };
    const vertical = ['ArrowDown', 'PageDown', ' '].includes(event.key) ? 1 : ['ArrowUp', 'PageUp'].includes(event.key) ? -1 : 0;
    if (vertical && scrollContent(vertical, event.target)) { event.preventDefault(); return; }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      let el = event.target instanceof Element ? event.target : null;
      while (el && activeState().contains(el)) {
        if (/(auto|scroll|overlay)/.test(getComputedStyle(el).overflowX) && canScroll(el, 'x', direction)) {
          event.preventDefault();
          el.scrollBy({ left: direction * Math.max(120, el.clientWidth * 0.72), behavior: reduceMotion.matches ? 'instant' : 'smooth' });
          return;
        }
        if (el === activeState()) break;
        el = el.parentElement;
      }
    }
    if (actions[event.key]) { event.preventDefault(); if (!event.repeat) actions[event.key](); }
    if (event.key === 'Home') { event.preventDefault(); goTo(0, 0); }
    if (event.key === 'End') { event.preventDefault(); goTo(slides.length - 1, statesFor(slides.at(-1)).length - 1); }
  });
  root.querySelector('[data-wp-prev]')?.addEventListener('click', previousSlide);
  root.querySelector('[data-wp-next]')?.addEventListener('click', nextSlide);
  root.querySelector('[data-wp-sub-prev]')?.addEventListener('click', previousState);
  root.querySelector('[data-wp-sub-next]')?.addEventListener('click', nextState);
  root.querySelector('[data-wp-fullscreen]')?.addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen?.());
  window.addEventListener('resize', () => {
    if (gesture && !isAnimating && !gesture.settling) { markWheelConsumed(); touchSession = null; finishGesture(false, 0); }
    else if (!isAnimating) alignPanels();
  });
  window.WebPresentations = {
    version: VERSION, next: nextSlide, previous: previousSlide, nextSubslide: nextState, previousSubslide: previousState,
    goTo(slideNumber, subslideLetter = '') { return goTo(Number(slideNumber) - 1, subslideLetter ? subslideLetter.toLowerCase().charCodeAt(0) - 96 : 0); },
    getState: () => ({ slide: slideIndex + 1, subslide: stateIndex ? String.fromCharCode(96 + stateIndex) : '', label: stateLabel() }), animate
  };
  alignPanels(); refresh();
})();
