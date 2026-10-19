import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { api, fmtDate, PRIORITY } from '../api.js'

// Где по объекту продолжать работу на каждом этапе конвейера
const STAGE_LINK = { plan: '/planning', field: '/tablet', cloud: '/clouds', office: '/docs', design: '/estimate', print: '/docs', done: '/docs' }

export default function Dashboard() {
  const { meta, objects, reload, toast } = useApp()
  const stages = meta.stages
  const idx = Object.fromEntries(stages.map((s, i) => [s.id, i]))

  const move = async (o, dir) => {
    const next = stages[idx[o.stage] + dir]
    if (!next) return
    await api.patch(`/objects/${o.id}`, { stage: next.id })
    await reload()
    toast(`«${o.name}» → ${next.name}`)
  }

  const active = objects.filter((o) => o.stage !== 'done')
  const overdue = active.filter((o) => o.deadline < new Date().toISOString().slice(0, 10))
  const hours = active.reduce((s, o) => s + o.labour.total_hours, 0)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Конвейер объектов</h1>
          <div className="muted">От выезда до готового тома: каждый объект движется по одним и тем же шагам</div>
        </div>
      </div>

      <div className="grid g4" style={{ marginBottom: 20 }}>
        <div className="card kpi"><b>{active.length}</b><span>объектов в работе</span></div>
        <div className="card kpi"><b style={{ color: 'var(--bad)' }}>{active.filter((o) => o.priority === 1).length}</b><span>с высоким приоритетом</span></div>
        <div className="card kpi"><b>{Math.round(hours)} ч</b><span>трудозатрат осталось (расчёт)</span></div>
        <div className="card kpi"><b style={{ color: overdue.length ? 'var(--bad)' : 'var(--ok)' }}>{overdue.length}</b><span>просрочено по сроку</span></div>
      </div>

      <div className="pipeline">
        {stages.map((s, i) => {
          const list = objects.filter((o) => o.stage === s.id).sort((a, b) => a.priority - b.priority)
          return (
            <div className="lane" key={s.id}>
              <div className="lane-head">
                <span><span className="step">{i + 1}</span>{s.name}</span>
                <span className="badge">{list.length}</span>
              </div>
              {list.map((o) => (
                <div key={o.id} className={'ocard p' + o.priority}>
                  <Link to={`${STAGE_LINK[o.stage]}?o=${o.id}`} style={{ textDecoration: 'none' }}>
                    <div className="nm">{o.name}</div>
                  </Link>
                  <div className="muted small">{o.code} · {o.area.toLocaleString('ru-RU')} м²</div>
                  <div className="row" style={{ gap: 4, marginTop: 6 }}>
                    <span className={'badge ' + (o.priority === 1 ? 'bad' : o.priority === 2 ? 'warn' : '')}>{PRIORITY[o.priority]}</span>
                    <span className="badge">до {fmtDate(o.deadline)}</span>
                  </div>
                  <div className="mv">
                    <button className="btn sm ghost" disabled={i === 0} onClick={() => move(o, -1)} title="Вернуть на шаг назад">←</button>
                    <button className="btn sm" disabled={i === stages.length - 1} onClick={() => move(o, 1)}>Дальше →</button>
                  </div>
                </div>
              ))}
              {!list.length && <div className="muted small" style={{ textAlign: 'center', padding: 14 }}>пусто</div>}
            </div>
          )
        })}
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>
        Цвет полоски слева — приоритет: красный — высокий, жёлтый — средний, серый — низкий. Внутри колонки объекты отсортированы по приоритету — в таком порядке их берёт в работу офис.
      </p>
    </>
  )
}
