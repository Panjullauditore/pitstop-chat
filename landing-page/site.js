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
  y: 0
}));

function createStars() {
  const field = map.querySelector('.galaxy-stars');
  const svg = 'http://www.w3.org/2000/svg';
  let seed = 20837;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let cluster = 0; cluster < 5; cluster++) {
    const group = document.createElementNS(svg, 'g');
    group.setAttribute('class', 'star-cluster');
    for (let index = 0; index < 17; index++) {
      const x = 10 + random() * 480;
      const y = 10 + random() * 480;
      const size = .55 + random() * 1.45;
      const bright = index === 0;
      const star = document.createElementNS(svg, bright ? 'path' : 'circle');
      if (bright) {
        star.setAttribute('d', 'M0 -5 1  -1 5 0 1 1 0 5 -1 1 -5 0 -1 -1Z');
        star.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
      } else {
        star.setAttribute('cx', x);
        star.setAttribute('cy', y);
        star.setAttribute('r', size);
      }
      star.setAttribute('opacity', bright ? .95 : .25 + random() * .7);
      group.append(star);
    }
    field.append(group);
  }
}

const turn = 2 * Math.PI;
const angularSpeed = turn / 32000;
let angle = 0;
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
    planet.route.setAttribute('x1', planet.x.toFixed(2));
    planet.route.setAttribute('y1', planet.y.toFixed(2));
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
  const needsFrame = visible && !document.hidden && (moving || pulseStarted !== null);
  if (needsFrame && !frame) frame = requestAnimationFrame(tickOrbit);
  if (!needsFrame && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  }
}

function tickOrbit(time) {
  frame = 0;
  if (isOrbiting() && previousTime) {
    angle = (angle + Math.min(time - previousTime, 48) * angularSpeed) % turn;
    renderOrbit();
  }

  if (pulseStarted !== null) {
    const elapsed = Math.max(0, (time - pulseStarted) / 650);
    const planet = planets.find(item => item.key === map.dataset.active);
    const distance = 1 - Math.min(elapsed, 1);
    signalPacket.setAttribute('cx', 250 + (planet.x - 250) * distance);
    signalPacket.setAttribute('cy', 250 + (planet.y - 250) * distance);
    signalPacket.style.opacity = String(Math.max(0, Math.min(elapsed * 8, distance * 5, 1)));
    if (elapsed >= 1) pulseStarted = null;
  }

  previousTime = isOrbiting() ? time : 0;
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
      angle = (angle + Math.atan2(Math.sin(change), Math.cos(change))) % turn;
      renderOrbit();
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
  pulseStarted = null;
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
