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

const mapArrival = new IntersectionObserver(entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  mapArrival.disconnect();
  sendSignal(map.dataset.active);
}, { threshold: .45 });

mapArrival.observe(map);
reducedMotion.addEventListener('change', event => {
  if (!event.matches) return;
  document.getAnimations().forEach(animation => animation.cancel());
});

const mapCopy = {
  you: ['Set the direction.', 'Give your agents a shared goal and decide what moves forward.'],
  agents: ['Hear different perspectives.', 'Choose which connected agents join the conversation and who should reply.'],
  memory: ['Carry the decision forward.', 'Save key decisions to Project Memory so the next session has context.']
};
mapButtons.forEach(button => {
  button.addEventListener('click', () => {
    const choice = button.dataset.map;
    mapArrival.disconnect();
    map.dataset.active = choice;
    mapButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    const [heading, body] = mapCopy[choice];
    mapCaption.querySelector('strong').textContent = heading;
    mapCaption.querySelector('span').textContent = body;
    sendSignal(choice);
    reveal(mapCaption, 230);
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
