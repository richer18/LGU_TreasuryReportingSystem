import { AlertTriangle, FileSearch, Landmark, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import { formatMoney } from '../GeneralFund/utils/generalFundFormat'

const formatDate = (dateValue) => {
  if (!dateValue) return '-'
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateValue
  return new Intl.DateTimeFormat('en-PH', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const getErrorMessage = (error) =>
  error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to search TD No.'

export function SearchTdNoPage() {
  const [tdNo, setTdNo] = useState('')
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const totalAmount = useMemo(() => rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0), [rows])

  const searchTdNo = async (event) => {
    event.preventDefault()
    const searchText = tdNo.trim()
    if (!searchText) return
    setStatus('loading')
    setError('')
    setRows([])
    setSummary(null)
    try {
      const response = await axiosInstance.get('/search-td-no', { params: { td_no: searchText, limit: 200 } })
      setRows(response.data.data || [])
      setSummary(response.data.summary || null)
      setStatus('success')
    } catch (requestError) {
      setStatus('error')
      setError(getErrorMessage(requestError))
    }
  }

  return (
    <div className="page-stack search-receipt-page">
      <section className="general-fund-hero">
        <div>
          <p className="eyebrow">Real Property Tax Lookup</p>
          <h2>Search TD No.</h2>
          <p>Check if a Tax Declaration No. already has paid RPT receipts in iTAX.</p>
        </div>
      </section>

      <section className="toolbar-panel search-receipt-search-panel">
        <form className="search-receipt-form" onSubmit={searchTdNo}>
          <label className="treasury-field">
            <span><Landmark size={14} aria-hidden="true" /> Tax Declaration No.</span>
            <input autoComplete="off" onChange={(event) => setTdNo(event.target.value)} placeholder="Tax Declaration No." value={tdNo} />
          </label>
          <button className="primary-button" disabled={status === 'loading' || !tdNo.trim()} type="submit">
            <Search size={16} aria-hidden="true" />
            Search TD No.
          </button>
        </form>
      </section>

      {status === 'loading' && <section className="inline-info">Searching paid RPT records...</section>}
      {error && <section className="inline-alert">{error}</section>}
      {summary?.multiple_payors && (
        <section className="inline-alert warning-alert">
          <AlertTriangle size={18} aria-hidden="true" />
          This TD No. has payments from more than one payer: {summary.payors.join(', ')}.
        </section>
      )}

      <section className="report-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Payment History</p>
            <h3>RPT Receipts by TD No.</h3>
            <span>{rows.length} record(s) loaded</span>
          </div>
          <div className="metric-pill">
            <FileSearch size={16} aria-hidden="true" />
            {formatMoney(summary?.total_amount ?? totalAmount)}
          </div>
        </div>
        <div className="table-scroll">
          <table className="reports-table compact-table">
            <thead>
              <tr>
                <th>Date Paid</th><th>TD No.</th><th>Declared Owner</th><th>Paid By</th><th>OR No.</th><th>Tax Year</th><th>Basic</th><th>Basic Penalty</th><th>SEF</th><th>SEF Penalty</th><th>Total</th><th>Collector</th><th>RCD No.</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan="13" className="empty-table-message">{status === 'success' ? 'No paid RPT receipts found for this TD No.' : 'Search a TD No. to load RPT payment history.'}</td></tr>
              )}
              {rows.map((row) => (
                <tr key={`${row.payment_id}-${row.taxtrans_id}-${row.taxyear}`}>
                  <td>{formatDate(row.payment_date)}</td><td><strong>{row.td_no || row.td_no_for_gr || '-'}</strong></td><td>{row.declared_owner || '-'}</td><td>{row.paid_by || '-'}</td><td><strong>{row.receipt_no || '-'}</strong></td><td>{row.taxyear || '-'}</td><td>{formatMoney(row.basic_tax || 0)}</td><td>{formatMoney(row.basic_penalty || 0)}</td><td>{formatMoney(row.sef_tax || 0)}</td><td>{formatMoney(row.sef_penalty || 0)}</td><td><strong>{formatMoney(row.total_amount || 0)}</strong></td><td>{row.collector || '-'}</td><td>{row.rcd_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
