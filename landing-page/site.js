const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionEase = 'cubic-bezier(.16, 1, .3, 1)';

function reveal(element, duration, delay = 0) {
  if (reducedMotion.matches) return;

  element.getAnimations().forEach(animation => animation.cancel());
  element.animate([
    { opacity: .6, transform: 'translateY(6px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ], { duration, delay, easing: motionEase, fill: 'backwards' });
}

function enableScrollReveals() {
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(entries => {
    for (const { isIntersecting, target } of entries) {
      if (!isIntersecting) continue;
      observer.unobserve(target);
      target.classList.add('is-revealed');
      if (reducedMotion.matches) continue;

      target.animate([
        { opacity: 0, transform: 'translateY(18px)', clipPath: 'inset(0 0 35% 0)' },
        { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }
      ], { duration: target.tagName === 'H1' ? 760 : 610, easing: motionEase });
    }
  }, { threshold: .18 });

  document.querySelectorAll('[data-scroll-reveal]').forEach(element => observer.observe(element));
  document.documentElement.classList.add('reveal-ready');
}

function enableReadingProgress() {
  const bar = document.querySelector('.reading-progress');
  let pending = false;
  const update = () => {
    pending = false;
    const page = document.documentElement;
    const range = Math.max(page.scrollHeight - page.clientHeight, 1);
    bar.style.setProperty('--reading-progress', String(Math.min(1, Math.max(0, window.scrollY / range))));
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.body);
  schedule();
}

enableScrollReveals();
enableReadingProgress();

const steps = [...document.querySelectorAll('[data-step]')];
const room = document.querySelector('#room-body');
const scenes = [
  {
    messages: [['You','Y','owner','Let’s plan the first version of our product site. Visitors should understand what we do and see an example before they leave.']],
    note: 'Next: invite the agents you want in this session.'
  },
  {
    messages: [['Planning agent','P','','Start with a short introduction, then show one project from brief to decision.'],['Research agent','R','research','Use a sample conversation so visitors can see what each agent contributes.'],['You','Y','owner','Agreed. Let’s use one example and keep the page focused on the product.']],
    note: 'The team has a direction. Save it so the next session can use it.'
  },
  {
    messages: [['You','Y','owner','Let’s save that as our scope for the first release.']],
    note: 'Project Memory: First release = a product introduction and one interactive sample conversation.',
    saved: true
  }
];
function showScene(index) {
  const scene = scenes[index];
  if (!scene) return;
  steps.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  const nodes = scene.messages.map(([name, initial, style, message]) => {
    const item = document.createElement('div');
    item.className = 'message';
    const badge = document.createElement('span');
    badge.className = 'initial ' + style;
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = initial;
    const copy = document.createElement('div');
    const author = document.createElement('strong');
    const body = document.createElement('p');
    author.textContent = name;
    body.textContent = message;
    copy.append(author, body);
    item.append(badge, copy);
    return item;
  });
  const note = document.createElement('div');
  note.className = scene.saved ? 'room-note saved' : 'room-note';
  note.textContent = scene.note;
  room.replaceChildren(...nodes, note);
  nodes.forEach((node, index) => reveal(node, 260, index * 55));
  reveal(note, 280, nodes.length * 55);
}
steps.forEach((button, i) => button.addEventListener('click', () => showScene(i)));


const map = document.querySelector('#collaboration-map');
const mapCaption = document.querySelector('#map-description');
const orbitToggle = document.querySelector('#orbit-toggle');
const orbitGuide = map.querySelector('.orbit-guide');
const logo = map.querySelector('.orbit-logo');
const signalPacket = map.querySelector('.signal-packet');
const mapCopy = {
  you: ['Set the direction.', 'Give your agents a shared goal and decide what moves forward.'],
  agents: ['Hear different perspectives.', 'Choose which connected agents join the conversation and who should reply.'],
  memory: ['Carry the decision forward.', 'Save key decisions to Project Memory so the next session has context.']
};
const planets = [...map.querySelectorAll('[data-map]')].map((button, index) => ({
  button,
  key: button.dataset.map,
  route: map.querySelector('.route-' + button.dataset.map),
  offset: -Math.PI / 2 - index * 2 * Math.PI / 3,
  x: 0,
  y: 0,
  curveX: 250,
  curveY: 250
}));

function createStars() {
  const field = map.querySelector('.galaxy-stars');
  const svg = 'http://www.w3.org/2000/svg';
  const colors = ['#d9ecff', '#75ddff', '#b7c7ff', '#fff1d8', '#a5c7f4', '#d7e4ff', '#84d6ea'];

  function respawn(star, sparkle) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = 242 * Math.sqrt(Math.random());
    const x = 250 + distance * Math.cos(angle);
    const y = 250 + distance * Math.sin(angle);
    if (sparkle) {
      const scale = .65 + Math.random() * .5;
      star.setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + scale + ')');
    } else {
      star.setAttribute('cx', x);
      star.setAttribute('cy', y);
      star.setAttribute('r', .55 + Math.random() * 1.55);
    }
    star.setAttribute('opacity', sparkle ? .95 : .37 + Math.random() * .63);
  }

  colors.forEach((color, index) => {
    const cluster = document.createElementNS(svg, 'g');
    cluster.setAttribute('class', 'star-cluster');
    const duration = 4 + Math.random() * 3.8;
    cluster.style.fill = color;
    cluster.style.animationDuration = duration + 's';
    cluster.style.animationDelay = -(duration * ((index + .5) / colors.length)) + 's';

    for (let point = 0; point < 16; point++) {
      const sparkle = point === 0;
      const star = document.createElementNS(svg, sparkle ? 'path' : 'circle');
      if (sparkle) star.setAttribute('d', 'M0 -5 1 -1 5 0 1 1 0 5 -1 1 -5 0 -1 -1Z');
      respawn(star, sparkle);
      cluster.append(star);
    }

    // Each cluster moves to new positions only at its invisible animation boundary.
    cluster.addEventListener('animationiteration', () => {
      [...cluster.children].forEach((star, point) => respawn(star, point === 0));
    });
    field.append(cluster);
  });
}


const turn = 2 * Math.PI;
const angularSpeed = turn / 32000;
let angle = 0;
let flex = 0;
let size = 0;
let radiusX = 0;
let radiusY = 0;
let visible = !('IntersectionObserver' in window);
let paused = reducedMotion.matches;
let keyboardFocus = false;
let frame = 0;
let previousTime = 0;
let pulseStarted = null;
let drag;
let skipClick;

function renderOrbit() {
  if (!size) return;

  logo.style.rotate = angle + 'rad';
  for (const planet of planets) {
    const position = angle + planet.offset;
    const x = Math.cos(position) * radiusX;
    const y = Math.sin(position) * radiusY;
    planet.button.style.translate = x.toFixed(2) + 'px ' + y.toFixed(2) + 'px';
    planet.x = 250 + 500 * x / size;
    planet.y = 250 + 500 * y / size;
    const dx = planet.x - 250;
    const dy = planet.y - 250;
    const bend = .47 + .085 * Math.sin(position * 2) + flex * .43;
    planet.curveX = 250 + dx * .43 - dy * bend;
    planet.curveY = 250 + dy * .43 + dx * bend;
    planet.route.setAttribute('d',
      'M' + planet.x.toFixed(2) + ' ' + planet.y.toFixed(2) +
      ' Q' + planet.curveX.toFixed(2) + ' ' + planet.curveY.toFixed(2) + ' 250 250'
    );
  }
}

function measureOrbit() {
  size = map.clientWidth;
  if (!size) return;
  const labelWidth = Math.max(...planets.map(({ button }) => button.offsetWidth));
  radiusX = Math.max(24, Math.min(size * .39, (size - labelWidth) / 2 - 5));
  radiusY = size * .37;
  orbitGuide.setAttribute('rx', 500 * radiusX / size);
  orbitGuide.setAttribute('ry', 500 * radiusY / size);
  renderOrbit();
}

function isOrbiting() {
  return visible && !document.hidden && !paused && !drag && !keyboardFocus;
}

function syncOrbit() {
  const moving = isOrbiting();
  map.toggleAttribute('data-orbit-running', moving);
  const needsFrame = visible && !document.hidden && (moving || pulseStarted !== null || flex !== 0);
  if (needsFrame && !frame) frame = requestAnimationFrame(tickOrbit);
  if (!needsFrame) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  }
}

