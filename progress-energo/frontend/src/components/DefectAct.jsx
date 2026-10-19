// Дефектный акт объекта: строки «вид работ — ед. — количество» с разделом.
// Кнопка «Разложить по папкам» создаёт папки ИД по разделам и черновики АОСР (демонтаж / монтаж).
import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function DefectAct({ obj, sections, onBuilt, toast }) {
  const [da, setDa] = useState(null)
  const [saved, setSaved] = useState('')
  const [open, setOpen] = useState(false)
  const [paste, setPaste] = useState('')

  useEffect(() => {
    api.get(`/defect/${obj.id}`).then((d) => { setDa(d); setSaved(JSON.stringify(d)); setOpen(!d.rows.length) })
  }, [obj.id])
  if (!da) return null

  const dirty = JSON.stringify(da) !== saved
  const setRow = (i, k, v) => setDa({ ...da, rows: da.rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)) })
  const save = async () => { const d = await api.put(`/defect/${obj.id}`, da); setDa(d); setSaved(JSON.stringify(d)); return d }

  const addPasted = async () => {
    const rows = await api.post('/defect/parse', { text: paste })
    if (!rows.length) return toast('Не удалось распознать строки — нужны столбцы «наименование, ед., количество»')
    setDa({ ...da, rows: [...da.rows, ...rows] }); setPaste('')
    toast(`Добавлено строк: ${rows.length}. Проверьте разделы и сохраните`)
  }

  const build = async () => {
    if (dirty) await save()
    const r = await api.post(`/defect/${obj.id}/build`)
    toast(`Готово: новых папок ${r.folders_created}, новых АОСР ${r.aosr_created}, обновлено ${r.aosr_updated}`)
    onBuilt()
  }

  const bySection = da.rows.reduce((m, r) => ({ ...m, [r.section]: (m[r.section] || 0) + 1 }), {})

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row">
        <h2 style={{ margin: 0 }}>Дефектный акт № {da.no || '—'}</h2>
        <span className="muted">{da.rows.length} строк · разделов: {Object.keys(bySection).length}</span>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => setOpen(!open)}>{open ? 'Свернуть' : 'Открыть'}</button>
        <button className="btn primary" disabled={!da.rows.length} onClick={build}>⚡ Разложить по папкам и создать АОСР</button>
      </div>
      {!open && Object.keys(bySection).length > 0 && (
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          {Object.entries(bySection).map(([s, n]) => <span key={s} className="badge">{s}: {n}</span>)}
        </div>
      )}
      {open && (
        <div style={{ marginTop: 12 }}>
          <div className="grid g3" style={{ maxWidth: 560 }}>
            <label className="field">Номер<input value={da.no} onChange={(e) => setDa({ ...da, no: e.target.value })} /></label>
            <label className="field">Дата<input type="date" value={da.date} onChange={(e) => setDa({ ...da, date: e.target.value })} /></label>
            <label className="field">Листов<input type="number" min="1" value={da.sheets} onChange={(e) => setDa({ ...da, sheets: +e.target.value })} /></label>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="t edit">
              <thead><tr><th>№</th><th style={{ minWidth: 190 }}>Раздел (папка)</th><th style={{ minWidth: 320 }}>Наименование вида работ</th><th>Ед.</th><th>Кол-во</th><th></th></tr></thead>
              <tbody>
                {da.rows.map((r, i) => (
                  <tr key={r.id || i}>
                    <td className="muted">{i + 1}</td>
                    <td><select value={r.section} onChange={(e) => setRow(i, 'section', e.target.value)}>{sections.map((s) => <option key={s}>{s}</option>)}</select></td>
                    <td><input value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} /></td>
                    <td><input value={r.unit} onChange={(e) => setRow(i, 'unit', e.target.value)} style={{ width: 70 }} /></td>
                    <td><input value={r.qty} onChange={(e) => setRow(i, 'qty', e.target.value)} style={{ width: 90 }} /></td>
                    <td><button className="btn sm ghost" onClick={() => setDa({ ...da, rows: da.rows.filter((_, j) => j !== i) })}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={() => setDa({ ...da, rows: [...da.rows, { section: sections[0], name: '', unit: '', qty: '' }] })}>+ Строка</button>
          </div>
          <label className="field" style={{ marginTop: 14 }}>Вставить строки из Excel или Word (выделите столбцы «наименование, ед. изм., количество» и вставьте сюда)
            <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Демонтаж чугунных радиаторов\tшт\t214\nМонтаж трубы ПП Ø25\tм.п.\t790'} />
          </label>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" disabled={!paste.trim()} onClick={addPasted}>Распознать и добавить</button>
            <span className="muted small">Раздел подбирается автоматически по словам — проверьте его в таблице.</span>
            <div style={{ flex: 1 }} />
            {dirty && <button className="btn dark" onClick={async () => { await save(); toast('Дефектный акт сохранён') }}>Сохранить дефектный акт</button>}
          </div>
        </div>
      )}
    </div>
  )
}
