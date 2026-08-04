/**
 * Emits the same workflow as build.mjs, but as n8n Workflow SDK code, which is
 * what the n8n MCP server's validate_workflow / create_workflow_from_code take.
 * The Code-node bodies come from nodes/*.js, so both outputs stay in sync.
 *
 *   node n8n/build-sdk.mjs        → writes n8n/hotel-booking-telegram-bot.sdk.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const code = (name) => JSON.stringify(readFileSync(join(here, 'nodes', name), 'utf8'));

// A boolean IF: "is this flag true?"
const boolIf = (name, flag, position) => `ifElse({
  version: 2.2,
  config: {
    name: ${JSON.stringify(name)},
    position: [${position}],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: expr('{{ $json.${flag} }}'),
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      }
    }
  }
})`;

// A string-equals IF.
const equalsIf = (name, flag, value, position) => `ifElse({
  version: 2.2,
  config: {
    name: ${JSON.stringify(name)},
    position: [${position}],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            leftValue: expr('{{ $json.${flag} }}'),
            rightValue: ${JSON.stringify(value)},
            operator: { type: 'string', operation: 'equals' }
          }
        ],
        combinator: 'and'
      }
    }
  }
})`;

const sdk = `import { workflow, node, trigger, ifElse, merge, newCredential, expr } from '@n8n/workflow-sdk';

// Telegram → Router → (answer inline-keyboard callback) → menu or the existing
// API chain. Callback data is treated as the equivalent slash command, so the
// buttons reuse the same intents/formatting as typed commands.

const telegramTrigger = trigger({
  type: 'n8n-nodes-base.telegramTrigger',
  version: 1.4,
  config: {
    name: 'Telegram Trigger',
    position: [-220, 380],
    parameters: { updates: ['message', 'callback_query'] },
    credentials: { telegramApi: newCredential('Telegram Bot') }
  }
});

const router = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Router',
    position: [20, 380],
    parameters: { mode: 'runOnceForAllItems', jsCode: ${code('router.js')} }
  }
});

const isCallback = ${boolIf('Is Callback?', 'isCallback', '260, 200')};

const answerCallback = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Answer Callback',
    position: [520, 120],
    // Answering can fail for old callbacks; it must not kill the response.
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'callback',
      operation: 'answerQuery',
      queryId: expr('{{ $json.callbackQueryId }}'),
      additionalFields: {}
    },
    credentials: { telegramApi: newCredential('Telegram Bot') }
  }
});

const mergeAfterCallback = merge({
  version: 3.2,
  config: {
    name: 'Merge',
    position: [520, 300],
    parameters: { mode: 'append' }
  }
});

const isStartMenu = ${equalsIf('Is /start menu?', 'intent', 'menu.start', '760, 300')};

const sendStartMenu = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Start Menu',
    position: [1000, 300],
    credentials: { telegramApi: newCredential('Telegram Bot') },
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.chatId }}'),
      text: '<b>🏨 Hotel Booking Bot</b>\\n\\nWhat would you like to do?',
      replyMarkup: 'inlineKeyboard',
      inlineKeyboard: {
        rows: [
          {
            row: {
              buttons: [
                { text: '🏨 Hotels', additionalFields: { callback_data: 'hotels' } },
                { text: '📋 My Bookings', additionalFields: { callback_data: 'mybookings' } }
              ]
            }
          },
          {
            row: {
              buttons: [
                { text: '👤 Me', additionalFields: { callback_data: 'me' } },
                { text: '🔑 Login', additionalFields: { callback_data: 'login' } }
              ]
            }
          }
        ]
      },
      additionalFields: {
        parse_mode: 'HTML',
        appendAttribution: false,
        disable_web_page_preview: true
      }
    }
  }
});

const credentialsCheck = ${boolIf('Credentials in the message?', 'deleteUserMessage', '1000, 520')};

const deleteCredentialMessage = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Delete Credential Message',
    position: [1240, 520],
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

const tokenCheck = ${boolIf('Access token expired?', 'tokenRefreshNeeded', '1000, 380')};

const refreshToken = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Refresh Token',
    position: [1240, 260],
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
    position: [1480, 260],
    parameters: { mode: 'runOnceForAllItems', jsCode: ${code('apply-tokens.js')} }
  }
});

const needsApi = ${boolIf('Needs the API?', 'hasApi', '1720, 380')};

const bookingApi = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Booking API',
    position: [1960, 280],
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
    position: [2200, 280],
    parameters: { mode: 'runOnceForAllItems', jsCode: ${code('format-reply.js')} }
  }
});

const sendReply = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Reply',
    position: [2440, 380],
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
  .to(isCallback
    .onTrue(answerCallback.to(mergeAfterCallback.input(0)))
    .onFalse(mergeAfterCallback.input(1)))
  .add(mergeAfterCallback)
  .to(isStartMenu
    .onTrue(sendStartMenu)
    .onFalse(credentialsCheck.onTrue(deleteCredentialMessage)))
  .add(mergeAfterCallback)
  .to(isStartMenu
    .onFalse(tokenCheck
      .onTrue(refreshToken.to(applyTokens).to(needsApi))
      .onFalse(needsApi)))
  .add(needsApi
    .onTrue(bookingApi.to(formatReply).to(sendReply))
    .onFalse(sendReply));
`;

const target = join(here, 'hotel-booking-telegram-bot.sdk.js');
writeFileSync(target, sdk, 'utf8');
console.log('wrote ' + target + ' (' + sdk.length + ' chars)');