function tickOrbit(time) {
  frame = 0;
  const elapsedTime = previousTime ? Math.min(time - previousTime, 48) : 0;
  const moving = isOrbiting();
  if (moving) angle = (angle + elapsedTime * angularSpeed) % turn;
  if (moving || flex !== 0) {
    flex *= Math.exp(-elapsedTime / 260);
    if (Math.abs(flex) < .002) flex = 0;
    renderOrbit();
  }

  if (pulseStarted !== null) {
    const elapsed = Math.max(0, (time - pulseStarted) / 650);
    const planet = planets.find(item => item.key === map.dataset.active);
    const progress = Math.min(elapsed, 1);
    const remaining = 1 - progress;
    const curveWeight = 2 * remaining * progress;
    signalPacket.setAttribute('cx', planet.x * remaining ** 2 + planet.curveX * curveWeight + 250 * progress ** 2);
    signalPacket.setAttribute('cy', planet.y * remaining ** 2 + planet.curveY * curveWeight + 250 * progress ** 2);
    signalPacket.style.opacity = String(Math.min(progress * 8, remaining * 5, 1));
    if (elapsed >= 1) pulseStarted = null;
  }

  previousTime = time;
  syncOrbit();
}

function updateOrbitControl() {
  orbitToggle.querySelector('.orbit-toggle-text').textContent = paused ? 'Play orbit' : 'Pause orbit';
  orbitToggle.dataset.paused = String(paused);
  if (paused) previousTime = 0;
  syncOrbit();
}

