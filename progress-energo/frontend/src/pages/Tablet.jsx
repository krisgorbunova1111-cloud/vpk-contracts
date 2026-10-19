import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { api } from '../api.js'
import { LogoMark } from '../components/Logo.jsx'
import { InspectionsPanel } from '../components/Inspections.jsx'

const STATES = [['satisfactory', 'Работоспособное'], ['limited', 'Ограниченно'], ['emergency', 'Аварийное']]
const CONSTR = [['foundation', 'Фундаменты / подвал'], ['walls', 'Стены'], ['slabs', 'Перекрытия'], ['roof', 'Кровля / чердак']]
const TABS = [['constr', 'Конструкции'], ['systems', 'Инж. системы'], ['nodes', 'Узлы и материалы'], ['works', 'Работы и лаб.'], ['scan', 'Сканер и ИИ'], ['check', 'Проверка работ']]

export default function Tablet() {
  const { objects, theme, setTheme, toast, meta, reload } = useApp()
  const loc = useLocation()
  const nav = useNavigate()
  const oid = new URLSearchParams(loc.search).get('o')
  const obj = objects.find((o) => o.id === oid)

  return (
    <div className="tablet">
      <div className="tablet-top">
        <LogoMark size={36} />
        <div>
          <div style={{ fontWeight: 800 }}>{obj ? obj.name : 'Выезд на объект'}</div>
          <div style={{ fontSize: 13, opacity: .7 }}>{obj ? obj.address : 'ВПК Платформа · планшет'}</div>
        </div>
        <div className="spacer" />
        {obj && <button className="btn" onClick={() => nav('/tablet')}>Сменить объект</button>}
        <button className="btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀' : '☾'}</button>
        <Link className="btn" to="/">В офис</Link>
      </div>
      {obj
        ? <Checklist key={obj.id} obj={obj} toast={toast} meta={meta} reload={reload} />
        : <PickObject objects={objects} onPick={(id) => nav('/tablet?o=' + id)} />}
    </div>
  )
}

