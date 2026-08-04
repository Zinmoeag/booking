// ─────────────────────────────────────────────────────────────────────────────
// Router — turns one Telegram update into either a reply or an API call plan.
// n8n Code node · mode "Run Once for All Items" · JavaScript
//
// Output item shape:
//   { chatId, messageId, intent, hasApi, api|null, reply|null, ctx,
//     tokenRefreshNeeded, refreshToken, refreshUrl, deleteUserMessage }
// ─────────────────────────────────────────────────────────────────────────────

// ── Configuration ────────────────────────────────────────────────────────────
// n8n runs in its own compose stack, so it reaches the API over the host.
// Same docker network instead? use 'http://booking-dev:4000'.
const API_BASE_URL = 'http://host.docker.internal:4000';

// paginationSchema validates `size < 100` — never raise this to 100 or above.
const PAGE_SIZE = 5;

// Empty = anyone may talk to the bot. Add chat ids as strings to lock it down.
const ALLOWED_CHAT_IDS = [];

const PAYMENT_METHODS = [
  'CREDIT_CARD',
  'DEBIT_CARD',
  'PAYPAL',
  'BANK_TRANSFER',
  'CASH',
];

// ── Session store — persisted in workflow static data ────────────────────────
// Static data is only written back on *production* executions, i.e. the
// workflow must be Active. Manual test runs forget the session.
const store = $getWorkflowStaticData('global');
if (!store.sessions) store.sessions = {};

const ACCESS_TOKEN_TTL_MS = 14 * 60 * 1000; // API issues 15m; refresh a minute early

const HELP = [
  '<b>🏨 Hotel Booking Bot</b>',
  '',
  '<b>Account</b>',
  '/register — create a guest account',
  '/login — sign in',
  '/me — who am I',
  '/logout — forget my tokens',
  '',
  '<b>Browse</b>',
  '/hotels — list hotels',
  '/hotels yangon — filter by city',
  '/hotels yangon 2 — page 2',
  '/hotel 1 — details and rooms of hotel #1',
  '',
  '<b>Book</b>',
  '/book 1 — book room #1, guided step by step',
  '/book 1 2026-08-10 2026-08-13 — quick book',
  '/mybookings — my bookings',
  '/cancel 1 — cancel booking #1',
  '/review 1 5 Lovely stay — review booking #1',
  '',
  '<i>Numbers always refer to the last list I showed you.</i>',
].join('\n');

// ── Helpers ──────────────────────────────────────────────────────────────────
const esc = (value) =>
  String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const queryString = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');

const api = (method, path, options) => ({
  method,
  url: API_BASE_URL + path,
  headers: { 'Content-Type': 'application/json' },
  body: (options && options.body) || {},
  auth: Boolean(options && options.auth),
});

const say = (intent, reply, extra) =>
  Object.assign({ intent, reply }, extra || {});

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isIsoDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z'));

const today = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();

const dateError = (checkIn, checkOut) => {
  if (!isIsoDate(checkIn)) return 'Check-in date must look like <code>2026-08-10</code>.';
  if (!isIsoDate(checkOut)) return 'Check-out date must look like <code>2026-08-13</code>.';
  const from = Date.parse(checkIn + 'T00:00:00Z');
  const to = Date.parse(checkOut + 'T00:00:00Z');
  if (from < today()) return 'Check-in cannot be in the past.';
  if (to <= from) return 'Check-out must be after check-in.';
  return null;
};

const pickFrom = (list, raw, label) => {
  if (!list || !list.length) {
    return { error: 'I have no ' + label + ' list yet. Run the listing command first.' };
  }
  const index = Number.parseInt(raw, 10);
  if (!Number.isInteger(index) || index < 1 || index > list.length) {
    return { error: 'Pick a number between 1 and ' + list.length + '.' };
  }
  return { value: list[index - 1] };
};

const paymentMenu = () =>
  PAYMENT_METHODS.map((method, i) => i + 1 + '. ' + method.replace(/_/g, ' ')).join('\n');

// ── Intent builders ──────────────────────────────────────────────────────────
const loginPlan = (email, password) =>
  say('auth.login', null, {
    api: api('POST', '/api/auth/login', { body: { email, password } }),
    sensitive: true,
  });

const registerPlan = (draft) =>
  say('auth.register', null, {
    api: api('POST', '/api/auth/register', {
      body: {
        email: draft.email,
        password: draft.password,
        firstName: draft.firstName,
        lastName: draft.lastName,
      },
    }),
    sensitive: true,
  });

