import { useState } from 'react';

export default function LoginScreen({ onConnect }) {
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    if (!idInstance.trim() || !apiTokenInstance.trim()) {
      setError('Заполните оба поля: idInstance и apiTokenInstance');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onConnect(idInstance, apiTokenInstance);
    } catch (e) {
      setError(
        e.message && e.message.includes('401')
          ? 'Неверные учётные данные GREEN-API'
          : e.message || 'Не удалось подключиться'
      );
      setBusy(false);
    }
  }

  return (
    <div className="app login">
      <form className="login__card" onSubmit={handleSubmit}>
        <div className="login__logo" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="56" height="56">
            <rect width="64" height="64" rx="16" fill="#007aff" />
            <path d="M14 44V20h6l12 14 12-14h6v24h-7V31l-11 12-11-12v13z" fill="#fff" />
          </svg>
        </div>
        <h1 className="login__title">MAX чат</h1>
        <p className="login__subtitle">
          Введите учётные данные GREEN-API для инстанса MAX.
        </p>

        <label className="field">
          <span className="field__label">idInstance</span>
          <input
            className="field__input"
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            placeholder="3100000000"
            autoComplete="off"
            inputMode="numeric"
            disabled={busy}
          />
        </label>

        <label className="field">
          <span className="field__label">apiTokenInstance</span>
          <input
            className="field__input"
            value={apiTokenInstance}
            onChange={(e) => setApiTokenInstance(e.target.value)}
            placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            autoComplete="off"
            disabled={busy}
          />
        </label>

        {error && <div className="login__error">{error}</div>}

        <button className="btn btn--primary login__submit" type="submit" disabled={busy}>
          {busy ? 'Подключение…' : 'Подключиться'}
        </button>

        <p className="login__hint">
          Учётные данные можно получить в{' '}
          <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
            личном кабинете GREEN-API
          </a>
          .
        </p>
      </form>
    </div>
  );
}
