import { useEffect, useState } from 'react'
import { ObjectSelect, useApp, useSelectedObject } from '../App.jsx'
import { api, fileUrl, fmtDate } from '../api.js'
import { InspectionsPanel } from '../components/Inspections.jsx'

export default function Checks() {
  const { toast } = useApp()
  const [obj, select] = useSelectedObject()
  const [stats, setStats] = useState(null)

  const refresh = () => api.get(`/inspections?object_id=${obj.id}`).then((l) => setStats({
    total: l.length,
    diff: l.filter((i) => Object.values(i.results).includes('diff') && i.status !== 'closed'),
    closed: l.filter((i) => i.status === 'closed').length,
  }))
  useEffect(() => { if (obj) refresh() }, [obj?.id])
  if (!obj) return null

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Проверка работ и контрольные замеры</h1>
          <div className="muted">76 типовых бланков: сверка «по документам — по факту», журнал замечаний, отчёт в Word</div>
        </div>
        <div className="spacer" />
        <a className="btn primary" href={fileUrl(`/inspections/report/${obj.id}`)}
          onClick={(e) => { if (!stats?.total) { e.preventDefault(); toast('Сначала заполните хотя бы один бланк') } }}>⬇ Отчёт и журнал замечаний (Word)</a>
        <ObjectSelect value={obj.id} onChange={select} />
      </div>
      {stats && (
        <div className="grid g3" style={{ marginBottom: 16 }}>
          <div className="card kpi"><b>{stats.total}</b><span>бланков заполнено</span></div>
          <div className="card kpi"><b style={{ color: stats.diff.length ? 'var(--bad)' : 'var(--ok)' }}>{stats.diff.length}</b><span>открытых расхождений</span></div>
          <div className="card kpi"><b style={{ color: 'var(--ok)' }}>{stats.closed}</b><span>замечаний закрыто</span></div>
        </div>
      )}
      {stats?.diff.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Журнал открытых замечаний</h2>
          <table className="t">
            <thead><tr><th>Бланк</th><th>Расхождение</th><th>Действие</th><th>Ответственный</th><th>Срок</th></tr></thead>
            <tbody>{stats.diff.map((i) => (
              <tr key={i.id}><td><b>{i.blank_id}</b></td><td>{i.notes || '—'}</td><td>{i.action || '—'}</td><td>{i.responsible || '—'}</td><td>{fmtDate(i.deadline)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <InspectionsPanel key={obj.id} obj={obj} toast={(m) => { toast(m); refresh() }} />
    </>
  )
}