const createBookingPlan = (session) => {
  const draft = session.draft;
  return say('bookings.create', null, {
    api: api('POST', '/api/bookings', {
      auth: true,
      body: {
        hotelId: draft.hotelId,
        rooms: [
          {
            roomId: draft.roomId,
            checkInDate: draft.checkInDate,
            checkOutDate: draft.checkOutDate,
            guests: [{ fullName: draft.fullName, isPrimary: true }],
          },
        ],
        paymentMethod: draft.paymentMethod,
      },
    }),
    ctx: {
      roomLabel: draft.roomLabel,
      hotelName: draft.hotelName,
      checkInDate: draft.checkInDate,
      checkOutDate: draft.checkOutDate,
    },
  });
};

const beginBooking = (session, room, checkIn, checkOut) => {
  session.draft = {
    roomId: room.id,
    hotelId: room.hotelId,
    hotelName: room.hotelName,
    roomLabel: room.label,
  };

  if (checkIn && checkOut) {
    const problem = dateError(checkIn, checkOut);
    if (problem) return say('error', '⚠️ ' + problem);
    session.draft.checkInDate = checkIn;
    session.draft.checkOutDate = checkOut;
    session.stage = 'book:guest';
    return say(
      'prompt',
      [
        '🛏 <b>' + esc(room.label) + '</b> at ' + esc(room.hotelName),
        esc(checkIn) + ' → ' + esc(checkOut),
        '',
        "Who is the main guest? Send a name, or <code>-</code> to use your own.",
      ].join('\n')
    );
  }

  session.stage = 'book:checkin';
  return say(
    'prompt',
    [
      '🛏 <b>' + esc(room.label) + '</b> at ' + esc(room.hotelName),
      '',
      'Check-in date? Format <code>2026-08-10</code>.',
      'Send /cancelflow to stop.',
    ].join('\n')
  );
};

// ── Wizard — a stage is only reachable while the user is mid-flow ────────────
function continueWizard(session, text) {
  const stage = session.stage;
  const draft = session.draft;

  if (stage === 'login:email') {
    if (!isEmail(text)) return say('prompt', '⚠️ That does not look like an email. Try again.');
    draft.email = text;
    session.stage = 'login:password';
    return say('prompt', '🔑 Now send your password. I delete that message right away.');
  }

  if (stage === 'login:password') {
    session.stage = 'idle';
    return loginPlan(draft.email, text);
  }

  if (stage === 'register:email') {
    if (!isEmail(text)) return say('prompt', '⚠️ That does not look like an email. Try again.');
    draft.email = text;
    session.stage = 'register:password';
    return say('prompt', '🔑 Choose a password — at least 6 characters.');
  }

  if (stage === 'register:password') {
    if (text.length < 6) return say('prompt', '⚠️ Too short. At least 6 characters please.');
    draft.password = text;
    session.stage = 'register:name';
    return say('prompt', '🙋 Your full name? For example <code>Aung Aung</code>.', {
      sensitive: true,
    });
  }

  if (stage === 'register:name') {
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return say('prompt', '⚠️ Send a first name and a last name.');
    draft.firstName = parts[0];
    draft.lastName = parts.slice(1).join(' ');
    session.stage = 'idle';
    return registerPlan(draft);
  }

  if (stage === 'book:checkin') {
    if (!isIsoDate(text)) return say('prompt', '⚠️ Use <code>YYYY-MM-DD</code>, e.g. 2026-08-10.');
    draft.checkInDate = text;
    session.stage = 'book:checkout';
    return say('prompt', '📅 Check-out date?');
  }

  if (stage === 'book:checkout') {
    const problem = dateError(draft.checkInDate, text);
    if (problem) return say('prompt', '⚠️ ' + problem);
    draft.checkOutDate = text;
    session.stage = 'book:guest';
    return say('prompt', "🙋 Main guest name? Send <code>-</code> to use your own.");
  }

  if (stage === 'book:guest') {
    const user = session.user || {};
    const fallback = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const name = text === '-' ? fallback : text;
    if (!name) return say('prompt', '⚠️ I need a guest name.');
    draft.fullName = name;
    session.stage = 'book:payment';
    return say('prompt', '💳 How will you pay?\n' + paymentMenu());
  }

  if (stage === 'book:payment') {
    const byNumber = PAYMENT_METHODS[Number.parseInt(text, 10) - 1];
    const byName = PAYMENT_METHODS.find(
      (m) => m === text.toUpperCase().replace(/\s+/g, '_')
    );
    const method = byNumber || byName;
    if (!method) return say('prompt', '⚠️ Pick one:\n' + paymentMenu());
    draft.paymentMethod = method;
    session.stage = 'idle';
    return createBookingPlan(session);
  }

  if (stage === 'review:rating') {
    const rating = Number.parseInt(text, 10);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return say('prompt', '⚠️ Rating must be a whole number from 1 to 5.');
    }
    draft.rating = rating;
    session.stage = 'review:comment';
    return say('prompt', '✍️ Add a comment, or send <code>-</code> to skip.');
  }

  if (stage === 'review:comment') {
    session.stage = 'idle';
    return say('review.create', null, {
      api: api('POST', '/api/reviews', {
        auth: true,
        body: {
          bookingId: draft.bookingId,
          rating: draft.rating,
          comment: text === '-' ? null : text,
        },
      }),
    });
  }

  session.stage = 'idle';
  return say('help', HELP);
}

