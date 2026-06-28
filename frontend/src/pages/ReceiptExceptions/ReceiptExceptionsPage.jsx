import {
  AlertCircle,
  Calendar,
  FileWarning,
  Filter,
  RefreshCcw,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material'
import axiosInstance from '../../axiosinstance/axiosInstance'

const tabConfig = {
  canceled: {
    title: 'Canceled / Void',
    endpoint: '/reports/receipt-exceptions/canceled-void',
    description: 'Receipts marked void, canceled, or with canceled RPT class details.',
  },
  notRemitted: {
    title: 'Not Remitted',
    endpoint: '/reports/receipt-exceptions/not-remitted',
    description: 'Paid receipts without PAYMENT.RCDNUMBER and without a final RCD range match.',
  },
}

const canceledColumns = [
  ['or_date', 'OR Date'],
  ['or_number', 'OR Number'],
  ['taxpayer_name', 'Taxpayer Name'],
  ['amount', 'Amount', 'money'],
  ['fund_type', 'Fund Type'],
  ['transaction_type', 'Transaction Type'],
  ['collector_cashier', 'Collector / Cashier'],
  ['status', 'Status', 'status'],
  ['status_code', 'Status Code'],
  ['void_flag', 'Void Flag'],
  ['remarks', 'Remarks'],
  ['transaction_date', 'Transaction Date'],
  ['user_id', 'User ID'],
]

const notRemittedColumns = [
  ['or_date', 'OR Date'],
  ['or_number', 'OR Number'],
  ['taxpayer_name', 'Taxpayer Name'],
  ['amount', 'Amount', 'money'],
  ['fund_type', 'Fund Type'],
  ['transaction_type', 'Transaction Type'],
  ['collector_cashier', 'Collector / Cashier'],
  ['transaction_date', 'Transaction Date'],
  ['rcd_number', 'RCD Number'],
  ['rcd_date', 'RCD Date'],
  ['rcd_status', 'RCD Status', 'status'],
  ['days_unremitted', 'Days Unremitted'],
  ['remarks', 'Remarks'],
]

const currentMonthRange = () => {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const toDateInput = (value) => {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return {
    date_from: toDateInput(first),
    date_to: toDateInput(now),
  }
}

const initialFilters = {
  ...currentMonthRange(),
  fund_type: '',
  collector: '',
  status: '',
  transaction_type: '',
  or_number: '',
  taxpayer: '',
}

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value || 0))

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  return value
}

const statusClass = (status) => {
  const value = String(status || '').toLowerCase()
  if (value.includes('void') || value.includes('cancel')) return 'is-danger'
  if (value.includes('pending') || value.includes('not fully') || value.includes('unable')) return 'is-warning'
  if (value.includes('not remitted')) return 'is-danger'
  return 'is-muted'
}

function StatusBadge({ value }) {
  return <span className={`exception-status-pill ${statusClass(value)}`}>{displayValue(value)}</span>
}

