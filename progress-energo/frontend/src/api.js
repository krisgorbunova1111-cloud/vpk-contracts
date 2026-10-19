// Все обращения к серверу — в одном месте.
async function req(method, url, body) {
  const opts = { method, headers: {} }
  if (body instanceof FormData) opts.body = body
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const r = await fetch('/api' + url, opts)
  if (!r.ok) {
    let msg = r.statusText
    try { msg = (await r.json()).detail || msg } catch { /* не JSON */ }
    throw new Error(msg)
  }
  return r.json()
}

export const api = {
  get: (u) => req('GET', u),
  post: (u, b) => req('POST', u, b ?? {}),
  put: (u, b) => req('PUT', u, b),
  patch: (u, b) => req('PATCH', u, b),
  del: (u) => req('DELETE', u),
}

// Ссылка на скачивание файла (Word/XML/JSON), который отдаёт сервер
export const fileUrl = (u) => '/api' + u

export const STATE_RU = {
  satisfactory: 'Работоспособное',
  limited: 'Огранич. работоспособное',
  emergency: 'Аварийное',
  '': 'Не обследовано',
}
export const PRIORITY = { 1: 'Высокий', 2: 'Средний', 3: 'Низкий' }

export const fmtMoney = (n) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽'
export const fmtDate = (s) => (s ? new Date(s + 'T00:00').toLocaleDateString('ru-RU') : '—')
