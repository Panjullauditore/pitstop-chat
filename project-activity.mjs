const jakartaOffset = 7 * 60 * 60 * 1000;

function jakartaDay(value) {
  const time = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(time) ? new Date(time + jakartaOffset).toISOString().slice(0, 10) : '';
}

export function monthlyProjectActivity({messages, decisions, soul, now}) {
  const month = jakartaDay(now).slice(0, 7);
  const days = {};
  const count = (at, field) => {
    const day = jakartaDay(at);
    if (!day.startsWith(month)) return;
    days[day] ||= {messages:0, decisions:0};
    days[day][field]++;
  };
  for (const message of messages) {
    if (message.role === 'user' && message.status === 'done' && message.kind !== 'attendance') count(message.at, 'messages');
  }
  const counted = new Set();
  for (const decision of decisions) {
    if (typeof decision.id !== 'string' || counted.has(decision.id)) continue;
    counted.add(decision.id);
    count(decision.at, 'decisions');
  }
  const lastUpdateDay = [soul.coreUpdatedAt, soul.summaryUpdatedAt].map(jakartaDay).sort().at(-1);
  return {month, days, lastUpdateDay:lastUpdateDay?.startsWith(month) ? lastUpdateDay : null};
}
