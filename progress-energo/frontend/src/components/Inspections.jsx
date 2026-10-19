// Бланки проверки состава работ и контрольных замеров (по чек-листу заказчика).
// Один и тот же компонент работает на планшете (big) и в офисе.
import { useEffect, useMemo, useState } from 'react'
import { api, fmtDate } from '../api.js'

const RES_CLASS = { ok: 'satisfactory', diff: 'emergency', none: 'limited' }

export function InspectionsPanel({ obj, toast, big = false }) {
  const [blanks, setBlanks] = useState([])
  const [meta, setMeta] = useState(null)
  const [list, setList] = useState([])
  const [aosr, setAosr] = useState([])
  const [open, setOpen] = useState(null)
  const [picking, setPicking] = useState(false)

  const load = () => api.get(`/inspections?object_id=${obj.id}`).then(setList)
  useEffect(() => {
    api.get('/blanks').then(setBlanks)
    api.get('/id/meta').then(setMeta)
    api.get(`/folders?object_id=${obj.id}`).then((fs) => setAosr(fs.flatMap((f) => f.aosr.map((a) => ({ ...a, folder: f.title })))))
    load()
  }, [obj.id])

  const byId = Object.fromEntries(blanks.map((b) => [b.id, b]))
  if (!meta || !blanks.length) return <div className="empty">Загрузка бланков…</div>

  const start = async (blank_id) => {
    const i = await api.post('/inspections', { object_id: obj.id, blank_id })
    setPicking(false); await load(); setOpen(i.id)
  }

  const current = list.find((i) => i.id === open)
  if (current) {
    return <InspectionForm key={current.id} insp={current} blank={byId[current.blank_id]} meta={meta} aosr={aosr} big={big}
      onClose={() => setOpen(null)}
      onSave={async (data, close) => { await api.put(`/inspections/${data.id}`, data); await load(); toast('Бланк сохранён'); if (close) setOpen(null) }}
      onDelete={async () => { if (!confirm('Удалить заполненный бланк?')) return; await api.del(`/inspections/${current.id}`); setOpen(null); load() }} />
  }

  if (picking) return <BlankPicker blanks={blanks} big={big} onPick={start} onCancel={() => setPicking(false)} />

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row">
        <button className={'btn primary' + (big ? ' scan-btn' : '')} style={big ? { flex: 1 } : {}} onClick={() => setPicking(true)}>+ Заполнить бланк проверки</button>
      </div>
      {list.length ? (
        <div className="card" style={{ padding: big ? 10 : 18 }}>
          <table className="t">
            <thead><tr><th>Бланк</th><th>Вид работ</th><th>Дата</th><th>Итог</th><th></th></tr></thead>
            <tbody>
              {list.map((i) => {
                const b = byId[i.blank_id]
                const diff = Object.values(i.results).includes('diff')
                const done = Object.values(i.results).every(Boolean)
                return (
                  <tr key={i.id} className="click" onClick={() => setOpen(i.id)}>
                    <td><b>{b.code}</b></td>
                    <td>{b.name}<div className="muted small">{b.section}</div></td>
                    <td>{fmtDate(i.date)}</td>
                    <td>{diff ? <span className={'badge ' + (i.status === 'closed' ? 'ok' : 'bad')}>{i.status === 'closed' ? 'замечание закрыто' : 'расхождение'}</span>
                      : done ? <span className="badge ok">подтверждено</span> : <span className="badge warn">не завершён</span>}</td>
                    <td><span className="btn sm">Открыть</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : <div className="hint-box">По объекту ещё нет заполненных бланков. Выберите вид работ — откроется бланк с показателями и местами для двух контрольных замеров.</div>}
    </div>
  )
}

function BlankPicker({ blanks, onPick, onCancel, big }) {
  const [q, setQ] = useState('')
  const [section, setSection] = useState('')
  const sections = [...new Set(blanks.map((b) => b.section))]
  const shown = blanks.filter((b) => (!section || b.section === section) && (!q || (b.code + ' ' + b.name).toLowerCase().includes(q.toLowerCase())))
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row">
        <input placeholder="Поиск: «радиатор», «окна», Б27…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, maxWidth: big ? 'none' : 420 }} />
        <button className="btn" onClick={onCancel}>Отмена</button>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button className={'btn sm ' + (!section ? 'dark' : '')} onClick={() => setSection('')}>Все</button>
        {sections.map((s) => <button key={s} className={'btn sm ' + (section === s ? 'dark' : '')} onClick={() => setSection(s)}>{s}</button>)}
      </div>
      <div className="chip-grid">
        {shown.map((b) => (
          <div key={b.id} className="chip" onClick={() => onPick(b.id)}>
            <span className="badge">{b.code}</span>
            <div>{b.name}<div className="muted small">{b.section} · {b.rows.length} показателей</div></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InspectionForm({ insp, blank, meta, aosr, onSave, onClose, onDelete, big }) {
  const [x, setX] = useState(insp)
  const dirty = useMemo(() => JSON.stringify(x) !== JSON.stringify(insp), [x, insp])
  const set = (k, v) => setX({ ...x, [k]: v })
  const setRow = (i, k, v) => set('rows', x.rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const hasDiff = Object.values(x.results).includes('diff')
  const linked = aosr.find((a) => a.id === x.aosr_id)
  const vols = linked?.volumes || []
  const num = (v) => { const m = String(v ?? '').replace(/\s/g, '').replace(',', '.').match(/^-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null }
  // расхождение «по документам» и «итог» больше 3 % — подсвечиваем
  const gap = (r) => { const d = num(r.doc), t = num(r.total); return d && t !== null && Math.abs(t - d) / Math.abs(d) > 0.03 ? Math.round(((t - d) / d) * 100) : null }
  const gaps = x.rows.filter((r) => gap(r) !== null).length

  // «Итог» = среднее двух замеров, пока пользователь не вписал своё значение
  const avg = (r) => {
    const n = [r.m1, r.m2].map((v) => parseFloat(String(v).replace(',', '.'))).filter((v) => !isNaN(v))
    return n.length ? String(+(n.reduce((s, v) => s + v, 0) / n.length).toFixed(3)).replace('.', ',') : ''
  }
  const setMeasure = (i, k, v) => set('rows', x.rows.map((r, j) => {
    if (j !== i) return r
    const next = { ...r, [k]: v }
    return !r.total || r.total === avg(r) ? { ...next, total: avg(next) } : next
  }))

  return (
    <div className={'stack insp' + (big ? ' big' : '')} style={{ gap: 14 }}>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <span className="badge accent" style={{ fontSize: 14 }}>{blank.code}</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0 }}>{blank.name}</h2>
            <div className="muted small">Раздел: {blank.section}</div>
          </div>
          <button className="btn" onClick={() => (dirty && !confirm('Есть несохранённые изменения. Закрыть без сохранения?') ? null : onClose())}>← К списку</button>
        </div>
        {blank.hint && <div className="hint-box" style={{ marginTop: 10 }}>💡 {blank.hint}</div>}
      </div>

      <div className="card">
        <h3>1. Данные проверки</h3>
        <div className="grid g3">
          <label className="field">Дата<input type="date" value={x.date} onChange={(e) => set('date', e.target.value)} /></label>
          <label className="field">Проверяющий<input value={x.inspector} onChange={(e) => set('inspector', e.target.value)} /></label>
          <label className="field">Представитель подрядчика<input value={x.contractor_rep} onChange={(e) => set('contractor_rep', e.target.value)} /></label>
        </div>
        <div className="grid g4" style={{ marginTop: 10 }}>
          {[['entrance', 'Подъезд'], ['floor', 'Этаж'], ['apt', 'Квартира'], ['axes', 'Оси / участок']].map(([k, l]) => (
            <label key={k} className="field">{l}<input value={x.place[k]} onChange={(e) => set('place', { ...x.place, [k]: e.target.value })} /></label>
          ))}
        </div>
        <h3 style={{ marginTop: 14 }}>2. Документ для сверки и доступность</h3>
        <div className="grid g2">
          <label className="field">АОСР
            <select value={x.aosr_id} onChange={(e) => set('aosr_id', e.target.value)}>
              <option value="">— не выбран / нет АОСР —</option>
              {aosr.map((a) => <option key={a.id} value={a.id}>№ {a.no} от {fmtDate(a.date)} · {a.works.slice(0, 60)}</option>)}
            </select>
          </label>
          <div className="field">Доступность слоя
            <div className="seg">
              {Object.entries(meta.access).map(([k, l]) => <button key={k} className={x.access === k ? 'on limited' : ''} onClick={() => set('access', k)}>{l}</button>)}
            </div>
          </div>
        </div>
        {linked && <div className="hint-box" style={{ marginTop: 10 }}>По АОСР № {linked.no}: {linked.works}{vols.length > 0 && ' — объёмы можно подставить в графу «По документам» кнопкой ↓ в таблице замеров.'}</div>}
      </div>

      <div className="card">
        <h3>3. Контрольные замеры</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="t edit">
            <thead><tr><th style={{ minWidth: 200 }}>Показатель</th><th>Ед.</th><th style={{ minWidth: 140 }}>По документам</th><th>Замер 1</th><th>Замер 2</th><th>Итог</th></tr></thead>
            <tbody>
              {x.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td className="muted small">{r.unit}</td>
                  <td>
                    <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      <input value={r.doc} onChange={(e) => setRow(i, 'doc', e.target.value)} />
                      {vols.length > 0 && (
                        <select className="pick" title="Подставить объём из АОСР" value="" onChange={(e) => e.target.value !== '' && setRow(i, 'doc', `${String(vols[e.target.value].qty).replace('.', ',')} ${vols[e.target.value].unit}`)}>
                          <option value="">↓</option>
                          {vols.map((v, k) => <option key={k} value={k}>{v.name} — {v.qty} {v.unit}</option>)}
                        </select>
                      )}
                    </div>
                  </td>
                  <td><input inputMode="decimal" value={r.m1} onChange={(e) => setMeasure(i, 'm1', e.target.value)} /></td>
                  <td><input inputMode="decimal" value={r.m2} onChange={(e) => setMeasure(i, 'm2', e.target.value)} /></td>
                  <td><input className={gap(r) !== null ? 'gap' : ''} title={gap(r) !== null ? `Отличается от документов на ${gap(r)} %` : ''} value={r.total} onChange={(e) => setRow(i, 'total', e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {gaps > 0 && (
          <div className="hint-box" style={{ marginTop: 10, borderColor: 'var(--bad)', color: 'var(--bad)' }}>
            Итог отличается от документов более чем на 3 % в строках: {gaps}.{' '}
            {x.results.volumes !== 'diff' && <button className="btn sm" onClick={() => set('results', { ...x.results, volumes: 'diff' })}>Отметить «Объемы: расхождение»</button>}
          </div>
        )}
        <p className="muted small" style={{ marginBottom: 0 }}>Если оба замера — числа, «Итог» заполнится средним (можно исправить). Не измерено — пишите «не измерено» и источник, а не ноль.</p>
      </div>

      <div className="card">
        <div className="grid g2">
          <label className="field">4. Расчёт объёма и вычетов<textarea value={x.calc} onChange={(e) => set('calc', e.target.value)} placeholder="Размеры, единицы, количество, исключаемые участки" /></label>
          <label className="field">5. Примечания и выявленные расхождения<textarea value={x.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Место, показатель, по документам / по факту, причина" /></label>
        </div>
        <h3 style={{ marginTop: 14 }}>6. Результат проверки</h3>
        <div className="stack" style={{ gap: 10 }}>
          {Object.entries(meta.result_keys).map(([k, { name, options }]) => (
            <div key={k} className="res-line">
              <b>{name}</b>
              <div className="seg" style={{ gridTemplateColumns: `repeat(${Object.keys(options).length}, 1fr)` }}>
                {Object.entries(options).map(([v, l]) => (
                  <button key={v} className={(x.results[k] === v ? 'on ' : '') + RES_CLASS[v]} onClick={() => set('results', { ...x.results, [k]: v })}>{l}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>7. Действия и подтверждающие материалы</h3>
        <div className="grid g2">
          <label className="field">Требуемое действие<input value={x.action} onChange={(e) => set('action', e.target.value)} /></label>
          <label className="field">Ответственный<input value={x.responsible} onChange={(e) => set('responsible', e.target.value)} /></label>
          <label className="field">Срок<input type="date" value={x.deadline} onChange={(e) => set('deadline', e.target.value)} /></label>
          <label className="field">Способ контроля и прибор<input value={x.method} onChange={(e) => set('method', e.target.value)} placeholder="Рулетка, лазерный дальномер, толщиномер…" /></label>
        </div>
        <label className="field" style={{ marginTop: 10 }}>Фото и приложения<input value={x.photos} onChange={(e) => set('photos', e.target.value)} placeholder="Номера фото, файлы" /></label>
        {hasDiff && (
          <label className="row" style={{ marginTop: 12, gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={x.status === 'closed'} onChange={(e) => set('status', e.target.checked ? 'closed' : 'draft')} />
            Замечание устранено, повторная проверка пройдена
          </label>
        )}
      </div>

      <div className="row" style={big ? { position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '10px 0', zIndex: 2 } : {}}>
        <button className={'btn primary' + (big ? ' scan-btn' : '')} style={big ? { flex: 1 } : {}} onClick={() => onSave(x, true)}>💾 Сохранить бланк</button>
        {!big && <button className="btn" onClick={() => onSave(x, false)}>Сохранить и остаться</button>}
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={onDelete}>Удалить</button>
      </div>
    </div>
  )
}
