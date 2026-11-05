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
const mapButtons = [...document.querySelectorAll('[data-map]')];
const signalTrace = map.querySelector('.signal-trace');
const signalPacket = map.querySelector('.signal-packet');
const logo = map.querySelector('img');
let signalAnimations = [];

const spinButton = map.querySelector('.logo-spin');
const tether = map.querySelector('.drag-tether');
let logoSpin;

function spinLogo(fromClick = false) {
  logoSpin?.cancel();
  if (reducedMotion.matches) {
    if (fromClick) logo.style.rotate = logo.style.rotate ? '' : '90deg';
    return;
  }
  logo.style.rotate = '';
  logoSpin = logo.animate(
    [{ rotate: '0deg' }, { rotate: '360deg' }],
    { duration: fromClick ? 1100 : 1650, easing: motionEase }
  );
}

spinButton.addEventListener('click', () => spinLogo(true));

function sendSignal(choice) {
  signalAnimations.forEach(animation => animation.cancel());
  signalAnimations = [];
  if (reducedMotion.matches) return;

  const route = document.getElementById('route-' + choice);
  const length = route.getTotalLength();
  const duration = 720;
  const packetFrames = Array.from({ length: 17 }, (_, index) => {
    const progress = index / 16;
    const point = route.getPointAtLength(length * progress);
    const opacity = Math.min(progress * 8, (1 - progress) * 6, 1);
    return { transform: 'translate(' + point.x + 'px, ' + point.y + 'px)', opacity };
  });

  signalTrace.setAttribute('href', '#' + route.id);
  signalAnimations = [
    signalTrace.animate([
      { strokeDashoffset: '1', opacity: .85 },
      { strokeDashoffset: '0', opacity: .85, offset: .76 },
      { strokeDashoffset: '0', opacity: 0 }
    ], { duration: duration + 160, easing: motionEase }),
    signalPacket.animate(packetFrames, { duration, easing: motionEase }),
    logo.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.035)', offset: .45 },
      { transform: 'scale(1)' }
    ], { duration: 350, delay: 300, easing: motionEase })
  ];
}

const mapArrival = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  mapArrival.disconnect();
  if (!reducedMotion.matches) {
    map.classList.add('map-intro');
    spinLogo();
    sendSignal(map.dataset.active);
  }
}, { threshold: .45 }) : null;

mapArrival?.observe(map);
reducedMotion.addEventListener('change', event => {
  if (!event.matches) return;
  map.classList.remove('map-intro');
  document.getAnimations().forEach(animation => animation.cancel());
});

const mapCopy = {
  you: ['Set the direction.', 'Give your agents a shared goal and decide what moves forward.'],
  agents: ['Hear different perspectives.', 'Choose which connected agents join the conversation and who should reply.'],
  memory: ['Carry the decision forward.', 'Save key decisions to Project Memory so the next session has context.']
};
function selectMapNode(button) {
  const choice = button.dataset.map;
  mapArrival?.disconnect();
  map.dataset.active = choice;
  mapButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  const [heading, body] = mapCopy[choice];
  mapCaption.querySelector('strong').textContent = heading;
  mapCaption.querySelector('span').textContent = body;
  sendSignal(choice);
  reveal(mapCaption, 230);
}

const settleAnimations = new WeakMap();
let drag;
let ignoreClickOn;

function finishDrag(event, activate) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const { button, moved, translation } = drag;
  drag = undefined;
  if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
  if (!moved) return;

  delete button.dataset.dragging;
  delete map.dataset.dragging;
  button.style.removeProperty('translate');
  ignoreClickOn = button;
  if (activate) selectMapNode(button);
  if (!reducedMotion.matches) {
    settleAnimations.set(button, button.animate(
      [{ translate: translation }, { translate: '0px 0px' }],
      { duration: 440, easing: motionEase }
    ));
  }
}

mapButtons.forEach(button => {
  button.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    ignoreClickOn = undefined;
    map.classList.remove('map-intro');
    settleAnimations.get(button)?.cancel();
    const bounds = map.getBoundingClientRect();
    const label = button.getBoundingClientRect();
    drag = {
      button,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: label.left + label.width / 2 - bounds.left,
      originY: label.top + label.height / 2 - bounds.top,
      width: bounds.width,
      height: bounds.height,
      halfWidth: label.width / 2,
      halfHeight: label.height / 2,
      moved: false
    };
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) {
      drag.moved = true;
      mapArrival?.disconnect();
      signalAnimations.forEach(animation => animation.cancel());
      button.dataset.dragging = '';
      map.dataset.dragging = button.dataset.map;
    }

    const x = Math.min(drag.width - drag.halfWidth, Math.max(drag.halfWidth, drag.originX + dx));
    const y = Math.min(drag.height - drag.halfHeight, Math.max(drag.halfHeight, drag.originY + dy));
    drag.translation = (x - drag.originX) + 'px ' + (y - drag.originY) + 'px';
    button.style.translate = drag.translation;
    tether.setAttribute('x1', String(500 * x / drag.width));
    tether.setAttribute('y1', String(500 * y / drag.height));
  });

  button.addEventListener('pointerup', event => finishDrag(event, true));
  button.addEventListener('pointercancel', event => finishDrag(event, false));
  button.addEventListener('lostpointercapture', event => finishDrag(event, false));
  button.addEventListener('click', event => {
    if (event.detail && ignoreClickOn === button) {
      ignoreClickOn = undefined;
      return;
    }
    selectMapNode(button);
  });
});

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
