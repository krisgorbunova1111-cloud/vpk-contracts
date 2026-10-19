import { useEffect, useState } from 'react'
import { ObjectSelect, useApp, useSelectedObject } from '../App.jsx'
import { api, fmtDate } from '../api.js'

const STATUS = { uploaded: ['Загружено', 'warn'], indexed: ['Проиндексировано', 'info'], vectorized: ['План готов', 'ok'] }
const NEXT = { uploaded: 'Индексировать', indexed: 'Векторизовать (ИИ)' }

export default function Clouds() {
  const { objects, reload, toast } = useApp()
  const [obj, select] = useSelectedObject()
  const [clouds, setClouds] = useState([])
  const [busy, setBusy] = useState(null)
  const load = () => api.get('/pointclouds').then(setClouds)
  useEffect(() => { load() }, [])

  const byId = Object.fromEntries(objects.map((o) => [o.id, o]))
  const process = async (p) => {
    setBusy(p.id)
    await new Promise((r) => setTimeout(r, 1200)) // имитация обработки
    const r = await api.post(`/pointclouds/${p.id}/process`)
    setBusy(null); await load(); await reload()
    toast(r.status === 'vectorized' ? 'Обмерный план построен по данным сканирования' : 'Скан проиндексирован')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Лазерное сканирование</h1>
          <div className="muted">Хранилище сканов → индексация → автоматический 2D-план → привязка отметок с планшета</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Файлы лазерного сканирования</h2>
        <table className="t">
          <thead><tr><th>Файл</th><th>Объект</th><th className="num">Размер</th><th className="num">Точек</th><th>Загружен</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {clouds.map((p) => (
              <tr key={p.id} className={'click' + (p.object_id === obj?.id ? ' sel' : '')} onClick={() => select(p.object_id)}>
                <td><b>{p.filename}</b> <span className="badge">.{p.format}</span></td>
                <td>{byId[p.object_id]?.name}</td>
                <td className="num">{p.size_mb >= 1024 ? (p.size_mb / 1024).toFixed(1) + ' ГБ' : p.size_mb + ' МБ'}</td>
                <td className="num">{p.points_mln} млн</td>
                <td>{fmtDate(p.uploaded)}</td>
                <td><span className={'badge ' + STATUS[p.status][1]}>{STATUS[p.status][0]}</span></td>
                <td onClick={(e) => e.stopPropagation()}>
                  {NEXT[p.status] && <button className="btn sm dark" disabled={busy === p.id} onClick={() => process(p)}>{busy === p.id ? 'Обработка…' : NEXT[p.status]}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ marginBottom: 0 }}>Загрузка новых сканов — с планшета (вкладка «Сканер и ИИ»). Векторизация в прототипе имитируется; в боевой версии здесь подключается внешний сервис (PointCab / Autodesk ReCap / собственная ML-модель).</p>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Обмерный план и отметки</h2>
          <div style={{ flex: 1 }} />
          <ObjectSelect value={obj?.id} onChange={select} />
        </div>
        {obj && <PlanView obj={obj} toast={toast} />}
      </div>
    </>
  )
}

export function PlanView({ obj, toast, readOnly = false }) {
  const [plan, setPlan] = useState(null)
  const [tags, setTags] = useState([])
  const [kind, setKind] = useState('node')
  useEffect(() => {
    api.get(`/plan/${obj.id}`).then(setPlan)
    api.get(`/tags?object_id=${obj.id}`).then(setTags)
  }, [obj.id])

  if (!plan) return null
  if (!plan.ready) return <div className="hint-box">Для этого объекта ещё нет обработанного скана. Загрузите файл сканирования с планшета и запустите обработку в таблице выше.</div>

  const place = async (e) => {
    if (readOnly) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = +(((e.clientX - r.left) / r.width) * 100).toFixed(1)
    const y = +(((e.clientY - r.top) / r.height) * 100).toFixed(1)
    const label = prompt(kind === 'node' ? 'Что за узел? (например, «Щит ЩЭ-3»)' : 'Опишите дефект')
    if (!label) return
    const t = await api.post('/tags', { object_id: obj.id, x, y, label, kind })
    setTags([...tags, t]); toast?.('Отметка привязана к координатам плана')
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(220px, 1fr)' }}>
      <div>
        <div className="plan-wrap" onClick={place}>
          <svg viewBox="0 0 160 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse">
                <path d="M4 0H0V4" fill="none" stroke="currentColor" strokeOpacity=".06" strokeWidth=".2" />
              </pattern>
            </defs>
            <rect width="160" height="100" fill="url(#grid)" style={{ color: 'var(--text)' }} />
            {plan.rooms.map((r, i) => (
              <g key={i}>
                <rect x={8 + r.x * 1.44} y={6 + r.y * 0.88} width={r.w * 1.44} height={r.h * 0.88}
                  fill="none" stroke="var(--brand)" strokeWidth="0.9" />
                <text x={8 + (r.x + r.w / 2) * 1.44} y={6 + (r.y + r.h / 2) * 0.88} fontSize="2.6" textAnchor="middle" fill="var(--muted)">{r.name}</text>
                <text x={8 + (r.x + r.w / 2) * 1.44} y={6 + (r.y + r.h / 2) * 0.88 + 3.4} fontSize="2.2" textAnchor="middle" fill="var(--muted)">{r.area} м²</text>
              </g>
            ))}
          </svg>
          {tags.map((t) => (
            <div key={t.id} className={'ptag ' + t.kind} style={{ left: t.x + '%', top: t.y + '%' }}
              onClick={async (e) => { e.stopPropagation(); if (!readOnly && confirm(`Удалить отметку «${t.label}»?`)) { await api.del(`/tags/${t.id}`); setTags(tags.filter((x) => x.id !== t.id)) } }}>
              <span className="lbl">{t.label}</span><span className="pin" />
            </div>
          ))}
        </div>
        <div className="muted small" style={{ marginTop: 6 }}>Типовой этаж · масштаб {plan.scale} · площадь этажа {plan.floor_area} м²</div>
      </div>
      {!readOnly && (
        <div className="stack">
          <div className="hint-box">Выберите тип отметки и нажмите на план — отметка из чек-листа привяжется к координатам скана.</div>
          <div className="row">
            <button className={'btn sm ' + (kind === 'node' ? 'primary' : '')} onClick={() => setKind('node')}>Узел / оборудование</button>
            <button className={'btn sm ' + (kind === 'defect' ? 'primary' : '')} onClick={() => setKind('defect')}>Дефект</button>
          </div>
          <h3>Отметки ({tags.length})</h3>
          {tags.map((t) => <div key={t.id} className="row small"><span className={'badge ' + (t.kind === 'defect' ? 'bad' : 'accent')}>{t.kind === 'defect' ? 'дефект' : 'узел'}</span>{t.label}<span className="muted">({t.x}; {t.y})</span></div>)}
        </div>
      )}
    </div>
  )
}
