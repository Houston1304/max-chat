import { useEffect, useRef, useState } from 'react';
import { avatarText, formatTime } from '../storage.js';

function Status({ message }) {
  if (message.from !== 'me') return null;
  if (message.status === 'sending') return <span className="bubble__status">…</span>;
  if (message.status === 'failed') {
    return (
      <span className="bubble__status bubble__status--failed" title={message.error}>
        ⚠
      </span>
    );
  }
  if (message.status === 'delivered' || message.status === 'read') {
    return <span className="bubble__status">✓✓</span>;
  }
  return <span className="bubble__status">✓</span>;
}

export default function ChatView({ chat, messages, onSend, onBack }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, chat && chat.chatId]);

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function submit() {
    const value = text.trim();
    if (!value || !chat) return;
    onSend(value);
    setText('');
  }

  if (!chat) {
    return (
      <section className="chat chat--empty">
        <div className="empty-state">
          <div className="empty-state__icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="72" height="72">
              <rect width="64" height="64" rx="16" fill="#e7e7e7" />
              <path d="M14 44V20h6l12 14 12-14h6v24h-7V31l-11 12-11-12v13z" fill="#b6b8bb" />
            </svg>
          </div>
          <h2>Выберите чат или создайте новый</h2>
          <p>Введите номер телефона получателя слева и начните общение в MAX.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="chat">
      <header className="chat__header">
        <button className="btn btn--icon chat__back" type="button" onClick={onBack} aria-label="Назад">
          ‹
        </button>
        <span className="avatar">{avatarText(chat.title)}</span>
        <div className="chat__peer">
          <div className="chat__peer-name">{chat.title}</div>
          <div className="chat__peer-id">chatId: {chat.chatId}</div>
        </div>
      </header>

      <div className="chat__messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat__hint">Пока сообщений нет. Напишите первое сообщение 👋</div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`bubble-row ${message.from === 'me' ? 'bubble-row--me' : ''}`}>
            <div className={`bubble ${message.from === 'me' ? 'bubble--me' : ''} ${message.status === 'failed' ? 'bubble--failed' : ''}`}>
              <span className="bubble__text">{message.text}</span>
              <span className="bubble__meta">
                <span className="bubble__time">{formatTime(message.time)}</span>
                <Status message={message} />
              </span>
            </div>
          </div>
        ))}
      </div>

      <footer className="composer">
        <textarea
          className="composer__input"
          rows={1}
          value={text}
          placeholder="Введите сообщение…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="btn btn--send"
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          aria-label="Отправить"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M3 11l18-8-8 18-2.5-7.5L3 11z" fill="currentColor" />
          </svg>
        </button>
      </footer>
    </section>
  );
}