function PickObject({ objects, onPick }) {
  const [scanning, setScanning] = useState(false)
  const [code, setCode] = useState('')
  const fake = () => {
    // Имитация считывания QR: через 1,5 с «распознаём» первый объект на этапе «Выезд»
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      const o = objects.find((x) => x.stage === 'field') || objects[0]
      onPick(o.id)
    }, 1500)
  }
  const byCode = () => {
    const o = objects.find((x) => x.code.toLowerCase() === code.trim().toLowerCase())
    o ? onPick(o.id) : alert('Объект с таким кодом не найден')
  }
  return (
    <div className="tablet-body">
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>Сканируйте QR-код на табличке объекта</h2>
        {scanning ? <div className="qr-box"><span className="muted">Наведите камеру…</span></div>
          : <button className="btn primary scan-btn" onClick={fake}>▣ Сканировать QR-код</button>}
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <input style={{ maxWidth: 260 }} placeholder="или код: PE-2026-002" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn" onClick={byCode}>Найти</button>
        </div>
      </div>
      <h2 style={{ margin: '8px 0 0' }}>Или выберите из списка</h2>
      <div className="obj-pick">
        {objects.filter((o) => o.stage !== 'done').map((o) => (
          <button key={o.id} onClick={() => onPick(o.id)}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{o.name}</div>
            <div className="muted">{o.address}</div>
            <div className="muted small" style={{ marginTop: 6 }}>{o.code} · {o.area.toLocaleString('ru-RU')} м² · {o.floors} эт.</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function Checklist({ obj, toast, meta, reload }) {
  const [cl, setCl] = useState(null)
  const [tab, setTab] = useState('constr')
  const [nodes, setNodes] = useState([])
  const [mats, setMats] = useState([])
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    Promise.all([api.get(`/checklists/${obj.id}`), api.get('/nodes'), api.get('/materials')])
      .then(([c, n, m]) => { setCl(c); setNodes(n); setMats(m) })
  }, [obj.id])

  if (!cl) return <div className="empty">Загрузка чек-листа…</div>

  const upd = (fn) => { setCl((c) => { const x = structuredClone(c); fn(x); return x }); setDirty(true) }
  const toggleIn = (key, id) => upd((x) => { x[key] = x[key].includes(id) ? x[key].filter((i) => i !== id) : [...x[key], id] })

  const save = async () => {
    const r = await api.put(`/checklists/${obj.id}`, cl)
    setDirty(false)
    await reload()
    toast(r.lab_ticket_created
      ? `Сохранено. Создана заявка в лабораторию: ${r.lab_ticket_created.test_type}`
      : 'Чек-лист сохранён и отправлен в офис')
  }

  // Принять разбор «Промпт-сканера» в чек-лист
  const applyAI = (p) => upd((x) => {
    Object.assign(x.constructions, p.constructions)
    for (const [k, v] of Object.entries(p.systems)) {
      x.systems[k] = { state: v.state || x.systems[k]?.state || '', notes: [x.systems[k]?.notes, v.notes].filter(Boolean).join('. ') }
    }
    if (p.lab_required) { x.lab_required = true; x.lab_test = x.lab_test || p.lab_test }
    if (p.notes) x.constructions.notes = [x.constructions.notes, p.notes].filter(Boolean).join('\n')
  })

  return (
    <div className="tablet-body">
      <div className="big-tabs">
        {TABS.map(([k, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}
      </div>

      {tab === 'constr' && (
        <div className="card stack" style={{ gap: 18 }}>
          {CONSTR.map(([k, n]) => (
            <div key={k}>
              <h3 style={{ fontSize: 17 }}>{n}</h3>
              <StateSeg value={cl.constructions[k]} onChange={(v) => upd((x) => { x.constructions[k] = v })} />
            </div>
          ))}
          <label className="field">Замечания по конструкциям
            <textarea value={cl.constructions.notes} onChange={(e) => upd((x) => { x.constructions.notes = e.target.value })} />
          </label>
        </div>
      )}

      {tab === 'systems' && (
        <div className="stack" style={{ gap: 14 }}>
          {obj.systems.map((s) => (
            <div key={s} className="card stack">
              <h3 style={{ fontSize: 17 }}>{meta.systems[s]}</h3>
              <StateSeg value={cl.systems[s]?.state} onChange={(v) => upd((x) => { x.systems[s] = { ...x.systems[s], state: v } })} />
              <textarea placeholder="Что увидели: год, марка, дефекты…" value={cl.systems[s]?.notes || ''}
                onChange={(e) => upd((x) => { x.systems[s] = { state: '', ...x.systems[s], notes: e.target.value } })} />
            </div>
          ))}
        </div>
      )}

      {tab === 'nodes' && (
        <>
          <div className="card">
            <h3 style={{ fontSize: 17 }}>Узлы, щитки и вводы (типовой справочник)</h3>
            <div className="chip-grid">
              {nodes.filter((n) => obj.systems.includes(n.system)).map((n) => (
                <Chip key={n.id} on={cl.nodes.includes(n.id)} onClick={() => toggleIn('nodes', n.id)}>
                  <div>{n.name}<div className="muted small">{n.type} · {meta.systems[n.system].split(' (')[0]}</div></div>
                </Chip>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 17 }}>Применённые материалы</h3>
            <p className="muted small" style={{ marginTop: 0 }}>Сертификаты и паспорта отмеченных материалов автоматически попадут в том ИД.</p>
            <div className="chip-grid">
              {mats.map((m) => (
                <Chip key={m.id} on={cl.materials.includes(m.id)} onClick={() => toggleIn('materials', m.id)}>
                  <div>{m.name}<div className="muted small">{m.category} · {m.supplier}</div></div>
                </Chip>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'works' && (
        <div className="card stack" style={{ gap: 14 }}>
          <h3 style={{ fontSize: 17 }}>Отметки о работах</h3>
          <div className="chip-grid">
            {cl.works.map((w, i) => (
              <Chip key={w.name} on={w.done} onClick={() => upd((x) => { x.works[i].done = !x.works[i].done })}>{w.name}</Chip>
            ))}
          </div>
          <h3 style={{ fontSize: 17, marginTop: 10 }}>Лабораторный контроль</h3>
          <Chip on={cl.lab_required} onClick={() => upd((x) => { x.lab_required = !x.lab_required })}>Требуется лабораторный контроль</Chip>
          {cl.lab_required && (
            <>
              <select value={cl.lab_test} onChange={(e) => upd((x) => { x.lab_test = e.target.value })}>
                <option value="">— вид испытания —</option>
                <option>Прочность бетона (неразрушающий метод)</option>
                <option>Отбор кернов бетона</option>
                <option>Испытание кладки (кирпич, раствор)</option>
                <option>Электроизмерения (сопротивление изоляции, петля фаза-ноль)</option>
                <option>Анализ качества воды</option>
              </select>
              <div className="hint-box">После сохранения в модуле «Лаборатория» автоматически появится заявка с адресом объекта и видом испытания.</div>
            </>
          )}
        </div>
      )}

      {tab === 'scan' && <ScanTab obj={obj} toast={toast} onAI={applyAI} reload={reload} />}

      {tab === 'check' && <InspectionsPanel obj={obj} toast={toast} big />}

      {tab !== 'check' && <button className="btn primary scan-btn" style={{ position: 'sticky', bottom: 14, boxShadow: '0 8px 24px rgba(62,99,221,.35)' }} onClick={save}>
        {dirty ? '💾 Сохранить и отправить в офис' : '✓ Сохранено'}
      </button>}
    </div>
  )
}

function StateSeg({ value, onChange }) {
  return (
    <div className="seg">
      {STATES.map(([k, n]) => <button key={k} className={(value === k ? 'on ' : '') + k} onClick={() => onChange(k)}>{n}</button>)}
    </div>
  )
}

function Chip({ on, onClick, children }) {
  return <div className={'chip' + (on ? ' on' : '')} onClick={onClick}><span className="box">{on ? '✓' : ''}</span>{children}</div>
}

function ScanTab({ obj, toast, onAI, reload }) {
  const [session, setSession] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [progress, setProgress] = useState(null)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [parsed, setParsed] = useState(null)
  const recRef = useRef(null)

  useEffect(() => {
    if (!session) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(session.started).getTime()) / 1000)), 1000)
    return () => clearInterval(t)
  }, [session])

  const startScan = () => {
    const send = async (lat, lon) => {
      setSession(await api.post('/scan/start', { object_id: obj.id, lat, lon }))
      toast('Сканирование начато: время и место зафиксированы')
    }
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => send(p.coords.latitude, p.coords.longitude), () => send(null, null), { timeout: 4000 })
    else send(null, null)
  }

  const upload = (file) => {
    if (!file) return
    const fd = new FormData()
    fd.append('object_id', obj.id); fd.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/pointclouds/upload')
    xhr.upload.onprogress = (e) => setProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      setProgress(null)
      if (xhr.status === 200) { toast(`Скан «${file.name}» загружен в систему`); reload() }
      else alert(JSON.parse(xhr.responseText).detail)
    }
    xhr.send(fd)
  }

  const listen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return alert('Голосовой ввод работает в Chrome / Edge. Можно набрать текст вручную.')
    if (listening) { recRef.current?.stop(); return }
    const r = new SR()
    r.lang = 'ru-RU'; r.continuous = true; r.interimResults = false
    r.onresult = (e) => setText((t) => (t ? t + '. ' : '') + Array.from(e.results).slice(e.resultIndex).map((x) => x[0].transcript).join(' '))
    r.onend = () => setListening(false)
    recRef.current = r; r.start(); setListening(true)
  }

  const parse = async () => setParsed(await api.post('/ai/parse', { text }))

  const photo = async (file) => {
    if (!file) return
    const fd = new FormData()
    fd.append('object_id', obj.id); fd.append('file', file)
    const r = await api.post('/ai/photo', fd)
    setText((t) => (t ? t + '\n' : '') + r.text)
    setParsed(r.parsed)
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0'), ss = String(elapsed % 60).padStart(2, '0')

  return (
    <>
      <div className="grid g2">
        <div className="card stack">
          <h3 style={{ fontSize: 17 }}>Лазерный сканер</h3>
          {session
            ? <div className="btn scan-btn rec" style={{ cursor: 'default' }}>● Идёт сканирование {mm}:{ss}</div>
            : <button className="btn dark scan-btn" onClick={startScan}>▶ Старт сканирования</button>}
          <label className="btn primary scan-btn" style={{ cursor: 'pointer' }}>
            ⇪ Загрузить файл сканирования
            <input type="file" accept=".las,.laz,.e57,.ptx" hidden onChange={(e) => upload(e.target.files[0])} />
          </label>
          {progress !== null && <div className="hint-box">Загрузка: {progress}%</div>}
          <div className="muted small">Форматы: .las, .laz, .e57, .ptx. Файл сразу уходит в систему и встаёт в очередь на обработку (построение обмерного плана).</div>
        </div>
        <div className="card stack">
          <h3 style={{ fontSize: 17 }}>Промпт-сканер (ИИ-помощник)</h3>
          <div className="row">
            <button className={'btn ' + (listening ? 'primary rec' : 'dark')} onClick={listen}>🎤 {listening ? 'Слушаю… (стоп)' : 'Надиктовать'}</button>
            <label className="btn" style={{ cursor: 'pointer' }}>📷 Фото<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => photo(e.target.files[0])} /></label>
          </div>
          <textarea rows={4} placeholder="Например: «Трещины в стене подвала. Щит ВРУ старый, износ. Нужен лабораторный контроль прочности бетона»" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn" disabled={!text.trim()} onClick={parse}>Разобрать по чек-листу</button>
        </div>
      </div>
      {parsed && (
        <div className="card">
          <h3 style={{ fontSize: 17 }}>ИИ распознал</h3>
          {parsed.found.length ? <ul>{[...new Set(parsed.found)].map((f) => <li key={f}>{f}</li>)}</ul> : <p className="muted">Ничего не распознано — уточните формулировку.</p>}
          <div className="row">
            <button className="btn primary" disabled={!parsed.found.length} onClick={() => { onAI(parsed); setParsed(null); setText(''); toast('Поля чек-листа заполнены. Проверьте и сохраните.') }}>Заполнить чек-лист</button>
            <button className="btn ghost" onClick={() => setParsed(null)}>Отмена</button>
          </div>
        </div>
      )}
    </>
  )
}
