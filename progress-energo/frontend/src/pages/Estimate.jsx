import { useEffect, useState } from 'react'
import { ObjectSelect, useSelectedObject } from '../App.jsx'
import { api, fileUrl, fmtMoney } from '../api.js'

export default function Estimate() {
  const [obj, select] = useSelectedObject()
  const [e, setE] = useState(null)
  useEffect(() => { if (obj) api.get(`/estimate/${obj.id}`).then(setE) }, [obj?.id])
  if (!obj) return null

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Сметы на ПИР и интеграции</h1>
          <div className="muted">Смета считается автоматически из чек-листа (виды работ) и площади объекта</div>
        </div>
        <div className="spacer" />
        <ObjectSelect value={obj.id} onChange={select} />
      </div>

      {e && (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2.3fr) minmax(260px, 1fr)' }}>
          <div className="card">
            <h2>Смета: {obj.name}</h2>
            <div className="hint-box" style={{ marginBottom: 12 }}>Общий коэффициент <b>×{e.k}</b>: {e.k_explain}</div>
            <table className="t">
              <thead><tr><th>№</th><th>Наименование работ</th><th>Обоснование</th><th className="num">Кол-во</th><th className="num">Цена</th><th className="num">Сумма</th></tr></thead>
              <tbody>
                {e.lines.map((l, i) => (
                  <tr key={l.code}>
                    <td>{i + 1}</td><td>{l.name}</td><td className="muted small">{l.basis}</td>
                    <td className="num">{l.qty.toLocaleString('ru-RU')} {l.unit}</td>
                    <td className="num">{l.price.toLocaleString('ru-RU')} ₽</td>
                    <td className="num"><b>{fmtMoney(l.sum)}</b></td>
                  </tr>
                ))}
                <tr><td colSpan={5} className="num">Итого без НДС</td><td className="num"><b>{fmtMoney(e.total)}</b></td></tr>
                <tr><td colSpan={5} className="num">НДС {Math.round(e.vat_rate * 100)}%</td><td className="num">{fmtMoney(e.vat)}</td></tr>
                <tr><td colSpan={5} className="num"><b>Всего с НДС</b></td><td className="num" style={{ color: 'var(--accent)', fontSize: 16 }}><b>{fmtMoney(e.total_vat)}</b></td></tr>
              </tbody>
            </table>
            <p className="muted small" style={{ marginBottom: 0 }}>Расценки — внутренние нормы-заглушки (правятся в одном файле на сервере). Строка «Лабораторные испытания» появляется, если на планшете отмечен лаб. контроль.</p>
          </div>

          <div className="stack">
            <div className="card stack">
              <h2 style={{ margin: 0 }}>Выгрузки</h2>
              <a className="btn" href={fileUrl(`/export/grand/${obj.id}`)}>⬇ XML для Гранд-Сметы / ЦСМ</a>
              <a className="btn" href={fileUrl(`/export/axon/${obj.id}`)}>⬇ Пакет для «Аксон» (СОУ, РД)</a>
            </div>
            <div className="card">
              <h2>Статус интеграций</h2>
              {[['Гранд-Смета', 'Файловый обмен XML', 'info'], ['ЦСМ', 'Файловый обмен XML', 'info'], ['Аксон', 'Ждём API / формат', 'warn'], ['Лаборатория ТНК РФ', 'Заявки внутри системы, API — позже', 'warn']].map(([n, s, c]) => (
                <div key={n} className="row" style={{ justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <b>{n}</b><span className={'badge ' + c}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
