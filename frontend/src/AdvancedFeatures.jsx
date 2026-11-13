import { useEffect, useState, useCallback } from 'react'

export default function AdvancedFeatures({ api, session, works, showDemoData }) {
  const [tab, setTab] = useState('Analytics')
  const [analytics, setAnalytics] = useState(null)
  const [logs, setLogs] = useState([])
  const [notifications, setNotifications] = useState([])
  const [published, setPublished] = useState([])
  const [selected, setSelected] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('info')
  const [draft, setDraft] = useState({ workId: '', notes: '', progress: '' })
  const [busy, setBusy] = useState(false)
  const admin = session.user.role === 'admin'
  const manager = admin || session.user.role === 'officer'

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      const [a, n, p] = await Promise.all([
        api(`/api/advanced/analytics?includeDemo=${showDemoData}`, {}, session.token),
        api('/api/advanced/notifications/live', {}, session.token),
        api('/api/public/works')
      ])
      setAnalytics(a)
      setNotifications(n.notifications || [])
      setPublished(p.works || [])
      if (admin) {
        const l = await api('/api/advanced/audit', {}, session.token)
        setLogs(l.logs || [])
      }
    } catch (e) {
      setMessage(e.message)
      setMessageType('error')
    } finally {
      setBusy(false)
    }
  }, [api, session.token, showDemoData, admin])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (tab !== 'Live alerts') return undefined
    const timer = window.setInterval(refresh, 15000)
    return () => window.clearInterval(timer)
  }, [tab, refresh])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('vb-gram-g-offline-draft') || 'null')
      if (saved && typeof saved === 'object') setDraft({
        workId: saved.workId || '',
        notes: saved.notes || '',
        progress: saved.progress ?? ''
      })
    } catch { /* Ignore an invalid local draft and allow a fresh one. */ }
  }, [])

  function notify(text, type = 'info') {
    setMessage(text)
    setMessageType(type)
  }

  function saveDraft() {
    try {
      localStorage.setItem('vb-gram-g-offline-draft', JSON.stringify(draft))
      notify('Draft saved on this device. It has not been submitted to the server.', 'success')
    } catch {
      notify('Could not save the draft in this browser. Check available local storage.', 'error')
    }
  }

  async function syncDraft() {
    if (!draft.workId || !draft.notes.trim() || draft.progress === '' ||
        !Number.isFinite(Number(draft.progress)) || Number(draft.progress) < 0 || Number(draft.progress) > 100) {
      notify('Choose a work, enter inspection notes, and provide progress from 0 to 100.', 'error')
      return
    }
    setBusy(true)
    try {
      await api(`/api/enhancements/works/${draft.workId}/inspections`, {
        method: 'POST',
        body: JSON.stringify({
          verdict: 'Needs rework',
          reportedProgress: Number(draft.progress),
          notes: draft.notes.trim(),
          checklist: []
        })
      }, session.token)
      localStorage.removeItem('vb-gram-g-offline-draft')
      setDraft({ workId: '', notes: '', progress: '' })
      notify('Inspection submitted successfully as Needs rework.', 'success')
    } catch (e) {
      notify(`Submission failed: ${e.message}. Your draft has been kept on this device.`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!selected) return
    setBusy(true)
    try {
      await api(`/api/advanced/publish/${selected}`, { method: 'POST', body: '{}' }, session.token)
      notify('Work published successfully.', 'success')
      await refresh()
    } catch (e) {
      notify(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const tabs = ['Analytics', 'Live alerts', 'Audit trail', 'Public portal', 'Offline drafts']

  return (
    <section className="advanced-operations">
      <div className="advanced-operations-heading">
        <div>
          <h2>Advanced operations</h2>
          <p>Review performance, alerts, publication status and field inspection drafts.</p>
        </div>
        <button type="button" className="button secondary" onClick={refresh} disabled={busy}>
          {busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="advanced-tabs" role="tablist" aria-label="Advanced operations sections">
        {tabs.map(name => (
          <button type="button" role="tab" aria-selected={tab === name} key={name}
            className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>
            {name}
          </button>
        ))}
      </div>

      {message && <div className={`advanced-message ${messageType}`} role="status">{message}</div>}

      {tab === 'Analytics' && (
        <div className="advanced-card">
          <h3>District performance · {analytics?.total ?? 0} works</h3>
          <p>Counts and expenditure are calculated from available work records; they are not independent field verification.</p>
          <div className="advanced-table-wrap">
            <table className="advanced-table">
              <thead><tr><th>District</th><th>Works</th><th>Completed</th><th>Overdue</th><th>Budget</th><th>Spent</th></tr></thead>
              <tbody>{(analytics?.districts || []).map(d => (
                <tr key={d.district}>
                  <td>{d.district}</td><td>{d.count}</td><td>{d.completed}</td><td>{d.delayed}</td>
                  <td>₹{Number(d.budget || 0).toLocaleString('en-IN')}</td>
                  <td>₹{Number(d.spent || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}</tbody>
            </table>
            {!analytics?.districts?.length && <p className="advanced-empty">No district analytics are available for the selected data.</p>}
          </div>
          <button type="button" className="button secondary" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      )}

      {tab === 'Live alerts' && (
        <div className="advanced-card">
          <h3>Live notifications</h3>
          <p>Notifications refresh every 15 seconds while this tab is open.</p>
          {(notifications || []).map(n => <div className="advanced-list-row" key={n._id}>
            <strong>{n.title}</strong><span>{n.message}</span>
          </div>)}
          {!notifications.length && <p className="advanced-empty">No recent notifications.</p>}
        </div>
      )}

      {tab === 'Audit trail' && (
        <div className="advanced-card">
          <h3>Recent successful changes</h3>
          {admin ? <>
            {logs.map(l => <div className="advanced-list-row" key={l._id}>
              <strong>{l.actor?.name || 'Unknown user'}</strong>
              <span>{new Date(l.at).toLocaleString()} · {l.method} {l.path}</span>
            </div>)}
            {!logs.length && <p className="advanced-empty">No recorded changes yet.</p>}
          </> : <p className="advanced-empty">Only administrators can view the audit trail.</p>}
        </div>
      )}

      {tab === 'Public portal' && (
        <div className="advanced-card">
          <h3>Publicly published works</h3>
          <p>Only real (non-demo) works explicitly published by an administrator are visible publicly.</p>
          {published.map(w => <div className="advanced-list-row" key={w.id}>
            <strong>{w.name}</strong><span>{w.status} · {w.location?.district || 'District not specified'}</span>
          </div>)}
          {!published.length && <p className="advanced-empty">No works have been published.</p>}
          {admin && <div className="advanced-publish-form">
            <label htmlFor="advanced-publish-work">Select a real work</label>
            <select id="advanced-publish-work" value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">Choose work to publish</option>
              {works.filter(w => !w.isDemo).map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
            <button type="button" className="button primary" disabled={!selected || busy} onClick={publish}>Publish work</button>
          </div>}
        </div>
      )}

      {tab === 'Offline drafts' && (
        <div className="advanced-card">
          <h3>Offline inspection notes</h3>
          <p>Save an inspection draft in this browser while offline. Submission is manual and requires an active connection.</p>
          {manager ? <>
            <div className="advanced-draft-form">
              <label htmlFor="offline-work">Development work
                <select id="offline-work" value={draft.workId} onChange={e => setDraft({ ...draft, workId: e.target.value })}>
                  <option value="">Choose a work</option>
                  {works.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>
              </label>
              <label htmlFor="offline-notes">Inspection notes
                <textarea id="offline-notes" rows="4" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Describe the observed site condition…"/>
              </label>
              <label htmlFor="offline-progress">Reported progress (%)
                <input id="offline-progress" type="number" min="0" max="100" step="1" value={draft.progress} onChange={e => setDraft({ ...draft, progress: e.target.value })} placeholder="0–100"/>
              </label>
            </div>
            <div className="advanced-form-actions">
              <button type="button" className="button secondary" onClick={saveDraft}>Save locally</button>
              <button type="button" className="button primary" disabled={busy} onClick={syncDraft}>{busy ? 'Submitting…' : 'Submit inspection'}</button>
            </div>
          </> : <p className="advanced-empty">Officer or Admin access is required to create inspection drafts.</p>}
        </div>
      )}
    </section>
  )
}
