import { useEffect, useState } from 'react'
import { useApp, useSelectedObject } from '../App.jsx'
import { api, fileUrl, fmtDate, PRIORITY } from '../api.js'

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт']
const ACCESS_STATUS = { needed: ['Нужен', 'bad'], requested: ['Запрошен', 'warn'], granted: ['Получен', 'ok'] }
const iso = (d) => d.toISOString().slice(0, 10)

function mondayOf(d) {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export default function Planning() {
  const { objects, reload, toast, meta } = useApp()
  const [obj, select] = useSelectedObject()
  const [specs, setSpecs] = useState([])
  const [visits, setVisits] = useState([])
  const [week, setWeek] = useState(() => mondayOf(new Date()))
  const [adding, setAdding] = useState(null) // {specialist_id, date}
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    const [s, v] = await Promise.all([api.get('/specialists'), api.get('/visits')])
    setSpecs(s.filter((x) => x.role === 'scanner')); setVisits(v)
  }
  useEffect(() => { load() }, [])

  const days = DAYS.map((_, i) => { const d = new Date(week); d.setDate(d.getDate() + i); return iso(d) })
  const today = iso(new Date())
  const byId = Object.fromEntries(objects.map((o) => [o.id, o]))
  const shiftWeek = (n) => { const d = new Date(week); d.setDate(d.getDate() + 7 * n); setWeek(d) }

  const autoPlan = async (o) => {
    const created = await api.post(`/visits/auto/${o.id}`)
    await Promise.all([load(), reload()])
    toast(created.length ? `Поставлено выездов: ${created.length} (с ${fmtDate(created[0].date)})` : 'Свободных дней не найдено')
  }

  const addVisit = async (object_id) => {
    await api.post('/visits', { ...adding, object_id, hours: Math.min(8, Math.ceil(byId[object_id].labour.field_hours)) })
    setAdding(null); await load(); toast('Выезд добавлен в календарь')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Планирование и диспетчеризация</h1>
          <div className="muted">Календарь выездов, расчёт трудозатрат, допуски и приоритеты</div>
        </div>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setShowNew(!showNew)}>+ Новый объект</button>
      </div>

      {showNew && <NewObject onDone={async (o) => { setShowNew(false); await reload(); select(o.id); toast(`Объект ${o.code} создан. Расчёт: ${o.labour.total_hours} ч`) }} meta={meta} />}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Загрузка выездных специалистов</h2>
          <div className="spacer" style={{ flex: 1 }} />
          <button className="btn sm" onClick={() => shiftWeek(-1)}>←</button>
          <b>{fmtDate(days[0])} — {fmtDate(days[4])}</b>
          <button className="btn sm" onClick={() => shiftWeek(1)}>→</button>
          <button className="btn sm ghost" onClick={() => setWeek(mondayOf(new Date()))}>Сегодня</button>
        </div>
        <div className="gantt">
          <div className="gh">Специалист</div>
          {days.map((d, i) => <div key={d} className={'gh' + (d === today ? ' today' : '')}>{DAYS[i]} {fmtDate(d).slice(0, 5)}</div>)}
          {specs.map((s) => (
            <Row key={s.id} s={s} days={days} visits={visits} byId={byId}
              onCell={(date) => setAdding({ specialist_id: s.id, date })}
              onDel={async (v) => { await api.del(`/visits/${v.id}`); load() }} />
          ))}
        </div>
        {adding && (
          <div className="hint-box" style={{ marginTop: 12 }}>
            <div className="row">
              <b>Новый выезд: {specs.find((s) => s.id === adding.specialist_id)?.name}, {fmtDate(adding.date)}</b>
              <select style={{ maxWidth: 360 }} defaultValue="" onChange={(e) => e.target.value && addVisit(e.target.value)}>
                <option value="">— выберите объект —</option>
                {objects.filter((o) => o.stage !== 'done').map((o) => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}
              </select>
              <button className="btn sm ghost" onClick={() => setAdding(null)}>Отмена</button>
            </div>
          </div>
        )}
        <p className="muted small" style={{ margin: '10px 0 0' }}>Нажмите на пустую клетку, чтобы поставить выезд. Нажмите на выезд, чтобы удалить его.</p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>
        <div className="card">
          <h2>Объекты, трудозатраты и приоритет</h2>
          <table className="t">
            <thead><tr><th>Объект</th><th className="num">Площадь</th><th className="num">Выезд</th><th className="num">Офис</th><th>Приоритет</th><th></th></tr></thead>
            <tbody>
              {[...objects].sort((a, b) => a.priority - b.priority).map((o) => (
                <tr key={o.id} className={'click' + (o.id === obj?.id ? ' sel' : '')} onClick={() => select(o.id)}>
                  <td><b>{o.name}</b><div className="muted small">{o.code} · {meta.stages.find((s) => s.id === o.stage)?.name}</div></td>
                  <td className="num">{o.area.toLocaleString('ru-RU')} м²</td>
                  <td className="num">{o.labour.field_days} дн × {o.labour.specialists} чел</td>
                  <td className="num">{Math.round(o.labour.office_hours + o.labour.design_hours)} ч</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select value={o.priority} style={{ width: 120 }} onChange={async (e) => { await api.patch(`/objects/${o.id}`, { priority: +e.target.value }); reload() }}>
                      {[1, 2, 3].map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
                    </select>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {o.stage === 'plan' && <button className="btn sm dark" onClick={() => autoPlan(o)}>Авто-план</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {obj && <ObjectSide obj={obj} toast={toast} />}
      </div>
    </>
  )
}

function Row({ s, days, visits, byId, onCell, onDel }) {
  return (
    <>
      <div className="who"><span className="dot" style={{ background: s.color }} />{s.name}</div>
      {days.map((d) => {
        const list = visits.filter((v) => v.specialist_id === s.id && v.date === d)
        return (
          <div key={d} className="cell" onClick={() => !list.length && onCell(d)}>
            {list.map((v) => (
              <div key={v.id} className={'gbar' + (v.status === 'done' ? ' done' : '')} style={{ background: s.color }}
                title="Нажмите, чтобы удалить" onClick={(e) => { e.stopPropagation(); if (confirm('Удалить выезд?')) onDel(v) }}>
                {byId[v.object_id]?.name || '—'}<br /><span style={{ opacity: .8 }}>{v.start}:00, {v.hours} ч</span>
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}

function ObjectSide({ obj, toast }) {
  const [access, setAccess] = useState([])
  useEffect(() => { api.get(`/access/${obj.id}`).then(setAccess) }, [obj.id])

  const cycle = async (i) => {
    const order = ['needed', 'requested', 'granted']
    const next = access.map((a, j) => j === i ? { ...a, status: order[(order.indexOf(a.status) + 1) % 3] } : a)
    setAccess(await api.put(`/access/${obj.id}`, next))
  }

  const downloadLetter = () => {
    window.location.href = fileUrl(`/access/${obj.id}/letter`)
    setTimeout(() => api.get(`/access/${obj.id}`).then(setAccess), 800)
    toast('Заявка на допуск сформирована (Word)')
  }

  const l = obj.labour
  return (
    <div className="stack">
      <div className="card">
        <h2>Расчёт ресурсов: {obj.name}</h2>
        <div className="grid g3" style={{ marginBottom: 12 }}>
          <div className="kpi"><b>{l.field_hours} ч</b><span>на объекте</span></div>
          <div className="kpi"><b>{l.office_hours} ч</b><span>камералка</span></div>
          <div className="kpi"><b>{l.design_hours} ч</b><span>РД и смета</span></div>
        </div>
        <ul className="muted small" style={{ margin: 0, paddingLeft: 18 }}>
          {l.explain.map((e) => <li key={e}>{e}</li>)}
        </ul>
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Допуски к выезду</h2>
          <div style={{ flex: 1 }} />
          <button className="btn sm primary" onClick={downloadLetter}>Сформировать заявку</button>
        </div>
        {access.map((a, i) => (
          <div key={a.item} className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
            <span>{a.item}</span>
            <button className={'badge ' + ACCESS_STATUS[a.status][1]} style={{ cursor: 'pointer' }} onClick={() => cycle(i)}>{ACCESS_STATUS[a.status][0]}</button>
          </div>
        ))}
        <p className="muted small" style={{ marginBottom: 0 }}>Заявка (Word) включает все помещения без допуска; их статус сменится на «Запрошен».</p>
      </div>
    </div>
  )
}

function NewObject({ onDone, meta }) {
  const [f, setF] = useState({ name: '', address: '', customer: '', building_type: 'mkd', area: 3000, floors: 5, year: 1975, systems: ['EOM', 'VK', 'OV', 'TS'], priority: 2 })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'number' ? +e.target.value : e.target.value })
  const toggle = (s) => setF({ ...f, systems: f.systems.includes(s) ? f.systems.filter((x) => x !== s) : [...f.systems, s] })
  const submit = async () => {
    if (!f.name || !f.address) return alert('Заполните название и адрес')
    onDone(await api.post('/objects', f))
  }
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2>Новый объект</h2>
      <div className="grid g3">
        <label className="field">Название<input value={f.name} onChange={set('name')} placeholder="МКД ул. Примерная, 1" /></label>
        <label className="field">Адрес<input value={f.address} onChange={set('address')} /></label>
        <label className="field">Заказчик<input value={f.customer} onChange={set('customer')} /></label>
        <label className="field">Тип здания<select value={f.building_type} onChange={set('building_type')}>
          {Object.entries(meta.building_types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field">Площадь, м²<input type="number" value={f.area} onChange={set('area')} /></label>
        <label className="field">Этажей<input type="number" value={f.floors} onChange={set('floors')} /></label>
        <label className="field">Год постройки<input type="number" value={f.year} onChange={set('year')} /></label>
        <label className="field">Приоритет<select value={f.priority} onChange={set('priority')}>
          {[1, 2, 3].map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}</select></label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <span className="muted small">Инженерные системы:</span>
        {Object.entries(meta.systems).map(([k, v]) => (
          <label key={k} className="row" style={{ gap: 5 }}><input type="checkbox" style={{ width: 'auto' }} checked={f.systems.includes(k)} onChange={() => toggle(k)} />{v}</label>
        ))}
      </div>
      <div className="row" style={{ marginTop: 14 }}><button className="btn primary" onClick={submit}>Создать и рассчитать</button></div>
    </div>
  )
}