// ── Command routing ──────────────────────────────────────────────────────────
function route(session, text) {
  const isCommand = text.startsWith('/');

  if (session.stage && session.stage !== 'idle' && !isCommand) {
    return continueWizard(session, text);
  }

  if (!isCommand) {
    return say('help', 'Send me a command 👇\n\n' + HELP);
  }

  // A command always aborts whatever flow was running.
  session.stage = 'idle';

  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase().replace(/@.*$/, '');
  const args = parts.slice(1);

  if (cmd === '/start') {
    return say('menu.start', 'Welcome! Choose an option:', { menu: 'start' });
  }

  if (cmd === '/help') {
    return say('help', HELP);
  }

  if (cmd === '/cancelflow') {
    session.draft = {};
    return say('help', '👍 Cancelled.\n\n' + HELP);
  }

  if (cmd === '/login') {
    session.draft = {};
    if (args.length >= 2) return loginPlan(args[0], args.slice(1).join(' '));
    session.stage = 'login:email';
    return say('prompt', '📧 What is your email?');
  }

  if (cmd === '/register') {
    session.draft = {};
    if (args.length >= 4) {
      return registerPlan({
        email: args[0],
        password: args[1],
        firstName: args[2],
        lastName: args.slice(3).join(' '),
      });
    }
    session.stage = 'register:email';
    return say('prompt', '📧 What email should I register?');
  }

  if (cmd === '/logout') {
    delete session.accessToken;
    delete session.refreshToken;
    delete session.expiresAt;
    delete session.user;
    session.draft = {};
    return say('logout', '👋 Signed out. Your tokens are gone from my memory.');
  }

  if (cmd === '/me') {
    return say('auth.me', null, { api: api('GET', '/api/auth/me', { auth: true }) });
  }

  if (cmd === '/hotels') {
    const rest = args.slice();
    let page = 1;
    if (rest.length && /^\d+$/.test(rest[rest.length - 1])) {
      page = Math.max(1, Number.parseInt(rest.pop(), 10));
    }
    const city = rest.join(' ').trim();
    const query = queryString({
      'pagination[page]': page,
      'pagination[size]': PAGE_SIZE,
      'filter[city][contains]': city || undefined,
    });
    return say('hotels.list', null, {
      api: api('GET', '/api/hotels?' + query),
      ctx: { page, city, pageSize: PAGE_SIZE },
    });
  }

  if (cmd === '/hotel') {
    const picked = pickFrom(session.hotels, args[0], 'hotel');
    if (picked.error) return say('error', '⚠️ ' + picked.error + '\nTry /hotels first.');
    return say('hotel.detail', null, {
      api: api('GET', '/api/hotels/' + encodeURIComponent(picked.value.id)),
    });
  }

  if (cmd === '/book') {
    const picked = pickFrom(session.rooms, args[0], 'room');
    if (picked.error) return say('error', '⚠️ ' + picked.error + '\nOpen a hotel with /hotel 1 first.');
    return beginBooking(session, picked.value, args[1], args[2]);
  }

  if (cmd === '/mybookings') {
    const query = queryString({ 'pagination[page]': 1, 'pagination[size]': PAGE_SIZE });
    return say('bookings.list', null, {
      api: api('GET', '/api/bookings?' + query, { auth: true }),
    });
  }

  if (cmd === '/cancel') {
    const picked = pickFrom(session.bookings, args[0], 'booking');
    if (picked.error) return say('error', '⚠️ ' + picked.error + '\nTry /mybookings first.');
    return say('bookings.cancel', null, {
      api: api('DELETE', '/api/bookings/' + encodeURIComponent(picked.value.id), { auth: true }),
      ctx: { code: picked.value.code },
    });
  }

  if (cmd === '/review') {
    const picked = pickFrom(session.bookings, args[0], 'booking');
    if (picked.error) return say('error', '⚠️ ' + picked.error + '\nTry /mybookings first.');
    session.draft = { bookingId: picked.value.id };

    if (args.length >= 2) {
      const rating = Number.parseInt(args[1], 10);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return say('error', '⚠️ Rating must be a whole number from 1 to 5.');
      }
      const comment = args.slice(2).join(' ').trim();
      return say('review.create', null, {
        api: api('POST', '/api/reviews', {
          auth: true,
          body: { bookingId: picked.value.id, rating, comment: comment || null },
        }),
      });
    }

    session.stage = 'review:rating';
    return say('prompt', '⭐ How many stars, 1 to 5?');
  }

  if (cmd === '/pay') {
    return say(
      'pay.info',
      [
        '💳 <b>Payments are settled by the hotel, not here.</b>',
        '',
        'Your booking already carries a PENDING payment for the method you chose.',
        'Reception marks it COMPLETED — the API restricts that to staff and admins.',
        'Use /mybookings to watch the status.',
      ].join('\n')
    );
  }

  return say('help', '🤔 I do not know <code>' + esc(cmd) + '</code>.\n\n' + HELP);
}

