import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ObjectSelect, useApp, useSelectedObject } from '../App.jsx'
import { api, fileUrl, fmtDate } from '../api.js'

const LEVEL = { bad: ['!', 'var(--bad)'], warn: ['!', 'var(--warn)'], ok: ['✓', 'var(--ok)'] }

export default function IdFolders() {
  const { toast } = useApp()
  const [obj, select] = useSelectedObject()
  const [folders, setFolders] = useState([])
  const [sel, setSel] = useState(null)
  const [meta, setMeta] = useState(null)
  const [mats, setMats] = useState([])

  const load = async (keep) => {
    const f = await api.get(`/folders?object_id=${obj.id}`)
    setFolders(f)
    setSel((s) => (keep && f.find((x) => x.id === keep) ? keep : f.find((x) => x.id === s)?.id || f[0]?.id || null))
  }
  useEffect(() => { api.get('/id/meta').then(setMeta); api.get('/materials').then(setMats) }, [])
  useEffect(() => { if (obj) { setSel(null); load() } }, [obj?.id])
  if (!obj || !meta) return null

  const folder = folders.find((f) => f.id === sel)
  const addFolder = async () => {
    const f = await api.post('/folders', { object_id: obj.id, title: 'Новый вид работ' })
    await load(f.id); toast(`Папка № ${f.no} создана — заполните вид работ и АОСР`)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Исполнительная документация</h1>
          <div className="muted">Одна папка — один вид работ. Реестр, нумерация листов и АОСР собираются автоматически</div>
        </div>
        <div className="spacer" />
        <Link className="btn" to={`/participants?o=${obj.id}`}>Участники объекта</Link>
        <ObjectSelect value={obj.id} onChange={select} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(230px, 300px) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="card stack" style={{ gap: 8 }}>
          <h2 style={{ margin: 0 }}>Папки</h2>
          {folders.map((f) => {
            const bad = f.issues.filter((i) => i.level === 'bad').length
            const warn = f.issues.filter((i) => i.level === 'warn').length
            return (
              <button key={f.id} className={'folder-btn' + (f.id === sel ? ' on' : '')} onClick={() => setSel(f.id)}>
                <b>Папка № {f.no}</b>
                <span>{f.title}</span>
                <span className="row" style={{ gap: 4 }}>
                  <span className="badge">{f.aosr.length} АОСР</span>
                  <span className="badge">{f.registry.reduce((s, r) => s + r.sheets, 0)} л.</span>
                  {bad > 0 && <span className="badge bad">ошибки: {bad}</span>}
                  {!bad && warn > 0 && <span className="badge warn">замечания: {warn}</span>}
                  {!bad && !warn && <span className="badge ok">готово</span>}
                </span>
              </button>
            )
          })}
          {!folders.length && <div className="muted small">Папок пока нет</div>}
          <button className="btn primary" onClick={addFolder}>+ Новая папка</button>
        </div>

        {folder
          ? <FolderEditor key={folder.id} folder={folder} meta={meta} mats={mats} reload={() => load(folder.id)} toast={toast} />
          : <div className="card empty">Создайте первую папку — по одной на каждый вид работ из дефектного акта</div>}
      </div>
    </>
  )
}

