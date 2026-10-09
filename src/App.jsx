import { useEffect, useMemo, useRef, useState } from 'react';
import LoginScreen from './components/LoginScreen.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatView from './components/ChatView.jsx';
import {
  checkAccount,
  deleteNotification,
  getStateInstance,
  receiveNotification,
  sendMessage,
  setSettings,
} from './api/greenApi.js';
import { formatPhone, load, remove, save } from './storage.js';

const KEYS = {
  creds: 'maxchat.creds',
  chats: 'maxchat.chats',
  messages: 'maxchat.messages',
  active: 'maxchat.active',
};

/**
 * Long-polling входящих уведомлений.
 * receiveTimeout по документации GREEN-API — от 5 до 60 секунд: уведомление
 * возвращается сразу, как только оно появилось в очереди, таймаут лишь держит
 * соединение открытым. Лимит ReceiveNotification — 100 запросов/сек на инстанс.
 */
const POLL_RECEIVE_TIMEOUT = 30; // секунд ожидания уведомления на сервере
const POLL_MIN_INTERVAL = 1000; // мин. пауза между запросами, если сервер ответил мгновенно

function withPreviews(chats, messages) {
  return chats
    .map((chat) => {
      const list = messages[chat.chatId] || [];
      const last = list[list.length - 1];
      return {
        ...chat,
        lastText: last ? last.text : '',
        lastTime: last ? last.time : chat.createdAt,
        unread: 0,
      };
    })
    .sort((a, b) => b.lastTime - a.lastTime);
}

