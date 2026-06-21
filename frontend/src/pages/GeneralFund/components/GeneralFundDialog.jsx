import { BarChart3, X } from 'lucide-react'

export function GeneralFundDialog({ children, onClose, open, title }) {
  if (!open) return null

  return (
    <div className="modal-layer" role="presentation">
      <button className="modal-backdrop" onClick={onClose} type="button">
        <span className="sr-only">Close {title}</span>
      </button>
      <section aria-modal="true" className="report-dialog" role="dialog">
        <header className="report-dialog-header">
          <div className="dialog-title-lockup">
            <span className="dialog-title-icon"><BarChart3 size={18} aria-hidden="true" /></span>
            <div>
              <p>Official Report Breakdown</p>
              <h2>{title}</h2>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            <X size={18} aria-hidden="true" />
            <span className="sr-only">Close</span>
          </button>
        </header>
        <div className="report-dialog-body">{children}</div>
      </section>
    </div>
  )
}
