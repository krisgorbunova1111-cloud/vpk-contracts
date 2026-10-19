import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ObjectSelect, useApp, useSelectedObject } from '../App.jsx'
import { api, fileUrl, fmtDate } from '../api.js'

const RD_NAMES = { AR: 'Архитектурные решения', KR: 'Конструктивные решения', OV: 'Отопление и вентиляция', VK: 'Водоснабжение и канализация', EOM: 'Электроснабжение', TS: 'Теплоснабжение' }
const PRINT_STEPS = ['Печать', 'Сшивка и нумерация', 'Подпись ответственных лиц', 'Передача заказчику']

export default function Docs() {
  const { meta, reload, toast } = useApp()
  const [obj, select] = useSelectedObject()
  const [ready, setReady] = useState([])
  const [cl, setCl] = useState(null)
  const [mats, setMats] = useState([])
  const [printDone, setPrintDone] = useState({})

  useEffect(() => {
    if (!obj) return
    api.get(`/docs/${obj.id}/readiness`).then(setReady)
    api.get(`/checklists/${obj.id}`).then(setCl)
    api.get('/materials').then(setMats)
  }, [obj?.id])

  if (!obj) return null
  const okCount = ready.filter((r) => r.ok).length
  const rdSections = ['AR', 'KR', ...obj.systems]
  const chosen = mats.filter((m) => cl?.materials.includes(m.id))
  const steps = printDone[obj.id] || []
  const toggleStep = (s) => setPrintDone({ ...printDone, [obj.id]: steps.includes(s) ? steps.filter((x) => x !== s) : [...steps, s] })

  const finish = async () => {
    await api.patch(`/objects/${obj.id}`, { stage: 'done' })
    await reload(); toast(`Объект «${obj.name}» сдан заказчику`)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Генератор РД</h1>
          <div className="muted">Данные чек-листа + обмерные планы + справочник сертификатов → готовые тома в Word</div>
        </div>
        <div className="spacer" />
        <ObjectSelect value={obj.id} onChange={select} />
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Готовность данных</h2>
            <div style={{ flex: 1 }} />
            <span className={'badge ' + (okCount === ready.length ? 'ok' : 'warn')}>{okCount} из {ready.length}</span>
          </div>
          {ready.map((r) => (
            <div key={r.item} className="row" style={{ padding: '7px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
              <span style={{ color: r.ok ? 'var(--ok)' : 'var(--warn)', fontWeight: 800, width: 18 }}>{r.ok ? '✓' : '!'}</span>
              <div style={{ flex: 1 }}>{r.item}{!r.ok && <div className="muted small">{r.hint}</div>}</div>
            </div>
          ))}
          <p className="muted small" style={{ marginBottom: 0 }}>Том можно собрать и с неполными данными — недостающее будет помечено в документе.</p>
        </div>

        <div className="card">
          <h2>Исполнительная документация</h2>
          <p className="muted" style={{ marginTop: 0 }}>ИД собирается папками по видам работ — как в ваших образцах: реестр формы 1.1, приказы, дефектный акт, АОСР с исполнительными схемами, акты испытаний, документы о качестве.</p>
          <Link className="btn primary" to={`/id?o=${obj.id}`}>Открыть папки ИД →</Link>
        </div>
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Заготовки разделов РД</h2>
          <p className="muted small" style={{ marginTop: 0 }}>Титульный лист, общие данные, исходное состояние из чек-листа и обмерный план — проектировщику остаётся дописать решения.</p>
          <div className="grid g2">
            {rdSections.map((s) => (
              <a key={s} className="btn" href={fileUrl(`/docs/${obj.id}/rd/${s}.docx`)} style={{ justifyContent: 'space-between' }}>
                <span><b>{meta.rd_sections[s]}</b> · {RD_NAMES[s]}</span><span>⬇</span>
              </a>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Сертификаты и паспорта (автоподстановка)</h2>
          {chosen.length ? (
            <table className="t">
              <thead><tr><th>Материал</th><th>Документ</th><th>Действует до</th></tr></thead>
              <tbody>
                {chosen.map((m) => {
                  const expired = m.cert_until < new Date().toISOString().slice(0, 10)
                  return (
                    <tr key={m.id}>
                      <td>{m.name}<div className="muted small">{m.supplier}</div></td>
                      <td className="small">{m.cert_no}{m.passport && <div><span className="badge info">+ паспорт</span></div>}</td>
                      <td><span className={'badge ' + (expired ? 'bad' : 'ok')}>{fmtDate(m.cert_until)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : <div className="hint-box">В чек-листе не отмечены материалы. Их выбирают на планшете (вкладка «Узлы и материалы»).</div>}
        </div>
      </div>

      <div className="card">
        <h2>Печать, сшивка и подпись</h2>
        <div className="row">
          {PRINT_STEPS.map((s, i) => (
            <label key={s} className="row" style={{ gap: 6, padding: '6px 12px', border: '1px solid var(--line)', borderRadius: 9, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={steps.includes(s)} onChange={() => toggleStep(s)} />{i + 1}. {s}
            </label>
          ))}
          <div style={{ flex: 1 }} />
          <button className="btn dark" disabled={steps.length < PRINT_STEPS.length || obj.stage === 'done'} onClick={finish}>
            {obj.stage === 'done' ? 'Сдано ✓' : 'Отметить «Сдано»'}
          </button>
        </div>
      </div>
    </>
  )
}
