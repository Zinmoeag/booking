import { workflow, node, trigger, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

// Telegram → Router → (refresh if the access token lapsed) → one generic API
// call → formatted reply. Adding a command means editing the Code-node sources
// in n8n/nodes/, never this graph.

const telegramTrigger = trigger({
  type: 'n8n-nodes-base.telegramTrigger',
  version: 1.4,
  config: {
    name: 'Telegram Trigger',
    position: [-220, 380],
    parameters: { updates: ['message'] },
    credentials: { telegramApi: newCredential('Telegram Bot') }
  }
});

const router = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Router',
    position: [20, 380],
    parameters: { mode: 'runOnceForAllItems', jsCode: "// ─────────────────────────────────────────────────────────────────────────────\n// Router — turns one Telegram update into either a reply or an API call plan.\n// n8n Code node · mode \"Run Once for All Items\" · JavaScript\n//\n// Output item shape:\n//   { chatId, messageId, intent, hasApi, api|null, reply|null, ctx,\n//     tokenRefreshNeeded, refreshToken, refreshUrl, deleteUserMessage }\n// ─────────────────────────────────────────────────────────────────────────────\n\n// ── Configuration ────────────────────────────────────────────────────────────\n// n8n runs in its own compose stack, so it reaches the API over the host.\n// Same docker network instead? use 'http://booking-dev:4000'.\nconst API_BASE_URL = 'http://host.docker.internal:4000';\n\n// paginationSchema validates `size < 100` — never raise this to 100 or above.\nconst PAGE_SIZE = 5;\n\n// Empty = anyone may talk to the bot. Add chat ids as strings to lock it down.\nconst ALLOWED_CHAT_IDS = [];\n\nconst PAYMENT_METHODS = [\n  'CREDIT_CARD',\n  'DEBIT_CARD',\n  'PAYPAL',\n  'BANK_TRANSFER',\n  'CASH',\n];\n\n// ── Session store — persisted in workflow static data ────────────────────────\n// Static data is only written back on *production* executions, i.e. the\n// workflow must be Active. Manual test runs forget the session.\nconst store = $getWorkflowStaticData('global');\nif (!store.sessions) store.sessions = {};\n\nconst ACCESS_TOKEN_TTL_MS = 14 * 60 * 1000; // API issues 15m; refresh a minute early\n\nconst HELP = [\n  '<b>🏨 Hotel Booking Bot</b>',\n  '',\n  '<b>Account</b>',\n  '/register — create a guest account',\n  '/login — sign in',\n  '/me — who am I',\n  '/logout — forget my tokens',\n  '',\n  '<b>Browse</b>',\n  '/hotels — list hotels',\n  '/hotels yangon — filter by city',\n  '/hotels yangon 2 — page 2',\n  '/hotel 1 — details and rooms of hotel #1',\n  '',\n  '<b>Book</b>',\n  '/book 1 — book room #1, guided step by step',\n  '/book 1 2026-08-10 2026-08-13 — quick book',\n  '/mybookings — my bookings',\n  '/cancel 1 — cancel booking #1',\n  '/review 1 5 Lovely stay — review booking #1',\n  '',\n  '<i>Numbers always refer to the last list I showed you.</i>',\n].join('\\n');\n\n// ── Helpers ──────────────────────────────────────────────────────────────────\nconst esc = (value) =>\n  String(value === undefined || value === null ? '' : value)\n    .replace(/&/g, '&amp;')\n    .replace(/</g, '&lt;')\n    .replace(/>/g, '&gt;');\n\nconst queryString = (params) =>\n  Object.entries(params)\n    .filter(([, v]) => v !== undefined && v !== null && v !== '')\n    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))\n    .join('&');\n\nconst api = (method, path, options) => ({\n  method,\n  url: API_BASE_URL + path,\n  headers: { 'Content-Type': 'application/json' },\n  body: (options && options.body) || {},\n  auth: Boolean(options && options.auth),\n});\n\nconst say = (intent, reply, extra) =>\n  Object.assign({ intent, reply }, extra || {});\n\nconst isEmail = (value) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);\n\nconst isIsoDate = (value) =>\n  /^\\d{4}-\\d{2}-\\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z'));\n\nconst today = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').getTime();\n\nconst dateError = (checkIn, checkOut) => {\n  if (!isIsoDate(checkIn)) return 'Check-in date must look like <code>2026-08-10</code>.';\n  if (!isIsoDate(checkOut)) return 'Check-out date must look like <code>2026-08-13</code>.';\n  const from = Date.parse(checkIn + 'T00:00:00Z');\n  const to = Date.parse(checkOut + 'T00:00:00Z');\n  if (from < today()) return 'Check-in cannot be in the past.';\n  if (to <= from) return 'Check-out must be after check-in.';\n  return null;\n};\n\nconst pickFrom = (list, raw, label) => {\n  if (!list || !list.length) {\n    return { error: 'I have no ' + label + ' list yet. Run the listing command first.' };\n  }\n  const index = Number.parseInt(raw, 10);\n  if (!Number.isInteger(index) || index < 1 || index > list.length) {\n    return { error: 'Pick a number between 1 and ' + list.length + '.' };\n  }\n  return { value: list[index - 1] };\n};\n\nconst paymentMenu = () =>\n  PAYMENT_METHODS.map((method, i) => i + 1 + '. ' + method.replace(/_/g, ' ')).join('\\n');\n\n// ── Intent builders ──────────────────────────────────────────────────────────\nconst loginPlan = (email, password) =>\n  say('auth.login', null, {\n    api: api('POST', '/api/auth/login', { body: { email, password } }),\n    sensitive: true,\n  });\n\nconst registerPlan = (draft) =>\n  say('auth.register', null, {\n    api: api('POST', '/api/auth/register', {\n      body: {\n        email: draft.email,\n        password: draft.password,\n        firstName: draft.firstName,\n        lastName: draft.lastName,\n      },\n    }),\n    sensitive: true,\n  });\n\nconst createBookingPlan = (session) => {\n  const draft = session.draft;\n  return say('bookings.create', null, {\n    api: api('POST', '/api/bookings', {\n      auth: true,\n      body: {\n        hotelId: draft.hotelId,\n        rooms: [\n          {\n            roomId: draft.roomId,\n            checkInDate: draft.checkInDate,\n            checkOutDate: draft.checkOutDate,\n            guests: [{ fullName: draft.fullName, isPrimary: true }],\n          },\n        ],\n        paymentMethod: draft.paymentMethod,\n      },\n    }),\n    ctx: {\n      roomLabel: draft.roomLabel,\n      hotelName: draft.hotelName,\n      checkInDate: draft.checkInDate,\n      checkOutDate: draft.checkOutDate,\n    },\n  });\n};\n\nconst beginBooking = (session, room, checkIn, checkOut) => {\n  session.draft = {\n    roomId: room.id,\n    hotelId: room.hotelId,\n    hotelName: room.hotelName,\n    roomLabel: room.label,\n  };\n\n  if (checkIn && checkOut) {\n    const problem = dateError(checkIn, checkOut);\n    if (problem) return say('error', '⚠️ ' + problem);\n    session.draft.checkInDate = checkIn;\n    session.draft.checkOutDate = checkOut;\n    session.stage = 'book:guest';\n    return say(\n      'prompt',\n      [\n        '🛏 <b>' + esc(room.label) + '</b> at ' + esc(room.hotelName),\n        esc(checkIn) + ' → ' + esc(checkOut),\n        '',\n        \"Who is the main guest? Send a name, or <code>-</code> to use your own.\",\n      ].join('\\n')\n    );\n  }\n\n  session.stage = 'book:checkin';\n  return say(\n    'prompt',\n    [\n      '🛏 <b>' + esc(room.label) + '</b> at ' + esc(room.hotelName),\n      '',\n      'Check-in date? Format <code>2026-08-10</code>.',\n      'Send /cancelflow to stop.',\n    ].join('\\n')\n  );\n};\n\n// ── Wizard — a stage is only reachable while the user is mid-flow ────────────\nfunction continueWizard(session, text) {\n  const stage = session.stage;\n  const draft = session.draft;\n\n  if (stage === 'login:email') {\n    if (!isEmail(text)) return say('prompt', '⚠️ That does not look like an email. Try again.');\n    draft.email = text;\n    session.stage = 'login:password';\n    return say('prompt', '🔑 Now send your password. I delete that message right away.');\n  }\n\n  if (stage === 'login:password') {\n    session.stage = 'idle';\n    return loginPlan(draft.email, text);\n  }\n\n  if (stage === 'register:email') {\n    if (!isEmail(text)) return say('prompt', '⚠️ That does not look like an email. Try again.');\n    draft.email = text;\n    session.stage = 'register:password';\n    return say('prompt', '🔑 Choose a password — at least 6 characters.');\n  }\n\n  if (stage === 'register:password') {\n    if (text.length < 6) return say('prompt', '⚠️ Too short. At least 6 characters please.');\n    draft.password = text;\n    session.stage = 'register:name';\n    return say('prompt', '🙋 Your full name? For example <code>Aung Aung</code>.', {\n      sensitive: true,\n    });\n  }\n\n  if (stage === 'register:name') {\n    const parts = text.split(/\\s+/).filter(Boolean);\n    if (parts.length < 2) return say('prompt', '⚠️ Send a first name and a last name.');\n    draft.firstName = parts[0];\n    draft.lastName = parts.slice(1).join(' ');\n    session.stage = 'idle';\n    return registerPlan(draft);\n  }\n\n  if (stage === 'book:checkin') {\n    if (!isIsoDate(text)) return say('prompt', '⚠️ Use <code>YYYY-MM-DD</code>, e.g. 2026-08-10.');\n    draft.checkInDate = text;\n    session.stage = 'book:checkout';\n    return say('prompt', '📅 Check-out date?');\n  }\n\n  if (stage === 'book:checkout') {\n    const problem = dateError(draft.checkInDate, text);\n    if (problem) return say('prompt', '⚠️ ' + problem);\n    draft.checkOutDate = text;\n    session.stage = 'book:guest';\n    return say('prompt', \"🙋 Main guest name? Send <code>-</code> to use your own.\");\n  }\n\n  if (stage === 'book:guest') {\n    const user = session.user || {};\n    const fallback = [user.firstName, user.lastName].filter(Boolean).join(' ');\n    const name = text === '-' ? fallback : text;\n    if (!name) return say('prompt', '⚠️ I need a guest name.');\n    draft.fullName = name;\n    session.stage = 'book:payment';\n    return say('prompt', '💳 How will you pay?\\n' + paymentMenu());\n  }\n\n  if (stage === 'book:payment') {\n    const byNumber = PAYMENT_METHODS[Number.parseInt(text, 10) - 1];\n    const byName = PAYMENT_METHODS.find(\n      (m) => m === text.toUpperCase().replace(/\\s+/g, '_')\n    );\n    const method = byNumber || byName;\n    if (!method) return say('prompt', '⚠️ Pick one:\\n' + paymentMenu());\n    draft.paymentMethod = method;\n    session.stage = 'idle';\n    return createBookingPlan(session);\n  }\n\n  if (stage === 'review:rating') {\n    const rating = Number.parseInt(text, 10);\n    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {\n      return say('prompt', '⚠️ Rating must be a whole number from 1 to 5.');\n    }\n    draft.rating = rating;\n    session.stage = 'review:comment';\n    return say('prompt', '✍️ Add a comment, or send <code>-</code> to skip.');\n  }\n\n  if (stage === 'review:comment') {\n    session.stage = 'idle';\n    return say('review.create', null, {\n      api: api('POST', '/api/reviews', {\n        auth: true,\n        body: {\n          bookingId: draft.bookingId,\n          rating: draft.rating,\n          comment: text === '-' ? null : text,\n        },\n      }),\n    });\n  }\n\n  session.stage = 'idle';\n  return say('help', HELP);\n}\n\n// ── Command routing ──────────────────────────────────────────────────────────\nfunction route(session, text) {\n  const isCommand = text.startsWith('/');\n\n  if (session.stage && session.stage !== 'idle' && !isCommand) {\n    return continueWizard(session, text);\n  }\n\n  if (!isCommand) {\n    return say('help', 'Send me a command 👇\\n\\n' + HELP);\n  }\n\n  // A command always aborts whatever flow was running.\n  session.stage = 'idle';\n\n  const parts = text.split(/\\s+/);\n  const cmd = parts[0].toLowerCase().replace(/@.*$/, '');\n  const args = parts.slice(1);\n\n  if (cmd === '/start' || cmd === '/help') {\n    return say('help', HELP);\n  }\n\n  if (cmd === '/cancelflow') {\n    session.draft = {};\n    return say('help', '👍 Cancelled.\\n\\n' + HELP);\n  }\n\n  if (cmd === '/login') {\n    session.draft = {};\n    if (args.length >= 2) return loginPlan(args[0], args.slice(1).join(' '));\n    session.stage = 'login:email';\n    return say('prompt', '📧 What is your email?');\n  }\n\n  if (cmd === '/register') {\n    session.draft = {};\n    if (args.length >= 4) {\n      return registerPlan({\n        email: args[0],\n        password: args[1],\n        firstName: args[2],\n        lastName: args.slice(3).join(' '),\n      });\n    }\n    session.stage = 'register:email';\n    return say('prompt', '📧 What email should I register?');\n  }\n\n  if (cmd === '/logout') {\n    delete session.accessToken;\n    delete session.refreshToken;\n    delete session.expiresAt;\n    delete session.user;\n    session.draft = {};\n    return say('logout', '👋 Signed out. Your tokens are gone from my memory.');\n  }\n\n  if (cmd === '/me') {\n    return say('auth.me', null, { api: api('GET', '/api/auth/me', { auth: true }) });\n  }\n\n  if (cmd === '/hotels') {\n    const rest = args.slice();\n    let page = 1;\n    if (rest.length && /^\\d+$/.test(rest[rest.length - 1])) {\n      page = Math.max(1, Number.parseInt(rest.pop(), 10));\n    }\n    const city = rest.join(' ').trim();\n    const query = queryString({\n      'pagination[page]': page,\n      'pagination[size]': PAGE_SIZE,\n      'filter[city][contains]': city || undefined,\n    });\n    return say('hotels.list', null, {\n      api: api('GET', '/api/hotels?' + query),\n      ctx: { page, city, pageSize: PAGE_SIZE },\n    });\n  }\n\n  if (cmd === '/hotel') {\n    const picked = pickFrom(session.hotels, args[0], 'hotel');\n    if (picked.error) return say('error', '⚠️ ' + picked.error + '\\nTry /hotels first.');\n    return say('hotel.detail', null, {\n      api: api('GET', '/api/hotels/' + encodeURIComponent(picked.value.id)),\n    });\n  }\n\n  if (cmd === '/book') {\n    const picked = pickFrom(session.rooms, args[0], 'room');\n    if (picked.error) return say('error', '⚠️ ' + picked.error + '\\nOpen a hotel with /hotel 1 first.');\n    return beginBooking(session, picked.value, args[1], args[2]);\n  }\n\n  if (cmd === '/mybookings') {\n    const query = queryString({ 'pagination[page]': 1, 'pagination[size]': PAGE_SIZE });\n    return say('bookings.list', null, {\n      api: api('GET', '/api/bookings?' + query, { auth: true }),\n    });\n  }\n\n  if (cmd === '/cancel') {\n    const picked = pickFrom(session.bookings, args[0], 'booking');\n    if (picked.error) return say('error', '⚠️ ' + picked.error + '\\nTry /mybookings first.');\n    return say('bookings.cancel', null, {\n      api: api('DELETE', '/api/bookings/' + encodeURIComponent(picked.value.id), { auth: true }),\n      ctx: { code: picked.value.code },\n    });\n  }\n\n  if (cmd === '/review') {\n    const picked = pickFrom(session.bookings, args[0], 'booking');\n    if (picked.error) return say('error', '⚠️ ' + picked.error + '\\nTry /mybookings first.');\n    session.draft = { bookingId: picked.value.id };\n\n    if (args.length >= 2) {\n      const rating = Number.parseInt(args[1], 10);\n      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {\n        return say('error', '⚠️ Rating must be a whole number from 1 to 5.');\n      }\n      const comment = args.slice(2).join(' ').trim();\n      return say('review.create', null, {\n        api: api('POST', '/api/reviews', {\n          auth: true,\n          body: { bookingId: picked.value.id, rating, comment: comment || null },\n        }),\n      });\n    }\n\n    session.stage = 'review:rating';\n    return say('prompt', '⭐ How many stars, 1 to 5?');\n  }\n\n  if (cmd === '/pay') {\n    return say(\n      'pay.info',\n      [\n        '💳 <b>Payments are settled by the hotel, not here.</b>',\n        '',\n        'Your booking already carries a PENDING payment for the method you chose.',\n        'Reception marks it COMPLETED — the API restricts that to staff and admins.',\n        'Use /mybookings to watch the status.',\n      ].join('\\n')\n    );\n  }\n\n  return say('help', '🤔 I do not know <code>' + esc(cmd) + '</code>.\\n\\n' + HELP);\n}\n\n// ── Main ─────────────────────────────────────────────────────────────────────\nconst AUTH_REQUIRED = new Set([\n  'auth.me',\n  'bookings.list',\n  'bookings.create',\n  'bookings.cancel',\n  'review.create',\n]);\n\nconst results = [];\n\nfor (const item of $input.all()) {\n  const update = item.json || {};\n  const message = update.message || update.edited_message;\n\n  // Ignore anything that is not a plain text message.\n  if (!message || !message.chat || typeof message.text !== 'string') continue;\n\n  const chatId = String(message.chat.id);\n  const messageId = message.message_id;\n  const text = message.text.trim();\n  if (!text) continue;\n\n  if (ALLOWED_CHAT_IDS.length && ALLOWED_CHAT_IDS.indexOf(chatId) === -1) {\n    results.push({\n      chatId,\n      messageId,\n      intent: 'denied',\n      hasApi: false,\n      api: null,\n      reply: '⛔ This bot is private.',\n      ctx: {},\n      tokenRefreshNeeded: false,\n      refreshToken: null,\n      refreshUrl: API_BASE_URL + '/api/auth/refresh',\n      deleteUserMessage: false,\n    });\n    continue;\n  }\n\n  if (!store.sessions[chatId]) store.sessions[chatId] = { stage: 'idle', draft: {} };\n  const session = store.sessions[chatId];\n  if (!session.draft) session.draft = {};\n\n  let plan = route(session, text);\n\n  // Attach credentials, or ask for a refresh before the call goes out.\n  let tokenRefreshNeeded = false;\n  if (plan.api && plan.api.auth) {\n    const stillValid =\n      session.accessToken && session.expiresAt && Date.now() < session.expiresAt;\n\n    if (stillValid) {\n      plan.api.headers.Authorization = 'Bearer ' + session.accessToken;\n    } else if (session.refreshToken) {\n      tokenRefreshNeeded = true;\n    } else {\n      plan = say('need_login', '🔒 Please /login first.');\n    }\n  }\n\n  results.push({\n    chatId,\n    messageId,\n    intent: plan.intent,\n    hasApi: Boolean(plan.api),\n    api: plan.api || null,\n    reply: plan.reply || null,\n    ctx: plan.ctx || {},\n    tokenRefreshNeeded,\n    refreshToken: session.refreshToken || null,\n    refreshUrl: API_BASE_URL + '/api/auth/refresh',\n    deleteUserMessage: Boolean(plan.sensitive),\n    accessTokenTtlMs: ACCESS_TOKEN_TTL_MS,\n    pageSize: PAGE_SIZE,\n  });\n}\n\nreturn results.map((json) => ({ json }));\n" }
  }
});

