import { useEffect, useState } from 'react'
import { ObjectSelect, useApp, useSelectedObject } from '../App.jsx'
import { api } from '../api.js'

const ORG_FIELDS = [['name', 'Наименование', 2.2], ['ogrn', 'ОГРН', 1], ['inn', 'ИНН', 1], ['address', 'Адрес', 2], ['sro', 'СРО', 1.6], ['phone', 'Телефон', 1.2]]
const PERSON_FIELDS = [['fio', 'ФИО полностью', 1.8], ['position', 'Должность', 2], ['order_no', '№ приказа', 0.8], ['order_date', 'Дата приказа', 1, 'date'], ['nrs', '№ в НРС', 1]]

export default function Participants() {
  const { toast } = useApp()
  const [obj, select] = useSelectedObject()
  const [orgs, setOrgs] = useState([])
  const [people, setPeople] = useState([])
  const [meta, setMeta] = useState(null)
  const [roles, setRoles] = useState(null)

  useEffect(() => {
    api.get('/organizations').then(setOrgs)
    api.get('/people').then(setPeople)
    api.get('/id/meta').then(setMeta)
  }, [])
  useEffect(() => { if (obj) api.get(`/roles/${obj.id}`).then(setRoles) }, [obj?.id])

  if (!obj || !meta || !roles) return null
  const orgName = (id) => orgs.find((g) => g.id === id)?.name || '—'

  const saveRoles = async (next) => { setRoles(next); await api.put(`/roles/${obj.id}`, next) }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Участники строительства</h1>
          <div className="muted">Заполняется один раз — дальше подставляется во все АОСР, реестры и приказы</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Кто подписывает акты по объекту</h2>
          <div style={{ flex: 1 }} />
          <ObjectSelect value={obj.id} onChange={select} />
        </div>
        <div className="grid g2">
          <div className="stack">
            <h3>Организации</h3>
            {Object.entries(meta.org_roles).map(([k, label]) => (
              <label key={k} className="field">{label}
                <select value={roles.orgs[k] || ''} onChange={(e) => saveRoles({ ...roles, orgs: { ...roles.orgs, [k]: e.target.value } })}>
                  <option value="">— не участвует —</option>
                  {orgs.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="stack">
            <h3>Представители (графы АОСР)</h3>
            {meta.aosr_roles.map((r) => (
              <label key={r.id} className="field">{r.name}
                <select value={roles.people[r.id] || ''} onChange={(e) => saveRoles({ ...roles, people: { ...roles.people, [r.id]: e.target.value } })}>
                  <option value="">— не назначен —</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.fio} · {orgName(p.org_id)}</option>)}
                </select>
              </label>
            ))}
            <div className="field">Иные представители
              <div className="row">
                {people.map((p) => {
                  const on = (roles.people.others || []).includes(p.id)
                  return (
                    <button key={p.id} className={'btn sm ' + (on ? 'primary' : '')} onClick={() => {
                      const others = on ? roles.people.others.filter((x) => x !== p.id) : [...(roles.people.others || []), p.id]
                      saveRoles({ ...roles, people: { ...roles.people, others } })
                    }}>{p.fio.split(' ')[0]} {p.fio.split(' ').slice(1).map((x) => x[0] + '.').join('')}</button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditTable title="Организации" fields={ORG_FIELDS} rows={orgs} coll="organizations"
        onChange={setOrgs} toast={toast} />
      <EditTable title="Ответственные лица" fields={PERSON_FIELDS} rows={people} coll="people" onChange={setPeople} toast={toast}
        extra={{ key: 'org_id', label: 'Организация', options: orgs.map((g) => [g.id, g.name]) }} />
    </>
  )
}

// Таблица с правкой «на месте»: изменения сохраняются при выходе из поля
function EditTable({ title, fields, rows, coll, onChange, toast, extra }) {
  const save = async (row, key, value) => {
    if (row[key] === value) return
    const r = await api.patch(`/${coll}/${row.id}`, { [key]: value })
    onChange(rows.map((x) => (x.id === r.id ? r : x)))
  }
  const add = async () => {
    const r = await api.post(`/${coll}`, extra ? { [extra.key]: extra.options[0]?.[0] || '' } : {})
    onChange([...rows, r]); toast('Добавлена строка — заполните её')
  }
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ flex: 1 }} />
        <button className="btn sm primary" onClick={add}>+ Добавить</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="t edit">
          <thead><tr>
            {fields.map(([k, l, w]) => <th key={k} style={{ minWidth: w * 110 }}>{l}</th>)}
            {extra && <th style={{ minWidth: 200 }}>{extra.label}</th>}
          </tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {fields.map(([k, , , type]) => (
                  <td key={k}><input type={type || 'text'} defaultValue={row[k]} onBlur={(e) => save(row, k, e.target.value)} /></td>
                ))}
                {extra && (
                  <td><select value={row[extra.key]} onChange={(e) => save(row, extra.key, e.target.value)}>
                    {extra.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {coll === 'people' && <p className="muted small" style={{ marginBottom: 0 }}>Приказ на каждого из этих людей автоматически попадает в реестр папки ИД с датой и номером.</p>}
    </div>
  )
}
