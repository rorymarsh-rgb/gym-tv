// Pings the gym database so the free Supabase project never pauses for inactivity.
import fs from 'node:fs';

const cfgText = fs.readFileSync('web/config.js', 'utf8');
const get = (k) => {
  const m = cfgText.match(new RegExp(k + "\\s*:\\s*'([^']*)'"));
  if (!m || !m[1]) throw new Error(`Missing ${k} in web/config.js`);
  return m[1];
};
const url = get('supabaseUrl').replace(/\/+$/, '');
const key = get('supabaseKey');
const headers = { apikey: key, 'Content-Type': 'application/json' };
if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;

const res = await fetch(`${url}/rest/v1/rpc/gym_get`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ p_room: get('room') }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`Database did not answer (${res.status}): ${text}`);
  console.error('If the project is paused, open supabase.com and click Restore.');
  process.exit(1);
}
console.log(`Database awake at ${new Date().toISOString()}`);