const credentialsCheck = ifElse({
  version: 2.2,
  config: {
    name: "Credentials in the message?",
    position: [260, 640],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: expr('{{ $json.deleteUserMessage }}'),
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      }
    }
  }
});

const deleteCredentialMessage = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Delete Credential Message',
    position: [520, 640],
    // Deleting fails in groups without admin rights, and on old messages.
    // That must never take the reply down with it.
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'message',
      operation: 'deleteMessage',
      chatId: expr('{{ $json.chatId }}'),
      messageId: expr('{{ $json.messageId }}')
    },
    credentials: { telegramApi: newCredential('Telegram Bot') }
  }
});

const tokenCheck = ifElse({
  version: 2.2,
  config: {
    name: "Access token expired?",
    position: [260, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: expr('{{ $json.tokenRefreshNeeded }}'),
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      }
    }
  }
});

const refreshToken = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Refresh Token',
    position: [520, 180],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $json.refreshUrl }}'),
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ refreshToken: $json.refreshToken }) }}'),
      options: { response: { response: { fullResponse: true, neverError: true } } }
    }
  }
});

const applyTokens = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Apply Tokens',
    position: [760, 180],
    parameters: { mode: 'runOnceForAllItems', jsCode: "// ─────────────────────────────────────────────────────────────────────────────\n// Apply Tokens — runs only when the access token had expired.\n// Takes the /api/auth/refresh response, stores the new pair, and puts the\n// Authorization header back onto the request the user actually asked for.\n// n8n Code node · mode \"Run Once for All Items\" · JavaScript\n// ─────────────────────────────────────────────────────────────────────────────\n\nconst store = $getWorkflowStaticData('global');\nif (!store.sessions) store.sessions = {};\n\nconst plan = $('Router').first().json;\nconst response = $input.first().json || {};\nconst status = response.statusCode;\nconst tokens =\n  response.body && response.body.result ? response.body.result : {};\n\nconst session = store.sessions[plan.chatId] || { stage: 'idle', draft: {} };\n\nif (status >= 200 && status < 300 && tokens.accessToken) {\n  session.accessToken = tokens.accessToken;\n  session.refreshToken = tokens.refreshToken || session.refreshToken;\n  session.expiresAt = Date.now() + (plan.accessTokenTtlMs || 14 * 60 * 1000);\n  store.sessions[plan.chatId] = session;\n\n  const api = Object.assign({}, plan.api);\n  api.headers = Object.assign({}, api.headers, {\n    Authorization: 'Bearer ' + tokens.accessToken,\n  });\n\n  return [{ json: Object.assign({}, plan, { api }) }];\n}\n\n// The 7-day refresh token is gone or the user was deleted — force a fresh login.\ndelete session.accessToken;\ndelete session.refreshToken;\ndelete session.expiresAt;\ndelete session.user;\nsession.stage = 'idle';\nsession.draft = {};\nstore.sessions[plan.chatId] = session;\n\nreturn [\n  {\n    json: Object.assign({}, plan, {\n      intent: 'session_expired',\n      hasApi: false,\n      api: null,\n      reply: '🔒 Your session expired. Please /login again.',\n    }),\n  },\n];\n" }
  }
});

