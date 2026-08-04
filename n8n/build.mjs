/**
 * Assembles n8n/hotel-booking-telegram-bot.json from the Code-node sources in
 * n8n/nodes/. Keeping the JS out of the JSON is the only way to review or diff
 * it — run this after editing any file under nodes/.
 *
 *   node n8n/build.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const code = (name) => readFileSync(join(here, 'nodes', name), 'utf8');

const codeNode = (name, id, position, file) => ({
  parameters: { mode: 'runOnceForAllItems', jsCode: code(file) },
  id,
  name,
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position,
});

const boolCondition = (id, expression) => ({
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
  conditions: [
    {
      id,
      leftValue: expression,
      rightValue: '',
      operator: { type: 'boolean', operation: 'true', singleValue: true },
    },
  ],
  combinator: 'and',
});

const equalsCondition = (id, expression, value) => ({
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
  conditions: [
    {
      id,
      leftValue: expression,
      rightValue: value,
      operator: { type: 'string', operation: 'equals' },
    },
  ],
  combinator: 'and',
});

const workflow = {
  name: 'Hotel Booking — Telegram Bot',
  nodes: [
    {
      parameters: { updates: ['message', 'callback_query'], additionalFields: {} },
      id: 'a1000000-0000-4000-8000-000000000001',
      name: 'Telegram Trigger',
      type: 'n8n-nodes-base.telegramTrigger',
      typeVersion: 1.2,
      position: [-220, 380],
      webhookId: 'c0ffee00-0000-4000-8000-00000000cafe',
    },

    codeNode('Router', 'a1000000-0000-4000-8000-000000000002', [20, 380], 'router.js'),

    {
      parameters: {
        conditions: boolCondition(
          'b0000000-0000-4000-8000-000000000004',
          '={{ $json.isCallback }}'
        ),
        looseTypeValidation: true,
        options: {},
      },
      id: 'a1000000-0000-4000-8000-000000000003',
      name: 'Is Callback?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [260, 200],
    },
    {
      parameters: {
        resource: 'callback',
        operation: 'answerQuery',
        queryId: '={{ $json.callbackQueryId }}',
        additionalFields: {},
      },
      id: 'a1000000-0000-4000-8000-000000000004',
      name: 'Answer Callback',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [520, 120],
      // Answering can fail for old callbacks; it must not kill the response.
      onError: 'continueRegularOutput',
    },
    {
      parameters: { mode: 'append' },
      id: 'a1000000-0000-4000-8000-000000000005',
      name: 'Merge',
      type: 'n8n-nodes-base.merge',
      typeVersion: 3.2,
      position: [520, 300],
    },
    {
      parameters: {
        conditions: equalsCondition(
          'b0000000-0000-4000-8000-000000000005',
          '={{ $json.intent }}',
          'menu.start'
        ),
        looseTypeValidation: true,
        options: {},
      },
      id: 'a1000000-0000-4000-8000-000000000006',
      name: 'Is /start menu?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [760, 300],
    },
    {
      parameters: {
        resource: 'message',
        operation: 'sendMessage',
        chatId: '={{ $json.chatId }}',
        text: '<b>🏨 Hotel Booking Bot</b>\n\nWhat would you like to do?',
        replyMarkup: 'inlineKeyboard',
        inlineKeyboard: {
          rows: [
            {
              row: {
                buttons: [
                  { text: '🏨 Hotels', additionalFields: { callback_data: 'hotels' } },
                  { text: '📋 My Bookings', additionalFields: { callback_data: 'mybookings' } },
                ],
              },
            },
            {
              row: {
                buttons: [
                  { text: '👤 Me', additionalFields: { callback_data: 'me' } },
                  { text: '🔑 Login', additionalFields: { callback_data: 'login' } },
                ],
              },
            },
          ],
        },
        additionalFields: {
          parse_mode: 'HTML',
          appendAttribution: false,
          disable_web_page_preview: true,
        },
      },
      id: 'a1000000-0000-4000-8000-000000000007',
      name: 'Send Start Menu',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [1000, 300],
    },

    {
      parameters: {
        conditions: boolCondition(
          'b0000000-0000-4000-8000-000000000001',
          '={{ $json.deleteUserMessage }}'
        ),
        looseTypeValidation: true,
        options: {},
      },
      id: 'a1000000-0000-4000-8000-000000000008',
      name: 'Credentials in the message?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1000, 520],
    },
    {
      parameters: {
        resource: 'message',
        operation: 'deleteMessage',
        chatId: '={{ $json.chatId }}',
        messageId: '={{ $json.messageId }}',
      },
      id: 'a1000000-0000-4000-8000-000000000009',
      name: 'Delete Credential Message',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [1240, 520],
      // Deleting fails in groups without admin rights, and on old messages.
      // That must never take the reply down with it.
      onError: 'continueRegularOutput',
    },

    {
      parameters: {
        conditions: boolCondition(
          'b0000000-0000-4000-8000-000000000002',
          '={{ $json.tokenRefreshNeeded }}'
        ),
        looseTypeValidation: true,
        options: {},
      },
      id: 'a1000000-0000-4000-8000-00000000000a',
      name: 'Access token expired?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1000, 380],
    },
    {
      parameters: {
        method: 'POST',
        url: '={{ $json.refreshUrl }}',
        sendBody: true,
        contentType: 'json',
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ refreshToken: $json.refreshToken }) }}',
        options: { response: { response: { fullResponse: true, neverError: true } } },
      },
      id: 'a1000000-0000-4000-8000-00000000000b',
      name: 'Refresh Token',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1240, 260],
      onError: 'continueRegularOutput',
    },

    codeNode(
      'Apply Tokens',
      'a1000000-0000-4000-8000-00000000000c',
      [1480, 260],
      'apply-tokens.js'
    ),

    {
      parameters: {
        conditions: boolCondition(
          'b0000000-0000-4000-8000-000000000003',
          '={{ $json.hasApi }}'
        ),
        looseTypeValidation: true,
        options: {},
      },
      id: 'a1000000-0000-4000-8000-00000000000d',
      name: 'Needs the API?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [1720, 380],
    },
    {
      parameters: {
        method: '={{ $json.api.method }}',
        url: '={{ $json.api.url }}',
        sendHeaders: true,
        specifyHeaders: 'json',
        jsonHeaders: '={{ JSON.stringify($json.api.headers || {}) }}',
        sendBody: true,
        contentType: 'json',
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify($json.api.body || {}) }}',
        options: {
          // neverError keeps 4xx in the normal output so Format Reply can turn
          // the API's error envelope into a sentence instead of a red node.
          response: { response: { fullResponse: true, neverError: true } },
          timeout: 15000,
        },
      },
      id: 'a1000000-0000-4000-8000-00000000000e',
      name: 'Booking API',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [1960, 280],
      onError: 'continueRegularOutput',
    },

    codeNode(
      'Format Reply',
      'a1000000-0000-4000-8000-00000000000f',
      [2200, 280],
      'format-reply.js'
    ),

    {
      parameters: {
        chatId: '={{ $json.chatId }}',
        text: '={{ $json.reply }}',
        additionalFields: {
          appendAttribution: false,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        },
      },
      id: 'a1000000-0000-4000-8000-000000000010',
      name: 'Send Reply',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [2440, 380],
    },
  ],

  connections: {
    'Telegram Trigger': { main: [[{ node: 'Router', type: 'main', index: 0 }]] },
    Router: { main: [[{ node: 'Is Callback?', type: 'main', index: 0 }]] },
    'Is Callback?': {
      main: [
        [{ node: 'Answer Callback', type: 'main', index: 0 }],
        [{ node: 'Merge', type: 'main', index: 1 }],
      ],
    },
    'Answer Callback': { main: [[{ node: 'Merge', type: 'main', index: 0 }]] },
    Merge: { main: [[{ node: 'Is /start menu?', type: 'main', index: 0 }]] },
    'Is /start menu?': {
      main: [
        [{ node: 'Send Start Menu', type: 'main', index: 0 }],
        [
          { node: 'Access token expired?', type: 'main', index: 0 },
          { node: 'Credentials in the message?', type: 'main', index: 0 },
        ],
      ],
    },
    'Credentials in the message?': {
      main: [[{ node: 'Delete Credential Message', type: 'main', index: 0 }], []],
    },
    'Access token expired?': {
      main: [
        [{ node: 'Refresh Token', type: 'main', index: 0 }],
        [{ node: 'Needs the API?', type: 'main', index: 0 }],
      ],
    },
    'Refresh Token': { main: [[{ node: 'Apply Tokens', type: 'main', index: 0 }]] },
    'Apply Tokens': { main: [[{ node: 'Needs the API?', type: 'main', index: 0 }]] },
    'Needs the API?': {
      main: [
        [{ node: 'Booking API', type: 'main', index: 0 }],
        [{ node: 'Send Reply', type: 'main', index: 0 }],
      ],
    },
    'Booking API': { main: [[{ node: 'Format Reply', type: 'main', index: 0 }]] },
    'Format Reply': { main: [[{ node: 'Send Reply', type: 'main', index: 0 }]] },
  },

  settings: { executionOrder: 'v1' },
  pinData: {},
};

const target = join(here, 'hotel-booking-telegram-bot.json');
writeFileSync(target, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log('wrote ' + target + ' (' + workflow.nodes.length + ' nodes)');