function selectPlanet(planet) {
  map.dataset.active = planet.key;
  for (const item of planets) item.button.setAttribute('aria-pressed', String(item === planet));
  const [heading, body] = mapCopy[planet.key];
  mapCaption.querySelector('strong').textContent = heading;
  mapCaption.querySelector('span').textContent = body;
  if (!reducedMotion.matches) pulseStarted = performance.now();
  reveal(mapCaption, 230);
  syncOrbit();
}

function angleAt(event, bounds) {
  const x = (event.clientX - bounds.left - bounds.width / 2) / radiusX;
  const y = (event.clientY - bounds.top - bounds.height / 2) / radiusY;
  return Math.hypot(x, y) < .18 ? null : Math.atan2(y, x);
}

function releasePlanet(event, activate) {
  if (!drag || drag.id !== event.pointerId) return;
  const { planet, moved } = drag;
  drag = undefined;
  if (planet.button.hasPointerCapture(event.pointerId)) planet.button.releasePointerCapture(event.pointerId);
  delete planet.button.dataset.dragging;
  if (moved) {
    skipClick = planet.button;
    if (activate) selectPlanet(planet);
  }
  syncOrbit();
}

for (const planet of planets) {
  const { button } = planet;
  button.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    skipClick = undefined;
    const bounds = map.getBoundingClientRect();
    drag = { planet, id: event.pointerId, bounds, x: event.clientX, y: event.clientY,
      lastAngle: angleAt(event, bounds), moved: false };
    button.setPointerCapture(event.pointerId);
    previousTime = 0;
    syncOrbit();
  });

  button.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
    drag.moved = true;
    button.dataset.dragging = '';
    const next = angleAt(event, drag.bounds);
    if (next === null) return;
    if (drag.lastAngle !== null) {
      const change = next - drag.lastAngle;
      const step = Math.atan2(Math.sin(change), Math.cos(change));
      angle = (angle + step) % turn;
      if (!reducedMotion.matches) flex = Math.max(-.6, Math.min(.6, flex + step * 1.8));
      renderOrbit();
      syncOrbit();
    }
    drag.lastAngle = next;
  });

  button.addEventListener('pointerup', event => releasePlanet(event, true));
  button.addEventListener('pointercancel', event => releasePlanet(event, false));
  button.addEventListener('lostpointercapture', event => releasePlanet(event, false));
  button.addEventListener('click', event => {
    if (event.detail && skipClick === button) {
      skipClick = undefined;
      return;
    }
    selectPlanet(planet);
  });
  button.addEventListener('focus', () => {
    keyboardFocus = button.matches(':focus-visible');
    syncOrbit();
  });
  button.addEventListener('blur', () => {
    keyboardFocus = false;
    syncOrbit();
  });
}

orbitToggle.addEventListener('click', () => {
  paused = !paused;
  updateOrbitControl();
});

reducedMotion.addEventListener('change', event => {
  if (!event.matches) return;
  paused = true;
  flex = 0;
  pulseStarted = null;
  renderOrbit();
  signalPacket.style.opacity = '0';
  document.getAnimations().forEach(animation => {
    if (animation instanceof CSSAnimation) return;
    animation.cancel();
  });
  updateOrbitControl();
});

createStars();
measureOrbit();
map.classList.add('orbit-ready');
orbitToggle.hidden = false;
updateOrbitControl();

if ('ResizeObserver' in window) new ResizeObserver(measureOrbit).observe(map);
else window.addEventListener('resize', measureOrbit);
if ('IntersectionObserver' in window) {
  const orbitObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncOrbit();
  });
  orbitObserver.observe(map);
}
document.addEventListener('visibilitychange', syncOrbit);

const memoryBoard = document.querySelector('#memory-example');
const memoryButtons = [...document.querySelectorAll('[data-memory]')];
const memoryExamples = {
  project: ['Project Memory', 'Website launch', 'First release: introduce Pitstop and show a sample agent conversation.', 'Available to future sessions in this project.'],
  soul: ['Soul Memory', 'Your communication preferences', 'Lead with the recommendation and list open questions at the end.', 'Applies across projects.']
};
memoryButtons.forEach(button => {
  button.addEventListener('click', () => {
    const kind = button.dataset.memory;
    memoryBoard.dataset.kind = kind;
    memoryButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    const [label, scope, entry, context] = memoryExamples[kind];
    memoryBoard.querySelector('.memory-label strong').textContent = label;
    memoryBoard.querySelector('.memory-scope').textContent = scope;
    memoryBoard.querySelector('.memory-entry').textContent = entry;
    memoryBoard.querySelector('.memory-context').textContent = context;
    reveal(memoryBoard.querySelector('.memory-card'), 260);
  });
});