const needsApi = ifElse({
  version: 2.2,
  config: {
    name: "Needs the API?",
    position: [1000, 380],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: expr('{{ $json.hasApi }}'),
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      }
    }
  }
});

const bookingApi = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Booking API',
    position: [1240, 280],
    onError: 'continueRegularOutput',
    parameters: {
      method: expr('{{ $json.api.method }}'),
      url: expr('{{ $json.api.url }}'),
      sendHeaders: true,
      specifyHeaders: 'json',
      jsonHeaders: expr('{{ JSON.stringify($json.api.headers || {}) }}'),
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.api.body || {}) }}'),
      // neverError keeps 4xx in the normal output so Format Reply can turn the
      // API's error envelope into a sentence instead of a red node.
      options: {
        response: { response: { fullResponse: true, neverError: true } },
        timeout: 15000
      }
    }
  }
});

const formatReply = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Reply',
    position: [1480, 280],
    parameters: { mode: 'runOnceForAllItems', jsCode: "// ─────────────────────────────────────────────────────────────────────────────\n// Format Reply — turns the API response into a Telegram message and updates\n// the session (tokens after login, numbered lists after every listing).\n// n8n Code node · mode \"Run Once for All Items\" · JavaScript\n// ─────────────────────────────────────────────────────────────────────────────\n\nconst store = $getWorkflowStaticData('global');\nif (!store.sessions) store.sessions = {};\n\nconst plan = $('Router').first().json;\nconst response = $input.first().json || {};\nconst status = Number(response.statusCode) || 0;\nconst payload = response.body || {};\nconst result = payload.result;\n\nconst session = store.sessions[plan.chatId] || { stage: 'idle', draft: {} };\nif (!session.draft) session.draft = {};\n\nconst esc = (value) =>\n  String(value === undefined || value === null ? '' : value)\n    .replace(/&/g, '&amp;')\n    .replace(/</g, '&lt;')\n    .replace(/>/g, '&gt;');\n\nconst money = (value) => Number(value || 0).toLocaleString('en-US');\n\n// Drops the conditional `null` entries while keeping '' — those are the blank\n// lines that give the message its paragraphs.\nconst lines = (parts) =>\n  parts.filter((part) => part !== null && part !== undefined).join('\\n');\n\nconst shortDate = (value) => String(value || '').slice(0, 10);\n\nconst done = (reply) => {\n  store.sessions[plan.chatId] = session;\n  return [{ json: { chatId: plan.chatId, intent: plan.intent, reply } }];\n};\n\n// ── Errors ───────────────────────────────────────────────────────────────────\n// No status at all means the HTTP node never got a reply — API down, wrong host.\nif (!status) {\n  return done('📡 I could not reach the booking service. Please try again in a moment.');\n}\n\nif (status < 200 || status >= 300) {\n  const meta = payload.meta || {};\n\n  // Errors are rendered through HttpDetailResponse, which folds `message` into\n  // `meta` — so the human-readable text is at meta.message, not the top level.\n  const apiMessage =\n    meta.message || payload.message || 'The booking service refused that.';\n\n  // 422 from ValidationMiddleware carries meta.payload; a raw ZodError carries meta.errors.\n  const fieldErrors = meta.payload && typeof meta.payload === 'object' ? meta.payload : null;\n  const details = fieldErrors\n    ? Object.entries(fieldErrors)\n        .map(([field, errors]) => '• ' + field + ': ' + [].concat(errors).join(', '))\n        .filter(Boolean)\n    : Array.isArray(meta.errors)\n      ? meta.errors.map(\n          (issue) =>\n            '• ' +\n            (Array.isArray(issue.path) && issue.path.length ? issue.path.join('.') + ': ' : '') +\n            issue.message\n        )\n      : [];\n\n  // errorKinds.notAuthorized maps to 401 but invalidToken maps to 403, and a\n  // plain permission denial is 403 too — so tell them apart by the message.\n  const sessionDead =\n    status === 401 || (status === 403 && /token|not authenticated/i.test(apiMessage));\n\n  if (sessionDead) {\n    delete session.accessToken;\n    delete session.refreshToken;\n    delete session.expiresAt;\n    delete session.user;\n    session.stage = 'idle';\n    return done('🔒 ' + esc(apiMessage) + '\\nPlease /login again.');\n  }\n\n  if (status === 429) {\n    return done('🐢 Too many requests — the API allows 100 per 15 minutes. Try again shortly.');\n  }\n\n  const heading =\n    status === 403 ? '⛔ ' : status === 404 ? '🔍 ' : status === 409 ? '🚫 ' : status >= 500 ? '💥 ' : '⚠️ ';\n\n  // A 409 on a booking is an availability clash, not a mistake in their input.\n  const hint =\n    status === 409 && plan.intent === 'bookings.create'\n      ? 'Those dates are taken. Run /hotel again and book with different dates.'\n      : null;\n\n  return done(\n    lines(\n      [heading + esc(apiMessage)]\n        .concat(details.length ? [''].concat(details.map(esc)) : [])\n        .concat(hint ? ['', hint] : [])\n    )\n  );\n}\n\n// ── Auth ─────────────────────────────────────────────────────────────────────\nif (plan.intent === 'auth.login' || plan.intent === 'auth.register') {\n  session.accessToken = result.accessToken;\n  session.refreshToken = result.refreshToken;\n  session.expiresAt = Date.now() + (plan.accessTokenTtlMs || 14 * 60 * 1000);\n  session.user = result.user;\n  session.stage = 'idle';\n  session.draft = {};\n\n  const verb = plan.intent === 'auth.register' ? 'Account created' : 'Signed in';\n  return done(\n    lines([\n      '✅ <b>' + verb + '</b> — welcome, ' + esc(result.user.firstName) + '!',\n      'Role: <code>' + esc(result.user.role) + '</code>',\n      '',\n      'Next: /hotels to browse, /mybookings to review what you have.',\n    ])\n  );\n}\n\nif (plan.intent === 'auth.me') {\n  session.user = result;\n  return done(\n    lines([\n      '👤 <b>' + esc(result.firstName) + ' ' + esc(result.lastName) + '</b>',\n      '📧 ' + esc(result.email),\n      '🔖 role <code>' + esc(result.role) + '</code>',\n      result.phoneNumber ? '📞 ' + esc(result.phoneNumber) : null,\n    ])\n  );\n}\n\n// ── Hotels ───────────────────────────────────────────────────────────────────\nif (plan.intent === 'hotels.list') {\n  const hotels = Array.isArray(result) ? result : [];\n  session.hotels = hotels.map((hotel) => ({\n    id: hotel.id,\n    name: hotel.name,\n    city: hotel.city,\n  }));\n\n  if (!hotels.length) {\n    return done(\n      plan.ctx.city\n        ? '🔍 No hotels in <b>' + esc(plan.ctx.city) + '</b>. Try /hotels with no filter.'\n        : '🔍 No hotels yet.'\n    );\n  }\n\n  const total = Number(payload.count || hotels.length);\n  const pageSize = plan.ctx.pageSize || hotels.length;\n  const lastPage = Math.max(1, Math.ceil(total / pageSize));\n\n  const hotelLines = hotels.map((hotel, i) => {\n    const stars = hotel.rating ? ' ⭐ ' + hotel.rating : '';\n    return (\n      i + 1 + '. <b>' + esc(hotel.name) + '</b>' + stars +\n      '\\n    ' + esc(hotel.city) + ', ' + esc(hotel.country)\n    );\n  });\n\n  return done(\n    lines([\n      '🏨 <b>Hotels</b> — page ' + plan.ctx.page + ' of ' + lastPage + ' (' + total + ' total)',\n      plan.ctx.city ? '<i>filtered by city: ' + esc(plan.ctx.city) + '</i>' : null,\n      '',\n      hotelLines.join('\\n'),\n      '',\n      'Open one with <code>/hotel 1</code>' +\n        (plan.ctx.page < lastPage\n          ? ', next page <code>/hotels ' +\n            esc([plan.ctx.city, plan.ctx.page + 1].filter(Boolean).join(' ')) +\n            '</code>'\n          : ''),\n    ])\n  );\n}\n\nif (plan.intent === 'hotel.detail') {\n  const hotel = result;\n  const typesById = {};\n  for (const type of hotel.roomTypes || []) typesById[type.id] = type;\n\n  const rooms = (hotel.rooms || [])\n    .slice()\n    .sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), 'en', { numeric: true }))\n    .slice(0, 10)\n    .map((room) => {\n      const type = typesById[room.roomTypeId] || {};\n      return {\n        id: room.id,\n        hotelId: hotel.id,\n        hotelName: hotel.name,\n        label: 'Room ' + room.roomNumber + (type.name ? ' · ' + type.name : ''),\n        price: type.basePrice,\n        occupancy: type.maxOccupancy,\n        status: room.status,\n      };\n    });\n\n  session.rooms = rooms;\n\n  const amenities = (hotel.amenities || [])\n    .map((link) => link.amenity && link.amenity.name)\n    .filter(Boolean);\n\n  const roomLines = rooms.length\n    ? rooms.map((room, i) => {\n        const flag = room.status && room.status !== 'AVAILABLE' ? ' · ' + room.status : '';\n        return (\n          i + 1 + '. <b>' + esc(room.label) + '</b>' + esc(flag) +\n          '\\n    from ' + money(room.price) + ' / night · up to ' + esc(room.occupancy) + ' guests'\n        );\n      })\n    : ['<i>No rooms listed for this hotel.</i>'];\n\n  return done(\n    lines([\n      '🏨 <b>' + esc(hotel.name) + '</b>' + (hotel.rating ? ' ⭐ ' + hotel.rating : ''),\n      '📍 ' + esc(hotel.addressLine) + ', ' + esc(hotel.city) + ', ' + esc(hotel.country),\n      hotel.description ? '\\n' + esc(hotel.description) : null,\n      amenities.length ? '\\n✨ ' + esc(amenities.join(', ')) : null,\n      '',\n      '<b>Rooms</b>',\n      roomLines.join('\\n'),\n      '',\n      'Book with <code>/book 1</code> — I will ask for the dates.',\n      '<i>Prices shown are the base rate; seasonal rates may apply at booking.</i>',\n    ])\n  );\n}\n\n// ── Bookings ─────────────────────────────────────────────────────────────────\nif (plan.intent === 'bookings.create') {\n  const booking = result;\n  const stay = (booking.rooms || [])[0] || {};\n  const payment = (booking.payments || [])[0];\n\n  session.draft = {};\n  session.stage = 'idle';\n\n  return done(\n    lines([\n      '🎉 <b>Booking created</b>',\n      '',\n      'Code: <code>' + esc(booking.bookingCode) + '</code>',\n      'Hotel: ' + esc((booking.hotel && booking.hotel.name) || plan.ctx.hotelName),\n      'Room: ' + esc(plan.ctx.roomLabel),\n      'Stay: ' + esc(shortDate(stay.checkInDate)) + ' → ' + esc(shortDate(stay.checkOutDate)),\n      'Total: <b>' + money(booking.totalAmount) + '</b>',\n      'Status: <code>' + esc(booking.status) + '</code>',\n      payment ? 'Payment: ' + esc(payment.paymentMethod) + ' · ' + esc(payment.status) : null,\n      '',\n      'Reception confirms it and settles the payment. Track it with /mybookings.',\n    ])\n  );\n}\n\nif (plan.intent === 'bookings.list') {\n  const bookings = Array.isArray(result) ? result : [];\n  session.bookings = bookings.map((booking) => ({\n    id: booking.id,\n    code: booking.bookingCode,\n    status: booking.status,\n    hotelName: booking.hotel && booking.hotel.name,\n  }));\n\n  if (!bookings.length) {\n    return done('📭 No bookings yet. Start with /hotels.');\n  }\n\n  const bookingLines = bookings.map((booking, i) => {\n    const stay = (booking.rooms || [])[0] || {};\n    const payment = (booking.payments || [])[0];\n    return lines([\n      i + 1 + '. <code>' + esc(booking.bookingCode) + '</code> · <b>' + esc(booking.status) + '</b>',\n      '    ' + esc((booking.hotel && booking.hotel.name) || 'Unknown hotel'),\n      '    ' + esc(shortDate(stay.checkInDate)) + ' → ' + esc(shortDate(stay.checkOutDate)) +\n        ' · ' + money(booking.totalAmount),\n      payment ? '    💳 ' + esc(payment.paymentMethod) + ' · ' + esc(payment.status) : null,\n    ]);\n  });\n\n  return done(\n    lines([\n      '🧾 <b>Your bookings</b> (' + Number(payload.count || bookings.length) + ')',\n      '',\n      bookingLines.join('\\n\\n'),\n      '',\n      'Cancel with <code>/cancel 1</code> · review a finished stay with <code>/review 1 5</code>',\n    ])\n  );\n}\n\nif (plan.intent === 'bookings.cancel') {\n  const cancelled = (session.bookings || []).find((b) => b.id === result.id);\n  if (cancelled) cancelled.status = result.status;\n\n  return done(\n    lines([\n      '🚫 <b>Booking cancelled</b>',\n      'Code: <code>' + esc(result.bookingCode) + '</code>',\n      'Status: <code>' + esc(result.status) + '</code>',\n      '',\n      'The room is bookable again straight away.',\n    ])\n  );\n}\n\n// ── Reviews ──────────────────────────────────────────────────────────────────\nif (plan.intent === 'review.create') {\n  session.draft = {};\n  session.stage = 'idle';\n\n  const hotel = result.hotel || {};\n  return done(\n    lines([\n      '⭐ <b>Thanks for the review!</b>',\n      'Rating: ' + esc(result.rating) + '/5',\n      result.comment ? 'Comment: ' + esc(result.comment) : null,\n      hotel.name ? '\\n' + esc(hotel.name) + ' now averages ⭐ ' + esc(hotel.rating) : null,\n    ])\n  );\n}\n\n// ── Fallback ─────────────────────────────────────────────────────────────────\nreturn done('✅ ' + esc((payload.meta && payload.meta.message) || payload.message || 'Done.'));\n" }
  }
});

const sendReply = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Reply',
    position: [1740, 380],
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.chatId }}'),
      text: expr('{{ $json.reply }}'),
      additionalFields: {
        appendAttribution: false,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }
    },
    credentials: { telegramApi: newCredential('Telegram Bot') }
  }
});

export default workflow('hotel-booking-telegram-bot', 'Hotel Booking — Telegram Bot')
  .add(telegramTrigger)
  .to(router)
  .add(router)
  .to(credentialsCheck.onTrue(deleteCredentialMessage))
  .add(router)
  .to(tokenCheck
    .onTrue(refreshToken.to(applyTokens).to(needsApi))
    .onFalse(needsApi))
  .add(needsApi
    .onTrue(bookingApi.to(formatReply).to(sendReply))
    .onFalse(sendReply));
