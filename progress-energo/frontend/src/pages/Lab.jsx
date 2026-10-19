import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../App.jsx'
import { api, fmtDate } from '../api.js'

const ST = { new: ['Новая', 'bad'], in_work: ['В работе', 'warn'], done: ['Протокол получен', 'ok'] }

export default function Lab() {
  const { objects, toast } = useApp()
  const [list, setList] = useState([])
  const load = () => api.get('/lab').then(setList)
  useEffect(() => { load() }, [])
  const byId = Object.fromEntries(objects.map((o) => [o.id, o]))

  const setStatus = async (t, status) => {
    await api.patch(`/lab/${t.id}`, { status }); load()
    toast(`Заявка: ${ST[status][0]}`)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Лаборатория</h1>
          <div className="muted">Заявки создаются автоматически, когда на планшете отмечен «Требуется лаб. контроль»</div>
        </div>
      </div>
      <div className="card">
        {list.length ? (
          <table className="t">
            <thead><tr><th>Объект</th><th>Адрес</th><th>Вид испытания</th><th>Лаборатория</th><th>Создана</th><th>Статус</th></tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td><Link to={`/docs?o=${t.object_id}`}><b>{byId[t.object_id]?.name}</b></Link></td>
                  <td className="small">{t.address}</td>
                  <td>{t.test_type}</td>
                  <td>{t.lab}</td>
                  <td>{fmtDate(t.created)}</td>
                  <td>
                    <select value={t.status} style={{ width: 170 }} onChange={(e) => setStatus(t, e.target.value)}>
                      {Object.entries(ST).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="empty">Заявок пока нет</div>}
      </div>
    </>
  )
}
