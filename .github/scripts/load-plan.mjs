// Loads plans/plan.json into the gym database, using the details in web/config.js.
import fs from 'node:fs';

const cfgText = fs.readFileSync('web/config.js', 'utf8');
const get = (k) => {
  const m = cfgText.match(new RegExp(k + "\\s*:\\s*'([^']*)'"));
  if (!m || !m[1]) throw new Error(`Missing ${k} in web/config.js`);
  return m[1];
};
const url = get('supabaseUrl').replace(/\/+$/, '');
const key = get('supabaseKey');
const room = get('room');
const plan = JSON.parse(fs.readFileSync('plans/plan.json', 'utf8'));

const headers = { apikey: key, 'Content-Type': 'application/json' };
if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;

const res = await fetch(`${url}/rest/v1/rpc/gym_action`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ p_room: room, p_action: 'save_plan', p_value: plan }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`Failed (${res.status}): ${text}`);
  process.exit(1);
}
const days = plan.days.map((d) => `${d.name} (${d.exercises.length} exercises)`).join(', ');
console.log(`Plan loaded: ${days}`);