export default function App() {
  const [creds, setCreds] = useState(() => load(KEYS.creds));
  const [chats, setChats] = useState(() => load(KEYS.chats, []));
  const [messages, setMessages] = useState(() => load(KEYS.messages, {}));
  const [activeId, setActiveId] = useState(() => (creds ? load(KEYS.active) : null));
  const [instanceState, setInstanceState] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    save(KEYS.active, activeId);
  }, [activeId]);

  useEffect(() => {
    save(KEYS.chats, chats);
  }, [chats]);

  useEffect(() => {
    save(KEYS.messages, messages);
  }, [messages]);

  function addMessage(chatId, message) {
    setMessages((prev) => {
      const list = prev[chatId] || [];
      if (message.id && list.some((m) => m.id === message.id)) return prev;
      return { ...prev, [chatId]: [...list, message] };
    });
  }

  function patchMessage(chatId, messageId, patch) {
    setMessages((prev) => ({
      ...prev,
      [chatId]: (prev[chatId] || []).map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
    }));
  }

  function ensureChat(chatId, title, phone) {
    setChats((prev) => {
      if (prev.some((c) => c.chatId === chatId)) return prev;
      return [...prev, { chatId, title: title || chatId, phone: phone || '', createdAt: Date.now() }];
    });
  }

  function handleNotification(body) {
    if (!body) return;

    if (body.typeWebhook === 'stateInstanceChanged') {
      setInstanceState(body.stateInstance);
      return;
    }

    const chatId = body.senderData && body.senderData.chatId;
    const type = body.messageData && body.messageData.typeMessage;

    if (!chatId || (type !== 'textMessage' && type !== 'extendedTextMessage')) return;

    const text =
      (body.messageData.textMessageData && body.messageData.textMessageData.textMessage) ||
      (body.messageData.extendedTextMessageData && body.messageData.extendedTextMessageData.textMessage);
    if (!text) return;

    if (body.typeWebhook === 'incomingMessageReceived') {
      ensureChat(chatId, body.senderData.chatName || body.senderData.senderName, body.senderData.senderPhoneNumber);
      addMessage(chatId, {
        id: body.idMessage,
        text,
        from: 'them',
        time: body.timestamp ? body.timestamp * 1000 : Date.now(),
        status: 'received',
      });
    } else if (body.typeWebhook === 'outgoingMessageReceived') {
      ensureChat(chatId, body.senderData.chatName, body.senderData.senderPhoneNumber);
      addMessage(chatId, {
        id: body.idMessage,
        text,
        from: 'me',
        time: body.timestamp ? body.timestamp * 1000 : Date.now(),
        status: 'sent',
      });
    } else if (body.typeWebhook === 'outgoingMessageStatus') {
      const status = body.statusMessageData && body.statusMessageData.status;
      const map = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };
      if (map[status] && body.idMessage && body.recipientData) {
        patchMessage(body.recipientData.chatId, body.idMessage, { status: map[status] });
      }
    }
  }

  const notificationHandler = useRef(handleNotification);
  notificationHandler.current = handleNotification;

  const refreshStateRef = useRef(() => {});

  useEffect(() => {
    if (!creds) return undefined;

    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    (async () => {
      let interval = 0;
      let errorDelay = 0;
      let recovering = false;

      while (!cancelled) {
        while (!cancelled && document.hidden) {
          await sleep(1000);
        }
        if (interval > 0) {
          await sleep(interval);
        }
        if (cancelled) return;

        const startedAt = Date.now();
        try {
          const notification = await receiveNotification(creds, POLL_RECEIVE_TIMEOUT);
          if (cancelled) return;
          interval = Math.max(POLL_MIN_INTERVAL - (Date.now() - startedAt), 0);

          if (recovering) {
            recovering = false;
            errorDelay = 0;
            setConnectionError(null);
            refreshStateRef.current();
          }

          if (notification) {
            notificationHandler.current(notification.body);
            try {
              await deleteNotification(creds, notification.receiptId);
            } catch (err) {
              console.error(err);
            }
          }
        } catch (error) {
          if (cancelled) return;
          recovering = true;
          errorDelay = errorDelay ? Math.min(errorDelay * 2, 60000) : 5000;
          interval = errorDelay;
          setInstanceState('error');
          setConnectionError(error.message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [creds]);

  useEffect(() => {
    if (!creds) return undefined;
    let alive = true;

    async function refresh() {
      try {
        const data = await getStateInstance(creds);
        if (!alive) return;
        setInstanceState(data.stateInstance);
        setConnectionError(null);
      } catch (error) {
        if (!alive) return;
        setInstanceState('error');
        setConnectionError(error.message);
      }
    }

    refreshStateRef.current = refresh;
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
      refreshStateRef.current = () => {};
    };
  }, [creds]);

  async function connect(idInstance, apiTokenInstance) {
    const nextCreds = { idInstance: idInstance.trim(), apiTokenInstance: apiTokenInstance.trim() };
    const state = await getStateInstance(nextCreds);
    try {
      await setSettings(nextCreds);
    } catch (err) {
      console.error(err)
    }
    save(KEYS.creds, nextCreds);
    setCreds(nextCreds);
    setInstanceState(state.stateInstance);
    setConnectionError(null);
  }

  function logout() {
    remove(KEYS.creds);
    remove(KEYS.chats);
    remove(KEYS.messages);
    remove(KEYS.active);
    setCreds(null);
    setChats([]);
    setMessages({});
    setActiveId(null);
    setInstanceState(null);
    setConnectionError(null);
  }

  async function createChat(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!/^(7\d{10}|375\d{9})$/.test(digits)) {
      throw new Error('Введите номер в международном формате (РФ или РБ), например 79991234567');
    }

    const result = await checkAccount(creds, Number(digits));
    if (result.status === false) {
      throw new Error(result.reason || 'Инстанс не готов, повторите попытку позже');
    }
    if (!result.exist || !result.chatId) {
      throw new Error('На этом номере не зарегистрирован аккаунт MAX');
    }

    const chatId = String(result.chatId);
    ensureChat(chatId, formatPhone(digits), digits);
    setActiveId(chatId);
    return chatId;
  }

  async function send(text) {
    if (!activeId || !text.trim()) return;

    const chatId = activeId;
    const tempId = `tmp-${Date.now()}`;
    addMessage(chatId, {
      id: tempId,
      text: text.trim(),
      from: 'me',
      time: Date.now(),
      status: 'sending',
    });

    try {
      const result = await sendMessage(creds, chatId, text.trim());
      patchMessage(chatId, tempId, { id: result.idMessage, status: 'sent' });
    } catch (error) {
      patchMessage(chatId, tempId, { status: 'failed', error: error.message });
    }
  }

  const visibleChats = useMemo(() => withPreviews(chats, messages), [chats, messages]);
  const activeChat = visibleChats.find((c) => c.chatId === activeId) || null;

  if (!creds) {
    return <LoginScreen onConnect={connect} />;
  }

  return (
    <div className="app">
      <div className={`shell ${activeChat ? 'shell--chat-open' : ''}`}>
        <Sidebar
          chats={visibleChats}
          activeId={activeId}
          onSelect={setActiveId}
          onCreate={createChat}
          instanceState={instanceState}
          connectionError={connectionError}
          onLogout={logout}
        />
        <ChatView
          chat={activeChat}
          messages={activeId ? messages[activeId] || [] : []}
          onSend={send}
          onBack={() => setActiveId(null)}
        />
      </div>
    </div>
  );
}
