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

const sdk = `import { workflow, node, trigger, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

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
    parameters: { mode: 'runOnceForAllItems', jsCode: ${code('router.js')} }
  }
});

const credentialsCheck = ${boolIf('Credentials in the message?', 'deleteUserMessage', '260, 640')};

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

const tokenCheck = ${boolIf('Access token expired?', 'tokenRefreshNeeded', '260, 300')};

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
    parameters: { mode: 'runOnceForAllItems', jsCode: ${code('apply-tokens.js')} }
  }
});

const needsApi = ${boolIf('Needs the API?', 'hasApi', '1000, 380')};

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
    parameters: { mode: 'runOnceForAllItems', jsCode: ${code('format-reply.js')} }
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
`;

const target = join(here, 'hotel-booking-telegram-bot.sdk.js');
writeFileSync(target, sdk, 'utf8');
console.log('wrote ' + target + ' (' + sdk.length + ' chars)');