// ── Main ─────────────────────────────────────────────────────────────────────
const AUTH_REQUIRED = new Set([
  'auth.me',
  'bookings.list',
  'bookings.create',
  'bookings.cancel',
  'review.create',
]);

const results = [];

for (const item of $input.all()) {
  const update = item.json || {};
  const message = update.message || update.edited_message;
  const callbackQuery = update.callback_query;

  let chatId;
  let messageId;
  let text;
  let isCallback = false;
  let callbackQueryId;

  if (callbackQuery) {
    isCallback = true;
    callbackQueryId = callbackQuery.id;
    const msg = callbackQuery.message || {};
    chatId = msg.chat && String(msg.chat.id);
    messageId = msg.message_id;
    text = '/' + (callbackQuery.data || '').trim();
  } else if (message && message.chat && typeof message.text === 'string') {
    chatId = String(message.chat.id);
    messageId = message.message_id;
    text = message.text.trim();
  } else {
    continue;
  }

  if (!chatId || !text) continue;

  if (ALLOWED_CHAT_IDS.length && ALLOWED_CHAT_IDS.indexOf(chatId) === -1) {
    results.push({
      chatId,
      messageId,
      intent: 'denied',
      hasApi: false,
      api: null,
      reply: '⛔ This bot is private.',
      ctx: {},
      tokenRefreshNeeded: false,
      refreshToken: null,
      refreshUrl: API_BASE_URL + '/api/auth/refresh',
      deleteUserMessage: false,
    });
    continue;
  }

  if (!store.sessions[chatId]) store.sessions[chatId] = { stage: 'idle', draft: {} };
  const session = store.sessions[chatId];
  if (!session.draft) session.draft = {};

  let plan = route(session, text);

  // Attach credentials, or ask for a refresh before the call goes out.
  let tokenRefreshNeeded = false;
  if (plan.api && plan.api.auth) {
    const stillValid =
      session.accessToken && session.expiresAt && Date.now() < session.expiresAt;

    if (stillValid) {
      plan.api.headers.Authorization = 'Bearer ' + session.accessToken;
    } else if (session.refreshToken) {
      tokenRefreshNeeded = true;
    } else {
      plan = say('need_login', '🔒 Please /login first.');
    }
  }

  results.push({
    chatId,
    messageId,
    intent: plan.intent,
    hasApi: Boolean(plan.api),
    api: plan.api || null,
    reply: plan.reply || null,
    ctx: plan.ctx || {},
    tokenRefreshNeeded,
    refreshToken: session.refreshToken || null,
    refreshUrl: API_BASE_URL + '/api/auth/refresh',
    deleteUserMessage: Boolean(plan.sensitive),
    accessTokenTtlMs: ACCESS_TOKEN_TTL_MS,
    pageSize: PAGE_SIZE,
    isCallback,
    callbackQueryId,
  });
}

return results.map((json) => ({ json }));
