import { Calendar, RefreshCcw, Search, User } from 'lucide-react'

export function GeneralFundFilters({ collectors, filters, loading, onRefresh, onUpdateFilter }) {
  return (
    <section className="toolbar-panel general-fund-filters treasury-filter-panel">
      <div className="filter-row general-fund-filter-row">
        <label className="treasury-field">
          <span><Calendar size={14} aria-hidden="true" /> Date from</span>
          <input
            aria-label="Date from"
            onChange={(event) => onUpdateFilter('date_from', event.target.value)}
            type="date"
            value={filters.date_from}
          />
        </label>
        <label className="treasury-field">
          <span><Calendar size={14} aria-hidden="true" /> Date to</span>
          <input
            aria-label="Date to"
            onChange={(event) => onUpdateFilter('date_to', event.target.value)}
            type="date"
            value={filters.date_to}
          />
        </label>
        <label className="treasury-field">
          <span><User size={14} aria-hidden="true" /> Collector</span>
          <select
            aria-label="Collector"
            onChange={(event) => onUpdateFilter('collector', event.target.value)}
            value={filters.collector}
          >
            <option value="">All collectors</option>
            {collectors.map((collector) => (
              <option key={collector.collector} value={collector.collector}>
                {collector.collector}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary-button" disabled={loading} onClick={onRefresh} type="button">
          <RefreshCcw size={16} aria-hidden="true" />
          Refresh
        </button>
      </div>
      <div className="receipt-filter-block">
        <span className="receipt-filter-label">Receipt range optional</span>
        <div className="receipt-filter-strip">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Receipt from"
            onChange={(event) => onUpdateFilter('receipt_from', event.target.value)}
            placeholder="Receipt from"
            value={filters.receipt_from}
          />
          <span className="receipt-range-divider">-</span>
          <input
            aria-label="Receipt to"
            onChange={(event) => onUpdateFilter('receipt_to', event.target.value)}
            placeholder="Receipt to"
            value={filters.receipt_to}
          />
        </div>
      </div>
    </section>
  )
}