function FolderEditor({ folder, meta, mats, reload, toast }) {
  const [f, setF] = useState(folder)
  const [openA, setOpenA] = useState(null)
  const dirty = JSON.stringify(pick(f)) !== JSON.stringify(pick(folder))
  const set = (k, v) => setF({ ...f, [k]: v })

  const save = async () => { await api.patch(`/folders/${folder.id}`, pick(f)); await reload(); toast('Папка сохранена, реестр пересчитан') }
  const addAosr = async () => {
    const a = await api.post('/aosr', { folder_id: folder.id })
    await reload(); setOpenA(a.id)
  }
  const del = async () => {
    if (!confirm(`Удалить папку № ${folder.no} вместе с её АОСР?`)) return
    await api.del(`/folders/${folder.id}`); await reload(); toast('Папка удалена')
  }
  const addTest = (name) => set('tests', [...f.tests, { name, no: 'б/н', date: '', sheets: 1 }])
  const missingTests = (meta.expected_tests[f.section] || []).filter((t) => !f.tests.some((x) => x.name === t))

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Папка № {folder.no}</h2>
          <div style={{ flex: 1 }} />
          <a className="btn primary" href={fileUrl(`/folders/${folder.id}/docx`)} onClick={() => toast('Папка ИД собрана — файл Word скачивается')}>⬇ Собрать папку (Word)</a>
          <button className="btn ghost" onClick={del}>Удалить</button>
        </div>
        <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <label className="field">Вид работ (как на титуле папки)<input value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label className="field">Раздел<select value={f.section} onChange={(e) => set('section', e.target.value)}>
            {meta.sections.map((s) => <option key={s}>{s}</option>)}</select></label>
        </div>
        <div className="grid g3" style={{ marginTop: 12 }}>
          <label className="field">Дефектный акт №<input value={f.defect_act?.no || ''} onChange={(e) => set('defect_act', { sheets: 1, date: '', ...f.defect_act, no: e.target.value })} /></label>
          <label className="field">от<input type="date" value={f.defect_act?.date || ''} onChange={(e) => set('defect_act', { sheets: 1, no: '', ...f.defect_act, date: e.target.value })} /></label>
          <label className="field">листов<input type="number" min="1" value={f.defect_act?.sheets || 1} onChange={(e) => set('defect_act', { no: '', date: '', ...f.defect_act, sheets: +e.target.value })} /></label>
        </div>
        {dirty && <div className="row" style={{ marginTop: 12 }}><button className="btn dark" onClick={save}>Сохранить изменения папки</button><span className="muted small">Есть несохранённые изменения</span></div>}
      </div>

      <div className="card">
        <h2>Проверка полноты</h2>
        {folder.issues.map((i, k) => (
          <div key={k} className="row" style={{ padding: '5px 0', alignItems: 'flex-start' }}>
            <span style={{ color: LEVEL[i.level][1], fontWeight: 800, width: 16 }}>{LEVEL[i.level][0]}</span>
            <span style={{ flex: 1 }}>{i.text}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Акты освидетельствования скрытых работ</h2>
          <div style={{ flex: 1 }} />
          <button className="btn sm primary" onClick={addAosr}>+ АОСР</button>
        </div>
        {folder.aosr.map((a) => (
          openA === a.id
            ? <AosrForm key={a.id} a={a} mats={mats} meta={meta} section={folder.section} onClose={() => setOpenA(null)} reload={reload} toast={toast} />
            : (
              <div key={a.id} className="aosr-row" onClick={() => setOpenA(a.id)}>
                <b>№ {a.no}</b>
                <span className="muted">{fmtDate(a.date)}</span>
                <span style={{ flex: 1 }}>{a.works || <i className="muted">не заполнено</i>}</span>
                <span className="badge">{a.scheme?.no ? `ИС № ${a.scheme.no}, ${a.scheme.sheets} л.` : 'нет схемы'}</span>
                <a className="btn sm" href={fileUrl(`/aosr/${a.id}/docx`)} onClick={(e) => e.stopPropagation()}>⬇ Word</a>
              </div>
            )
        ))}
        {!folder.aosr.length && <div className="muted small">АОСР ещё нет</div>}
      </div>

      <div className="grid g2">
        <DocList title="Акты испытаний" items={f.tests} onChange={(v) => set('tests', v)} withDate />
        <div className="stack" style={{ gap: 16 }}>
          <DocList title="Журналы" items={f.journals} onChange={(v) => set('journals', v)} />
          <DocList title="Прочие документы" items={f.extra} onChange={(v) => set('extra', v)} />
        </div>
      </div>
      {missingTests?.length > 0 && (
        <div className="hint-box">
          Обычно для раздела «{f.section}» нужны:{' '}
          {missingTests.map((t) => <button key={t} className="btn sm" style={{ margin: 3 }} onClick={() => addTest(t)}>+ {t}</button>)}
        </div>
      )}
      {dirty && <button className="btn dark" onClick={save}>Сохранить изменения папки</button>}

      <div className="card">
        <h2>Реестр исполнительной документации (форма № 1.1)</h2>
        <table className="t">
          <thead><tr><th>№</th><th>Наименование документа</th><th>№ документа</th><th className="num">Листов</th><th className="num">Лист по списку</th></tr></thead>
          <tbody>
            {folder.registry.map((r) => (
              <tr key={r.n}><td>{r.n}</td><td>{r.name}</td><td className="small">{r.no}</td><td className="num">{r.sheets}</td><td className="num">{r.pages}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted small" style={{ marginBottom: 0 }}>Нумерация листов пересчитывается сама при любом изменении. Приказы берутся из справочника участников, сертификаты и паспорта — из материалов, отмеченных в АОСР.</p>
      </div>
    </div>
  )
}

const pick = (f) => ({ title: f.title, section: f.section, defect_act: f.defect_act, tests: f.tests, journals: f.journals, extra: f.extra })

function DocList({ title, items, onChange, withDate }) {
  const upd = (i, k, v) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <div style={{ flex: 1 }} />
        <button className="btn sm" onClick={() => onChange([...items, { name: '', no: 'б/н', date: '', sheets: 1 }])}>+</button>
      </div>
      {items.map((x, i) => (
        <div key={i} className="doc-line">
          <input placeholder="Наименование" value={x.name} onChange={(e) => upd(i, 'name', e.target.value)} />
          <input placeholder="№" value={x.no} onChange={(e) => upd(i, 'no', e.target.value)} style={{ width: 80 }} />
          {withDate && <input type="date" value={x.date || ''} onChange={(e) => upd(i, 'date', e.target.value)} style={{ width: 140 }} />}
          <input type="number" min="1" title="листов" value={x.sheets} onChange={(e) => upd(i, 'sheets', +e.target.value)} style={{ width: 64 }} />
          <button className="btn sm ghost" title="Удалить" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      {!items.length && <div className="muted small">нет</div>}
    </div>
  )
}

function AosrForm({ a: initial, mats, meta, section, onClose, reload, toast }) {
  const [a, setA] = useState(initial)
  const set = (k, v) => setA({ ...a, [k]: v })
  const save = async () => { await api.patch(`/aosr/${a.id}`, a); await reload(); onClose(); toast(`АОСР № ${a.no} сохранён`) }
  const del = async () => { if (!confirm(`Удалить АОСР № ${a.no}?`)) return; await api.del(`/aosr/${a.id}`); await reload(); onClose() }
  const toggleMat = (id) => set('materials', a.materials.includes(id) ? a.materials.filter((x) => x !== id) : [...a.materials, id])
  const normsList = meta.norms[section] || meta.default_norms

  return (
    <div className="aosr-form">
      <div className="grid g3">
        <label className="field">Номер акта<input value={a.no} onChange={(e) => set('no', e.target.value)} /></label>
        <label className="field">Дата акта<input type="date" value={a.date} onChange={(e) => set('date', e.target.value)} /></label>
        <label className="field">Экземпляров<input type="number" value={a.copies} onChange={(e) => set('copies', +e.target.value)} /></label>
      </div>
      <label className="field" style={{ marginTop: 10 }}>1. Предъявленные работы (наименование и объёмы)
        <textarea rows={3} value={a.works} onChange={(e) => set('works', e.target.value)} placeholder="Монтаж системы отопления с 1-го по 9-й этаж: монтаж радиаторов — 214 шт., труб Ø25 — 790 м.п." /></label>
      <label className="field" style={{ marginTop: 10 }}>2. Работы выполнены по (если пусто — дефектный акт папки)
        <input value={a.basis} onChange={(e) => set('basis', e.target.value)} placeholder="Дефектный акт № 1 от …" /></label>
      <div className="field" style={{ marginTop: 10 }}>3. Применённые материалы (сертификаты попадут в реестр папки)
        <div className="row" style={{ gap: 6 }}>
          {mats.map((m) => (
            <button key={m.id} className={'btn sm ' + (a.materials.includes(m.id) ? 'primary' : '')} onClick={() => toggleMat(m.id)}
              title={`${m.cert_no}, до ${fmtDate(m.cert_until)}`}>{m.name}</button>
          ))}
        </div>
      </div>
      <div className="grid g3" style={{ marginTop: 10 }}>
        <label className="field">4. Исполнительная схема №<input value={a.scheme?.no || ''} onChange={(e) => set('scheme', { ...a.scheme, no: e.target.value })} /></label>
        <label className="field">от<input type="date" value={a.scheme?.date || ''} onChange={(e) => set('scheme', { ...a.scheme, date: e.target.value })} /></label>
        <label className="field">листов<input type="number" min="1" value={a.scheme?.sheets || 1} onChange={(e) => set('scheme', { ...a.scheme, sheets: +e.target.value })} /></label>
      </div>
      <div className="grid g2" style={{ marginTop: 10 }}>
        <label className="field">5. Начало работ<input type="date" value={a.start} onChange={(e) => set('start', e.target.value)} /></label>
        <label className="field">Окончание работ<input type="date" value={a.end} onChange={(e) => set('end', e.target.value)} /></label>
      </div>
      <div className="field" style={{ marginTop: 10 }}>6. Нормативы
        <div className="row" style={{ gap: 6 }}>
          {normsList.map((n) => (
            <button key={n} className={'btn sm ' + (a.norms.includes(n) ? 'primary' : '')}
              onClick={() => set('norms', a.norms.includes(n) ? a.norms.filter((x) => x !== n) : [...a.norms, n])}>{n.split(' «')[0]}</button>
          ))}
        </div>
      </div>
      <label className="field" style={{ marginTop: 10 }}>7. Разрешается производство последующих работ
        <input value={a.next_works} onChange={(e) => set('next_works', e.target.value)} /></label>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn dark" onClick={save}>Сохранить АОСР</button>
        <button className="btn" onClick={onClose}>Свернуть</button>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={del}>Удалить акт</button>
      </div>
    </div>
  )
}