export function ReceiptExceptionsPage() {
  const [activeTab, setActiveTab] = useState('canceled')
  const [filters, setFilters] = useState(initialFilters)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({
    total_count: 0,
    total_amount: 0,
    note: '',
    warnings: [],
  })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const activeConfig = tabConfig[activeTab]
  const columns = useMemo(
    () => (activeTab === 'canceled' ? canceledColumns : notRemittedColumns),
    [activeTab],
  )

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  const dateRangeLabel = `${filters.date_from || '-'} to ${filters.date_to || '-'}`

  const loadReport = async (nextPage = 0, nextLimit = rowsPerPage) => {
    setLoading(true)
    setError(null)

    try {
      const response = await axiosInstance.get(activeConfig.endpoint, {
        params: {
          ...filters,
          page: nextPage + 1,
          limit: nextLimit,
        },
      })

      setRows(response.data.data || [])
      setSummary({
        total_count: response.data.total_count || 0,
        total_amount: response.data.total_amount || 0,
        note: response.data.note || '',
        warnings: response.data.warnings || [],
      })
      setPage(nextPage)
    } catch (requestError) {
      setRows([])
      setSummary({ total_count: 0, total_amount: 0, note: '', warnings: [] })
      setError({
        message: requestError.response?.data?.error || 'Unable to load report. Please check the backend logs.',
        details: requestError.response?.data?.technical_error || requestError.message || '',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport(0, rowsPerPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setRows([])
    setPage(0)
  }

  const handleSearch = (event) => {
    event.preventDefault()
    loadReport(0, rowsPerPage)
  }

  const handleResetFilters = () => {
    setFilters(initialFilters)
    setRows([])
    setPage(0)
    setError(null)
  }

  const handleChangePage = (_event, nextPage) => {
    loadReport(nextPage, rowsPerPage)
  }

  const handleChangeRowsPerPage = (event) => {
    const nextLimit = Number(event.target.value)
    setRowsPerPage(nextLimit)
    loadReport(0, nextLimit)
  }

  return (
    <div className="page-stack receipt-exceptions-page">
      <section className="toolbar-panel receipt-exceptions-hero">
        <div>
          <p className="eyebrow">Receipt Exception Monitoring</p>
          <h2>Receipt Exceptions Report</h2>
          <p>
            Review receipt issues and remittance gaps for the selected period.
          </p>
        </div>
        <div className="exception-header-summary">
          <div className="exception-summary-card">
            <span>Total Amount</span>
            <strong>{money(summary.total_amount)}</strong>
          </div>
          <div className="exception-summary-card">
            <span>Total Receipts</span>
            <strong>{summary.total_count.toLocaleString()}</strong>
          </div>
        </div>
      </section>

      <section className="toolbar-panel receipt-exceptions-tabs">
        <div className="exception-tab-switcher" aria-label="Receipt exception report tabs">
        {Object.entries(tabConfig).map(([key, item]) => (
          <button
            className={activeTab === key ? 'is-active' : ''}
            key={key}
            onClick={() => handleTabChange(key)}
            type="button"
          >
            <FileWarning size={18} aria-hidden="true" />
            {item.title}
          </button>
        ))}
        </div>
      </section>

      <form className="toolbar-panel exception-filter-panel" onSubmit={handleSearch}>
        <div className="exception-filter-grid">
          <label>
            <span><Calendar size={15} /> Date From</span>
            <input type="date" value={filters.date_from} onChange={(event) => updateFilter('date_from', event.target.value)} />
          </label>
          <label>
            <span><Calendar size={15} /> Date To</span>
            <input type="date" value={filters.date_to} onChange={(event) => updateFilter('date_to', event.target.value)} />
          </label>
          <label>
            <span><Filter size={15} /> Fund Type</span>
            <input value={filters.fund_type} onChange={(event) => updateFilter('fund_type', event.target.value)} placeholder="All funds" />
          </label>
          <label>
            <span><Filter size={15} /> Collector / Cashier</span>
            <input value={filters.collector} onChange={(event) => updateFilter('collector', event.target.value)} placeholder="All collectors" />
          </label>
          <label>
            <span><Filter size={15} /> Status</span>
            <input value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} placeholder="All statuses" />
          </label>
          <label>
            <span><Filter size={15} /> Transaction Type</span>
            <input value={filters.transaction_type} onChange={(event) => updateFilter('transaction_type', event.target.value)} placeholder="All types" />
          </label>
          <label>
            <span><Search size={15} /> OR Number</span>
            <input value={filters.or_number} onChange={(event) => updateFilter('or_number', event.target.value)} placeholder="Search OR" />
          </label>
          <label>
            <span><Search size={15} /> Taxpayer</span>
            <input value={filters.taxpayer} onChange={(event) => updateFilter('taxpayer', event.target.value)} placeholder="Search taxpayer" />
          </label>
        </div>
        <div className="exception-filter-actions">
          <button className="secondary-button" disabled={loading} onClick={handleResetFilters} type="button">
            Reset Filters
          </button>
          <button className="primary-button exception-search-button" disabled={loading} type="submit">
            <RefreshCcw size={17} aria-hidden="true" />
            {loading ? 'Loading...' : 'Load Report'}
          </button>
        </div>
      </form>

      <section className="toolbar-panel exception-report-panel">
        <div className="exception-report-heading">
          <div>
            <p className="eyebrow">{activeConfig.title}</p>
            <h3>{activeConfig.description}</h3>
          </div>
        </div>

        <div className="exception-summary-grid">
          <div>
            <span>Total Records</span>
            <strong>{summary.total_count.toLocaleString()}</strong>
          </div>
          <div>
            <span>Total Amount</span>
            <strong>{money(summary.total_amount)}</strong>
          </div>
          <div>
            <span>Report Type</span>
            <strong>{activeConfig.title}</strong>
          </div>
          <div>
            <span>Date Range</span>
            <strong>{dateRangeLabel}</strong>
          </div>
        </div>

        {summary.note && (
          <div className="exception-note">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{summary.note}</span>
          </div>
        )}

        {summary.warnings.length > 0 && (
          <div className="exception-warning-list">
            {summary.warnings.map((warning) => (
              <div key={warning}>
                <AlertCircle size={16} aria-hidden="true" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="exception-error-alert">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>{error.message}</strong>
              {error.details && (
                <details className="exception-error-details">
                  <summary>Technical details</summary>
                  <pre>{error.details}</pre>
                </details>
              )}
            </div>
          </div>
        )}

        <TableContainer className="exception-table-wrap">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {columns.map(([, label]) => (
                  <TableCell key={label}>{label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length}>
                    <div className="exception-empty-state">
                      <FileWarning size={22} aria-hidden="true" />
                      <strong>No receipt exceptions found</strong>
                      <span>No records matched the selected filters.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell align="center" colSpan={columns.length}>
                    Loading receipt exceptions...
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.map((row, index) => (
                <TableRow key={`${row.payment_id || row.or_number}-${index}`}>
                  {columns.map(([field, , type]) => (
                    <TableCell key={field} className={type === 'money' ? 'amount-cell' : ''}>
                      {type === 'money' && money(row[field])}
                      {type === 'status' && <StatusBadge value={row[field]} />}
                      {!type && displayValue(row[field])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={summary.total_count}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[25, 50, 100, 250]}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </section>
    </div>
  )
}
