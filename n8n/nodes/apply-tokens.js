// ─────────────────────────────────────────────────────────────────────────────
// Apply Tokens — runs only when the access token had expired.
// Takes the /api/auth/refresh response, stores the new pair, and puts the
// Authorization header back onto the request the user actually asked for.
// n8n Code node · mode "Run Once for All Items" · JavaScript
// ─────────────────────────────────────────────────────────────────────────────

const store = $getWorkflowStaticData('global');
if (!store.sessions) store.sessions = {};

const plan = $('Router').first().json;
const response = $input.first().json || {};
const status = response.statusCode;
const tokens =
  response.body && response.body.result ? response.body.result : {};

const session = store.sessions[plan.chatId] || { stage: 'idle', draft: {} };

if (status >= 200 && status < 300 && tokens.accessToken) {
  session.accessToken = tokens.accessToken;
  session.refreshToken = tokens.refreshToken || session.refreshToken;
  session.expiresAt = Date.now() + (plan.accessTokenTtlMs || 14 * 60 * 1000);
  store.sessions[plan.chatId] = session;

  const api = Object.assign({}, plan.api);
  api.headers = Object.assign({}, api.headers, {
    Authorization: 'Bearer ' + tokens.accessToken,
  });

  return [{ json: Object.assign({}, plan, { api }) }];
}

// The 7-day refresh token is gone or the user was deleted — force a fresh login.
delete session.accessToken;
delete session.refreshToken;
delete session.expiresAt;
delete session.user;
session.stage = 'idle';
session.draft = {};
store.sessions[plan.chatId] = session;

return [
  {
    json: Object.assign({}, plan, {
      intent: 'session_expired',
      hasApi: false,
      api: null,
      reply: '🔒 Your session expired. Please /login again.',
    }),
  },
];
