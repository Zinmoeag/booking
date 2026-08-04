/**
 * Pushes hotel-booking-telegram-bot.json into a running n8n through its public
 * REST API. Creates the workflow the first time and updates it after that, so
 * re-running never leaves a duplicate behind.
 *
 *   setx N8N_API_KEY "<key from n8n → Settings → n8n API>"     (once)
 *   node n8n/build.mjs && node n8n/deploy.mjs
 *
 * Options:
 *   --url <base>      n8n base URL (default http://127.0.0.1:5678)
 *   --key-file <path> read the API key from a file instead of N8N_API_KEY
 *   --activate        activate the workflow after writing it
 *
 * Activation only works once every node has its credential, so the normal
 * flow is: deploy → attach the Telegram credential in the UI → activate.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};

const baseUrl = (arg('--url', process.env.N8N_URL || 'http://127.0.0.1:5678')).replace(/\/$/, '');
const keyFile = arg('--key-file', null);
const apiKey = (keyFile ? readFileSync(keyFile, 'utf8') : process.env.N8N_API_KEY || '').trim();
const activate = process.argv.includes('--activate');

if (!apiKey) {
  console.error(
    'No API key. Set N8N_API_KEY, or pass --key-file <path>.\n' +
      'Create one in n8n → Settings → n8n API → Create an API key.'
  );
  process.exit(1);
}

const source = JSON.parse(
  readFileSync(join(here, 'hotel-booking-telegram-bot.json'), 'utf8')
);

// The public API rejects unknown properties — send only what it accepts.
const body = {
  name: source.name,
  nodes: source.nodes,
  connections: source.connections,
  settings: source.settings || { executionOrder: 'v1' },
};

const call = async (method, path, payload) => {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      'X-N8N-API-KEY': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      method + ' ' + path + ' → ' + response.status + ' ' + (json.message || text)
    );
  }
  return json;
};

const findByName = async (name) => {
  let cursor;
  do {
    const page = await call(
      'GET',
      '/api/v1/workflows?limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')
    );
    const hit = (page.data || []).find((w) => w.name === name);
    if (hit) return hit;
    cursor = page.nextCursor;
  } while (cursor);
  return null;
};

const existing = await findByName(body.name);

const saved = existing
  ? await call('PUT', '/api/v1/workflows/' + existing.id, body)
  : await call('POST', '/api/v1/workflows', body);

console.log(
  (existing ? 'updated' : 'created') +
    ' "' + saved.name + '" · id ' + saved.id +
    ' · ' + saved.nodes.length + ' nodes'
);
console.log('open: ' + baseUrl + '/workflow/' + saved.id);

if (activate) {
  try {
    await call('POST', '/api/v1/workflows/' + saved.id + '/activate');
    console.log('activated');
  } catch (error) {
    console.error('could not activate: ' + error.message);
    console.error('attach the Telegram credential in the UI first, then re-run with --activate');
    process.exit(1);
  }
} else if (!saved.active) {
  console.log('not active — attach the Telegram credential, then: node n8n/deploy.mjs --activate');
}
