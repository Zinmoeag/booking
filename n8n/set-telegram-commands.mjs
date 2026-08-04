/**
 * Registers the bot's command menu with Telegram — the list that pops up when a
 * user types "/" or taps the Menu button.
 *
 *   node n8n/set-telegram-commands.mjs <BOT_TOKEN>
 *   TELEGRAM_BOT_TOKEN=... node n8n/set-telegram-commands.mjs
 *
 * Pass --show to print what Telegram currently has, without changing anything.
 *
 * The same list lives in BotFather under /setcommands; this script is just the
 * scriptable version of that, so the menu can be updated alongside the code.
 */
const token = (process.argv[2] || process.env.TELEGRAM_BOT_TOKEN || '').trim();
const showOnly = process.argv.includes('--show');

if (!token || token.startsWith('--')) {
  console.error(
    'Usage: node n8n/set-telegram-commands.mjs <BOT_TOKEN>\n' +
      '   or: TELEGRAM_BOT_TOKEN=... node n8n/set-telegram-commands.mjs\n' +
      'Get the token from BotFather, or from the Telegram credential in n8n.'
  );
  process.exit(1);
}

// Telegram rules: lowercase, 1–32 chars, no leading slash; description ≤ 256.
// Order is the order shown in the menu — keep the first-run path at the top.
const commands = [
  { command: 'start', description: 'Show the menu' },
  { command: 'hotels', description: 'Browse hotels — /hotels yangon to filter by city' },
  { command: 'hotel', description: 'Open hotel #n from the last list, with its rooms' },
  { command: 'book', description: 'Book room #n — I ask for dates step by step' },
  { command: 'mybookings', description: 'My bookings and their status' },
  { command: 'cancel', description: 'Cancel booking #n' },
  { command: 'review', description: 'Review booking #n after checkout' },
  { command: 'login', description: 'Sign in' },
  { command: 'register', description: 'Create a guest account' },
  { command: 'me', description: 'Who am I' },
  { command: 'logout', description: 'Forget my tokens' },
  { command: 'pay', description: 'How payment works' },
  { command: 'cancelflow', description: 'Abandon the current step-by-step flow' },
  { command: 'help', description: 'Show the menu' },
];

const api = async (method, body) => {
  const res = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(method + ' failed: ' + (json.description || res.status));
  return json.result;
};

const me = await api('getMe');
console.log('bot: @' + me.username + ' (' + me.first_name + ')');

if (showOnly) {
  const current = await api('getMyCommands');
  console.log(
    current.length
      ? current.map((c) => '  /' + c.command + ' — ' + c.description).join('\n')
      : '  (no commands registered)'
  );
  process.exit(0);
}

await api('setMyCommands', { commands });

// Make the Menu button show that list rather than a Web App.
await api('setChatMenuButton', { menu_button: { type: 'commands' } });

await api('setMyDescription', {
  description:
    'Browse hotels, check rooms and prices, and book a stay — right here in chat. ' +
    'Send /start to begin.',
});
await api('setMyShortDescription', {
  short_description: 'Hotel search and booking, in chat.',
});

const saved = await api('getMyCommands');
console.log('registered ' + saved.length + ' commands:');
console.log(saved.map((c) => '  /' + c.command + ' — ' + c.description).join('\n'));
console.log('\nMenu button set to "commands". Open the chat again to see it.');
