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

// Пункты меню; roles — для кого пункт «свой» (показывается в верхней группе)
const NAV = [
  { to: '/', num: '★', label: 'Объекты по этапам', roles: ['dispatcher', 'engineer', 'designer', 'archivist'] },
  { to: '/planning', num: '1', label: 'Планирование', roles: ['dispatcher'] },
  { to: '/tablet', num: '2', label: 'Планшет (выезд)', roles: ['scanner', 'dispatcher'] },
  { to: '/clouds', num: '3', label: 'Облака точек и ИИ', roles: ['engineer', 'scanner'] },
  { to: '/id', num: '4', label: 'Исполнительная документация', roles: ['engineer', 'archivist'] },
  { to: '/checks', num: 'П', label: 'Проверка работ', roles: ['engineer', 'dispatcher', 'scanner'] },
  { to: '/docs', num: 'Р', label: 'Генератор РД', roles: ['designer', 'engineer'] },
  { to: '/estimate', num: '5', label: 'Сметы и выгрузки', roles: ['designer', 'dispatcher'] },
  { to: '/lab', num: 'Л', label: 'Лаборатория', roles: ['engineer', 'dispatcher'] },
  { to: '/participants', num: 'У', label: 'Участники', roles: ['engineer', 'archivist'] },
  { to: '/catalog', num: 'С', label: 'Справочники', roles: ['engineer', 'designer', 'archivist'] },
]

const ROLE_HOME = { dispatcher: '/', scanner: '/tablet', engineer: '/clouds', designer: '/estimate', archivist: '/id' }

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
  const [role, setRole] = useStored('pe-role', 'dispatcher')
  const [theme, setTheme] = useStored('pe-theme', 'light')
  const [toastMsg, setToastMsg] = useState('')
  const loc = useLocation()
  const nav = useNavigate()

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

  const ctx = { meta, objects, reload, role, theme, setTheme, toast }

  if (error) return <div className="content"><div className="card"><h2>Нет связи с сервером</h2><p className="muted">{error}</p><button className="btn primary" onClick={reload}>Повторить</button></div></div>
  if (!meta) return <div className="empty">Загрузка…</div>

  const tabletMode = loc.pathname.startsWith('/tablet')
  const mine = NAV.filter((n) => n.roles.includes(role))
  const other = NAV.filter((n) => !n.roles.includes(role))

  return (
    <Ctx.Provider value={ctx}>
      {tabletMode ? (
        <Tablet />
      ) : (
        <div className="app">
          <aside className="sidebar">
            <Logo />
            <div className="app-name">{APP_NAME.split(' ')[1].toUpperCase()}</div>
            <div className="nav-group">Мои модули</div>
            <nav className="nav">
              {mine.map((n) => <NavItem key={n.to} {...n} />)}
            </nav>
            {other.length > 0 && <div className="nav-group">Остальные</div>}
            <nav className="nav">
              {other.map((n) => <NavItem key={n.to} {...n} />)}
            </nav>
            <div className="sidebar-foot">ООО ВПК «Прогресс Энерго»<br />{APP_NAME} · прототип v0.1</div>
          </aside>
          <div className="main">
            <header className="topbar">
              <span className="muted small">Роль:</span>
              <select style={{ width: 260 }} value={role} onChange={(e) => { setRole(e.target.value); nav(ROLE_HOME[e.target.value]) }}>
                {meta.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
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
