import { useState } from 'react';
import { avatarText, formatTime } from '../storage.js';

const STATE_LABELS = {
  authorized: { text: 'Авторизован', tone: 'ok' },
  starting: { text: 'Инстанс запускается…', tone: 'warn' },
  notAuthorized: { text: 'Не авторизован', tone: 'warn' },
  paused: { text: 'Пауза', tone: 'warn' },
  error: { text: 'Ошибка связи', tone: 'error' },
};

export default function Sidebar({
  chats,
  activeId,
  onSelect,
  onCreate,
  instanceState,
  connectionError,
  onLogout,
}) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const state = STATE_LABELS[instanceState] || { text: 'Проверка подключения…', tone: 'muted' };

  async function handleCreate(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(phone);
      setPhone('');
    } catch (e) {
      setError(e.message || 'Не удалось создать чат');
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="28" height="28">
              <rect width="64" height="64" rx="16" fill="#007aff" />
              <path d="M14 44V20h6l12 14 12-14h6v24h-7V31l-11 12-11-12v13z" fill="#fff" />
            </svg>
          </span>
          <div className="sidebar__brand-text">
            <strong>MAX</strong>
            <span className={`status status--${state.tone}`}>
              <i className="status__dot" />
              {state.text}
            </span>
          </div>
        </div>
        <button className="btn btn--ghost" type="button" onClick={onLogout} title="Выйти из учётных данных">
          Выйти
        </button>
      </header>

      <form className="new-chat" onSubmit={handleCreate}>
        <div className="new-chat__title">Новый чат</div>
        <div className="new-chat__row">
          <input
            className="field__input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+7 999 123-45-67"
            inputMode="tel"
            autoComplete="off"
            disabled={busy}
          />
          <button className="btn btn--primary" type="submit" disabled={busy || !phone.trim()}>
            {busy ? '…' : 'Создать'}
          </button>
        </div>
        {error && <div className="new-chat__error">{error}</div>}
        {connectionError && !error && <div className="new-chat__error">{connectionError}</div>}
      </form>

      <div className="chat-list">
        {chats.length === 0 && (
          <div className="chat-list__empty">
            Чатов пока нет.
            <br />
            Создайте чат по номеру телефона получателя.
          </div>
        )}
        {chats.map((chat) => (
          <button
            key={chat.chatId}
            type="button"
            className={`chat-item ${chat.chatId === activeId ? 'chat-item--active' : ''}`}
            onClick={() => onSelect(chat.chatId)}
          >
            <span className="avatar avatar--lg">{avatarText(chat.title)}</span>
            <span className="chat-item__body">
              <span className="chat-item__row">
                <span className="chat-item__title">{chat.title}</span>
                <span className="chat-item__time">{formatTime(chat.lastTime)}</span>
              </span>
              <span className="chat-item__row">
                <span className="chat-item__preview">{chat.lastText || 'Нет сообщений'}</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <footer className="sidebar__footer">GREEN-API · sendMessage / receiveNotification</footer>
    </aside>
  );
}
