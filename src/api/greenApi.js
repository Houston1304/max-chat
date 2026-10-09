/**
 * Клиент GREEN-API для мессенджера MAX.
 *
 * Используемые методы API:
 *  - getStateInstance  — проверка учётных данных и состояния инстанса
 *  - setSettings       — включение получения уведомлений через HTTP API
 *  - checkAccount      — получение chatId по номеру телефона (создание чата)
 *  - sendMessage       — отправка текстового сообщения
 *  - receiveNotification — получение входящих уведомлений (HTTP API)
 *  - deleteNotification  — подтверждение обработки уведомления
 *
 * Документация: https://green-api.com/v3/docs/api/
 */
const API_URL = 'https://api.green-api.com';

const REQUEST_TIMEOUT = 70000;

function endpoint(creds, method) {
  return `${API_URL}/waInstance${creds.idInstance}/${method}/${creds.apiTokenInstance}`;
}

async function request(url, { method = 'GET', body, timeout = REQUEST_TIMEOUT } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Превышено время ожидания ответа GREEN-API' : 'Нет связи с GREEN-API');
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      (data && (data.message || data.reason || data.error)) || `Ошибка GREEN-API (HTTP ${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export function getStateInstance(creds) {
  return request(endpoint(creds, 'getStateInstance'));
}


export function setSettings(creds) {
  return request(endpoint(creds, 'setSettings'), {
    method: 'POST',
    body: {
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'yes',
      stateWebhook: 'yes',
    },
  });
}


export function checkAccount(creds, phoneNumber) {
  return request(endpoint(creds, 'checkAccount'), {
    method: 'POST',
    body: { phoneNumber },
  });
}

export function sendMessage(creds, chatId, message) {
  return request(endpoint(creds, 'sendMessage'), {
    method: 'POST',
    body: { chatId, message },
  });
}

export async function receiveNotification(creds, receiveTimeout = 30) {
  return request(`${endpoint(creds, 'receiveNotification')}?receiveTimeout=${receiveTimeout}`, {
    timeout: (receiveTimeout + 10) * 1000,
  });
}

export function deleteNotification(creds, receiptId) {
  return request(`${endpoint(creds, 'deleteNotification')}/${receiptId}`, { method: 'DELETE' });
}
