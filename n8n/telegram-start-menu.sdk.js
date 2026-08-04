import { workflow, node, trigger, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

// Telegram /start handler that sends a welcome message with an Inline Keyboard.
// Listens for both text messages and callback_query updates from inline buttons.

const telegramTrigger = trigger({
  type: 'n8n-nodes-base.telegramTrigger',
  version: 1.5,
  config: {
    name: 'Telegram Trigger',
    position: [-220, 300],
    parameters: { updates: ['message', 'callback_query'] },
    credentials: { telegramApi: newCredential('Telegram Bot') }
  }
});

const parseUpdate = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Update',
    position: [20, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const update = $input.first().json || {};

const isCallback = !!update.callback_query;
const chatId = isCallback
  ? update.callback_query?.message?.chat?.id
  : update.message?.chat?.id;
const messageId = isCallback
  ? update.callback_query?.message?.message_id
  : update.message?.message_id;
const text = isCallback
  ? update.callback_query?.data
  : (update.message?.text || '').trim();
const username = isCallback
  ? update.callback_query?.from?.username
  : update.message?.from?.username;

return [{
  json: {
    chatId,
    messageId,
    text,
    username,
    isCallback,
    callbackQueryId: update.callback_query?.id
  }
}];`
    }
  }
});

const isStart = ifElse({
  version: 2.3,
  config: {
    name: 'Is /start?',
    position: [260, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: false, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            leftValue: expr('{{ $json.text }}'),
            rightValue: '/start',
            operator: { type: 'string', operation: 'equals' }
          }
        ],
        combinator: 'and'
      }
    }
  }
});

const isCallbackCheck = ifElse({
  version: 2.3,
  config: {
    name: 'Is Callback?',
    position: [260, 520],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            leftValue: expr('{{ $json.isCallback }}'),
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true }
          }
        ],
        combinator: 'and'
      }
    }
  }
});

const sendStartMenu = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Start Menu',
    position: [520, 300],
    credentials: { telegramApi: newCredential('Telegram Bot') },
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.chatId }}'),
      text: '<b>Welcome to the Hotel Booking Bot!</b>\n\nChoose an option below:',
      replyMarkup: 'inlineKeyboard',
      inlineKeyboard: {
        rows: [
          {
            row: {
              buttons: [
                { text: '❓ FAQ', additionalFields: { callback_data: 'faq' } },
                { text: '📖 Instructions', additionalFields: { callback_data: 'instructions' } }
              ]
            }
          },
          {
            row: {
              buttons: [
                { text: '💬 Group Chat', additionalFields: { url: 'https://t.me/yourgroup' } },
                { text: '💬 Contact Me', additionalFields: { url: 'https://t.me/yourusername' } }
              ]
            }
          },
          {
            row: {
              buttons: [
                { text: '👤 Login', additionalFields: { callback_data: 'login' } }
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

const buildCallbackResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Callback Response',
    position: [520, 520],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const item = $input.first().json || {};
const data = item.text || '';
let answerText = '';
let showAlert = false;

switch (data) {
  case 'faq':
    answerText = 'Here are the most common questions...';
    break;
  case 'instructions':
    answerText = 'Instructions will be sent shortly.';
    break;
  case 'login':
    answerText = 'Please use /login to sign in.';
    break;
  default:
    answerText = 'Unknown option.';
}

return [{
  json: {
    chatId: item.chatId,
    queryId: item.callbackQueryId,
    answerText,
    showAlert
  }
}];`
    }
  }
});

const answerCallback = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Answer Callback',
    position: [760, 520],
    onError: 'continueRegularOutput',
    credentials: { telegramApi: newCredential('Telegram Bot') },
    parameters: {
      resource: 'callback',
      operation: 'answerQuery',
      queryId: expr('{{ $json.queryId }}'),
      additionalFields: {
        text: expr('{{ $json.answerText }}'),
        show_alert: expr('{{ $json.showAlert }}')
      }
    }
  }
});

const sendCallbackMessage = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Send Callback Message',
    position: [1000, 520],
    onError: 'continueRegularOutput',
    credentials: { telegramApi: newCredential('Telegram Bot') },
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr('{{ $json.chatId }}'),
      text: expr('{{ $json.answerText }}'),
      additionalFields: {
        parse_mode: 'HTML',
        appendAttribution: false,
        disable_web_page_preview: true
      }
    }
  }
});

export default workflow('telegram-start-menu', 'Telegram Start Menu with Inline Keyboard')
  .add(telegramTrigger)
  .to(parseUpdate)
  .to(isStart
    .onTrue(sendStartMenu)
    .onFalse(isCallbackCheck
      .onTrue(buildCallbackResponse.to(answerCallback).to(sendCallbackMessage))
      .onFalse()));
