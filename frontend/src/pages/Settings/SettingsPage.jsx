import { RefreshCcw } from 'lucide-react'

export function SettingsPage({ firebirdStatus, onRefresh }) {
  return (
    <div className="page-stack">
      <section className="settings-grid">
        <div className="panel">
          <h3>System Connection</h3>
          <dl>
            <div>
              <dt>Backend API</dt>
              <dd>http://127.0.0.1:8000/api</dd>
            </div>
            <div>
              <dt>Frontend</dt>
              <dd>http://127.0.0.1:5173</dd>
            </div>
            <div>
              <dt>Firebird status</dt>
              <dd>{firebirdStatus.data?.ok ? 'Connected' : firebirdStatus.error || 'Checking'}</dd>
            </div>
          </dl>
          <button className="secondary-button settings-refresh" onClick={onRefresh} type="button">
            <RefreshCcw size={16} aria-hidden="true" />
            Check connection
          </button>
        </div>

        <div className="panel">
          <h3>Report Runner Rule</h3>
          <p className="settings-note">
            All Python scripts for Firebird reads, imports, validation, and exports are saved in the runner folder.
          </p>
        </div>
      </section>
    </div>
  )
}
