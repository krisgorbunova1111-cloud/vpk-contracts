import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { api } from './api.js'
import Logo, { APP_NAME } from './components/Logo.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Planning from './pages/Planning.jsx'
import Tablet from './pages/Tablet.jsx'
import Clouds from './pages/Clouds.jsx'
import Docs from './pages/Docs.jsx'
import Estimate from './pages/Estimate.jsx'
import Lab from './pages/Lab.jsx'
import Catalog from './pages/Catalog.jsx'
import IdFolders from './pages/IdFolders.jsx'
import Participants from './pages/Participants.jsx'
import Checks from './pages/Checks.jsx'

// Общие данные приложения (справочники, объекты, роль, тема, уведомления)
const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

// Меню сгруппировано по ходу работы над объектом
const NAV = [
  { group: 'Объекты', items: [
    { to: '/', num: '★', label: 'Объекты по этапам' },
    { to: '/planning', num: '1', label: 'Планирование выездов' },
  ] },
  { group: 'На объекте', items: [
    { to: '/tablet', num: '2', label: 'Планшет (выезд)' },
    { to: '/checks', num: '✓', label: 'Проверка работ' },
    { to: '/lab', num: 'Л', label: 'Лаборатория' },
  ] },
  { group: 'Документы', items: [
    { to: '/id', num: 'ИД', label: 'Исполнительная документация' },
    { to: '/docs', num: 'РД', label: 'Генератор РД' },
    { to: '/clouds', num: 'ЛС', label: 'Лазерное сканирование' },
  ] },
  { group: 'Сметы', items: [
    { to: '/estimate', num: '₽', label: 'Сметы и выгрузки' },
  ] },
  { group: 'Справочники', items: [
    { to: '/participants', num: 'У', label: 'Участники' },
    { to: '/catalog', num: 'М', label: 'Материалы и узлы' },
  ] },
]

function useStored(key, initial) {
  const [v, setV] = useState(() => {
    try { return localStorage.getItem(key) || initial } catch { return initial }
  })
  const set = (x) => { setV(x); try { localStorage.setItem(key, x) } catch { /* приватный режим */ } }
  return [v, set]
}

export default function App() {
  const [meta, setMeta] = useState(null)
  const [objects, setObjects] = useState([])
  const [error, setError] = useState('')
  const [theme, setTheme] = useStored('pe-theme', 'light')
  const [toastMsg, setToastMsg] = useState('')
  const loc = useLocation()

  const reload = useCallback(async () => {
    try {
      const [m, o] = await Promise.all([api.get('/meta'), api.get('/objects')])
      setMeta(m); setObjects(o); setError('')
    } catch (e) {
      setError('Сервер не отвечает. Запустите start.bat (см. README). ' + e.message)
    }
  }, [])

  useEffect(() => { reload() }, [reload])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])

  const toast = useCallback((m) => {
    setToastMsg(m)
    clearTimeout(window.__peToast)
    window.__peToast = setTimeout(() => setToastMsg(''), 4200)
  }, [])

  const ctx = { meta, objects, reload, theme, setTheme, toast }

  if (error) return <div className="content"><div className="card"><h2>Нет связи с сервером</h2><p className="muted">{error}</p><button className="btn primary" onClick={reload}>Повторить</button></div></div>
  if (!meta) return <div className="empty">Загрузка…</div>

  const tabletMode = loc.pathname.startsWith('/tablet')

  return (
    <Ctx.Provider value={ctx}>
      {tabletMode ? (
        <Tablet />
      ) : (
        <div className="app">
          <aside className="sidebar">
            <Logo />
            <div className="app-name">{APP_NAME.split(' ')[1].toUpperCase()}</div>
            {NAV.map((g) => (
              <div key={g.group} className="nav-wrap">
                <div className="nav-group">{g.group}</div>
                <nav className="nav">{g.items.map((n) => <NavItem key={n.to} {...n} />)}</nav>
              </div>
            ))}
            <div className="sidebar-foot">ООО ВПК «Прогресс Энерго»<br />{APP_NAME} · прототип v0.3</div>
          </aside>
          <div className="main">
            <header className="topbar">
              <div className="spacer" />
              <button className="btn ghost" title="Сбросить демо-данные" onClick={async () => {
                if (!confirm('Вернуть демо-данные в исходное состояние? Все изменения будут потеряны.')) return
                await api.post('/reset'); await reload(); toast('Демо-данные восстановлены')
              }}>↺ Демо</button>
              <button className="btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? '☀ Светлая' : '☾ Тёмная'}
              </button>
            </header>
            <main className="content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/planning" element={<Planning />} />
                <Route path="/clouds" element={<Clouds />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/estimate" element={<Estimate />} />
                <Route path="/lab" element={<Lab />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/id" element={<IdFolders />} />
                <Route path="/participants" element={<Participants />} />
                <Route path="/checks" element={<Checks />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
          </div>
        </div>
      )}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </Ctx.Provider>
  )
}

function NavItem({ to, num, label }) {
  return (
    <NavLink to={to} end={to === '/'}>
      <span className="num">{num}</span>{label}
    </NavLink>
  )
}

// Выбор объекта — используется на многих экранах. Запоминает выбор в адресе (?o=…)
export function useSelectedObject() {
  const { objects } = useApp()
  const loc = useLocation()
  const nav = useNavigate()
  const id = new URLSearchParams(loc.search).get('o') || objects[0]?.id
  const obj = objects.find((o) => o.id === id) || objects[0]
  const select = (oid) => nav({ pathname: loc.pathname, search: '?o=' + oid }, { replace: true })
  return [obj, select]
}

export function ObjectSelect({ value, onChange, style }) {
  const { objects } = useApp()
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 380, ...style }}>
      {objects.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}
    </select>
  )
}
