import { useEffect, useState } from 'react'
import { useApp } from '../App.jsx'
import { api, fmtDate } from '../api.js'

export default function Catalog() {
  const { meta, toast } = useApp()
  const [mats, setMats] = useState([])
  const [nodes, setNodes] = useState([])
  const [f, setF] = useState({ name: '', category: 'ЭОМ', supplier: '', cert_no: '', cert_until: '', passport: true })
  useEffect(() => { api.get('/materials').then(setMats); api.get('/nodes').then(setNodes) }, [])
  const today = new Date().toISOString().slice(0, 10)

  const add = async () => {
    if (!f.name || !f.cert_no) return alert('Укажите материал и номер сертификата')
    setMats([...mats, await api.post('/materials', f)])
    setF({ ...f, name: '', supplier: '', cert_no: '', cert_until: '' })
    toast('Материал добавлен в справочник')
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Справочники</h1>
          <div className="muted">Материалы, сертификаты и паспорта; типовые узлы инженерных систем</div>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Материалы, оборудование и сертификаты</h2>
        <table className="t">
          <thead><tr><th>Материал</th><th>Раздел</th><th>Поставщик</th><th>Сертификат / документ</th><th>Паспорт</th><th>Действует до</th></tr></thead>
          <tbody>
            {mats.map((m) => (
              <tr key={m.id}>
                <td><b>{m.name}</b></td><td><span className="badge">{m.category}</span></td><td>{m.supplier}</td>
                <td className="small">{m.cert_no}</td><td>{m.passport ? '✓' : '—'}</td>
                <td><span className={'badge ' + (m.cert_until < today ? 'bad' : 'ok')}>{fmtDate(m.cert_until)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid g3" style={{ marginTop: 14, gridTemplateColumns: '2fr 1fr 1.4fr 1.6fr 1fr auto', alignItems: 'end' }}>
          <label className="field">Материал<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="field">Раздел<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['АР', 'КР', 'ЭОМ', 'ВК', 'ОВ', 'ТС'].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field">Поставщик<input value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></label>
          <label className="field">№ сертификата<input value={f.cert_no} onChange={(e) => setF({ ...f, cert_no: e.target.value })} /></label>
          <label className="field">Действует до<input type="date" value={f.cert_until} onChange={(e) => setF({ ...f, cert_until: e.target.value })} /></label>
          <button className="btn primary" onClick={add}>Добавить</button>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>В боевой версии к каждой записи прикладываются сканы сертификата и паспорта (PDF) — они вшиваются в том ИД автоматически.</p>
      </div>
      <div className="card">
        <h2>Типовые узлы (для чек-листа планшета)</h2>
        <table className="t">
          <thead><tr><th>Система</th><th>Тип</th><th>Узел</th></tr></thead>
          <tbody>{nodes.map((n) => <tr key={n.id}><td>{meta.systems[n.system]}</td><td>{n.type}</td><td>{n.name}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  )
}
