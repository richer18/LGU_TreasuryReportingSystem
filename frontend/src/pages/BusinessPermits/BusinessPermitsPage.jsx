import { BriefcaseBusiness, CalendarClock, CircleDollarSign, RefreshCw, Search, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import { formatMoney } from '../GeneralFund/utils/generalFundFormat'

const formatDate = (dateValue) => {
  if (!dateValue) return '-'
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateValue
  return new Intl.DateTimeFormat('en-PH', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const fullName = (record) => record.owner_name || '-'

const statusClass = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (['active', 'issued', 'paid', 'for pick-up'].includes(normalized)) return 'paid'
  if (['cancelled', 'expired'].includes(normalized)) return 'mismatch'
  if (normalized.includes('assessment') || normalized === 'expiry' || normalized === 'pending') return 'pending'
  return 'draft'
}

const getErrorMessage = (error) =>
  error.response?.data?.message || error.response?.data?.error || error.message || 'Unable to load business permits.'

export function BusinessPermitsPage() {
  const [records, setRecords] = useState([])
  const [overallTotal, setOverallTotal] = useState(0)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')

  const loadBusinessPermits = async () => {
    setStatus('loading')
    setError('')

    try {
      const response = await axiosInstance.get('/business-permits/report-data', { params: { limit: 2000 } })
      const reportRecords = response.data.records || []

      setRecords(reportRecords)
      setOverallTotal(Number(response.data.summary?.total_revenue || 0))
      setStatus('success')
    } catch (requestError) {
      setStatus('error')
      setError(getErrorMessage(requestError))
    }
  }

  useEffect(() => {
    loadBusinessPermits()
  }, [])

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) return records

    return records.filter((record) => {
      const haystack = [
        fullName(record),
        record.business_name,
        record.owner_name,
        record.barangay,
        record.business_id,
        record.permit_no,
        record.or_number,
        record.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [records, searchText])

  const issuedCount = records.filter((record) => ['ISSUED', 'PAID', 'FOR PICK-UP'].includes(String(record.status || '').toUpperCase())).length
  const renewalCount = records.filter((record) => String(record.application_type || '').toUpperCase() === 'RENEWAL').length

  return (
    <div className="page-stack business-permits-page">
      <section className="general-fund-hero">
        <div>
          <p className="eyebrow">Business Permit Licensing</p>
          <h2>Business Permits</h2>
          <p>Monitor permit records, renewal dates, and payment totals from the business permit Excel reports.</p>
        </div>
        <button className="primary-button" disabled={status === 'loading'} onClick={loadBusinessPermits} type="button">
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </section>

      {error && <section className="inline-alert">{error}</section>}
      {status === 'loading' && <section className="inline-info">Loading business permit records...</section>}

      <section className="dashboard-kpi-grid">
        <article className="kpi-card">
          <UsersRound size={20} aria-hidden="true" />
          <span>Total Records</span>
          <strong>{records.length.toLocaleString()}</strong>
        </article>
        <article className="kpi-card">
          <BriefcaseBusiness size={20} aria-hidden="true" />
          <span>Issued Permits</span>
          <strong>{issuedCount.toLocaleString()}</strong>
        </article>
        <article className="kpi-card">
          <CalendarClock size={20} aria-hidden="true" />
          <span>Renewals</span>
          <strong>{renewalCount.toLocaleString()}</strong>
        </article>
        <article className="kpi-card">
          <CircleDollarSign size={20} aria-hidden="true" />
          <span>Excel Revenue</span>
          <strong>{formatMoney(overallTotal)}</strong>
        </article>
      </section>

      <section className="toolbar-panel">
        <label className="treasury-field search-field">
          <span><Search size={14} aria-hidden="true" /> Search business permits</span>
          <input
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Business, owner, barangay, permit no., OR, status..."
            value={searchText}
          />
        </label>
      </section>

      <section className="report-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Permit Records</p>
            <h3>Business Permit List</h3>
            <span>{filteredRecords.length} of {records.length} record(s)</span>
          </div>
        </div>
        <div className="table-scroll">
          <table className="reports-table compact-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Barangay</th>
                <th>Business ID</th>
                <th>Permit No.</th>
                <th>Type</th>
                <th>OR No.</th>
                <th>OR Date</th>
                <th>Amount Paid</th>
                <th>Business Nature</th>
                <th>Business Line</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 && (
                <tr>
                  <td className="empty-table-message" colSpan="12">
                    {status === 'success' ? 'No business permit records found.' : 'Business permit records will appear here once loaded.'}
                  </td>
                </tr>
              )}
              {filteredRecords.slice(0, 200).map((record) => (
                <tr key={record.business_id || `${record.permit_no}-${record.business_name}`}>
                  <td>{formatDate(record.application_date)}</td>
                  <td><strong>{record.business_name || '-'}</strong><br /><span className="helper-text">{fullName(record)}</span></td>
                  <td>{record.barangay || '-'}</td>
                  <td>{record.business_id || '-'}</td>
                  <td>{record.permit_no || '-'}</td>
                  <td>{record.application_type || '-'}</td>
                  <td>{record.or_number || '-'}</td>
                  <td>{formatDate(record.or_date)}</td>
                  <td><strong>{formatMoney(record.amount_paid || 0)}</strong></td>
                  <td>{record.business_nature || '-'}</td>
                  <td>{record.business_line || '-'}</td>
                  <td><span className={`status-badge ${statusClass(record.status)}`}>{record.status || 'PENDING'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredRecords.length > 200 && <p className="helper-text">Showing first 200 matching records. Use search to narrow the list.</p>}
      </section>
    </div>
  )
}
