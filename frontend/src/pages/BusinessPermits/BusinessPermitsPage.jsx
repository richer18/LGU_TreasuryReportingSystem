import {
  BriefcaseBusiness, Building2, CalendarClock, ChevronLeft, ChevronRight,
  CircleDollarSign, Eye, MapPin, ReceiptText, RefreshCw, Search, SlidersHorizontal, UsersRound, X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import { formatMoney } from '../GeneralFund/utils/generalFundFormat'

const PAGE_SIZE = 50

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
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState(null)

  const loadBusinessPermits = async () => {
    setStatus('loading')
    setError('')
    try {
      const response = await axiosInstance.get('/business-permits/report-data', { params: { limit: 2000 } })
      setRecords(response.data.records || [])
      setOverallTotal(Number(response.data.summary?.total_revenue || 0))
      setStatus('success')
    } catch (requestError) {
      setStatus('error')
      setError(getErrorMessage(requestError))
    }
  }

  useEffect(() => { loadBusinessPermits() }, [])

  const statusOptions = useMemo(
    () => [...new Set(records.map((record) => String(record.status || 'PENDING').toUpperCase()))].sort(),
    [records],
  )
  const typeOptions = useMemo(
    () => [...new Set(records.map((record) => String(record.application_type || 'UNSPECIFIED').toUpperCase()))].sort(),
    [records],
  )

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return records.filter((record) => {
      const recordStatus = String(record.status || 'PENDING').toUpperCase()
      const recordType = String(record.application_type || 'UNSPECIFIED').toUpperCase()
      if (statusFilter !== 'ALL' && recordStatus !== statusFilter) return false
      if (typeFilter !== 'ALL' && recordType !== typeFilter) return false
      if (!query) return true
      return [
        fullName(record), record.business_name, record.barangay, record.business_id,
        record.permit_no, record.or_number, record.status, record.application_type,
        record.business_nature, record.business_line,
      ].filter(Boolean).join(' ').toLowerCase().includes(query)
    })
  }, [records, searchText, statusFilter, typeFilter])

  useEffect(() => { setPage(1) }, [searchText, statusFilter, typeFilter])

  const issuedCount = records.filter((record) => ['ISSUED', 'PAID', 'FOR PICK-UP'].includes(String(record.status || '').toUpperCase())).length
  const renewalCount = records.filter((record) => String(record.application_type || '').toUpperCase() === 'RENEWAL').length
  const newCount = records.filter((record) => String(record.application_type || '').toUpperCase() === 'NEW').length
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageRecords = filteredRecords.slice(pageStart, pageStart + PAGE_SIZE)
  const hasFilters = Boolean(searchText || statusFilter !== 'ALL' || typeFilter !== 'ALL')

  const clearFilters = () => {
    setSearchText('')
    setStatusFilter('ALL')
    setTypeFilter('ALL')
  }

  return (
    <div className="page-stack business-permits-page">
      <section className="business-permits-header">
        <div className="business-permits-title">
          <span className="business-permits-title-icon"><Building2 size={22} aria-hidden="true" /></span>
          <div>
            <p className="eyebrow">Business Permit Licensing</p>
            <h2>Business Permits</h2>
            <p>Review registrations, permit status, payment details, and renewals in one place.</p>
          </div>
        </div>
        <button className="primary-button" disabled={status === 'loading'} onClick={loadBusinessPermits} type="button">
          <RefreshCw className={status === 'loading' ? 'spin' : ''} size={16} aria-hidden="true" />
          {status === 'loading' ? 'Refreshing' : 'Refresh data'}
        </button>
      </section>

      {error && <section className="inline-alert">{error}</section>}

      <section className="business-permits-kpis" aria-label="Business permit summary">
        <article className="business-permits-kpi blue"><span className="business-permits-kpi-icon"><UsersRound size={19} /></span><div><span>Total records</span><strong>{records.length.toLocaleString()}</strong><small>Loaded permit applications</small></div></article>
        <article className="business-permits-kpi green"><span className="business-permits-kpi-icon"><BriefcaseBusiness size={19} /></span><div><span>Issued / paid</span><strong>{issuedCount.toLocaleString()}</strong><small>Ready or completed records</small></div></article>
        <article className="business-permits-kpi amber"><span className="business-permits-kpi-icon"><CalendarClock size={19} /></span><div><span>Applications</span><strong>{renewalCount.toLocaleString()} renewals</strong><small>{newCount.toLocaleString()} new registrations</small></div></article>
        <article className="business-permits-kpi teal"><span className="business-permits-kpi-icon"><CircleDollarSign size={19} /></span><div><span>Recorded revenue</span><strong>{formatMoney(overallTotal)}</strong><small>Based on imported permit reports</small></div></article>
      </section>

      <section className="business-permits-filter-panel">
        <div className="business-permits-filter-heading"><SlidersHorizontal size={17} /><div><strong>Find permit records</strong><span>Search and narrow the list using the available fields.</span></div></div>
        <div className="business-permits-filters">
          <label className="business-permits-search"><Search size={17} /><input aria-label="Search business permits" onChange={(event) => setSearchText(event.target.value)} placeholder="Search business, owner, barangay, permit or OR number" value={searchText} />{searchText && <button aria-label="Clear search" onClick={() => setSearchText('')} title="Clear search" type="button"><X size={15} /></button>}</label>
          <label className="business-permits-select"><span>Status</span><select onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option value="ALL">All statuses</option>{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="business-permits-select"><span>Application</span><select onChange={(event) => setTypeFilter(event.target.value)} value={typeFilter}><option value="ALL">All types</option>{typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          {hasFilters && <button className="business-permits-clear" onClick={clearFilters} type="button"><X size={15} />Clear filters</button>}
        </div>
      </section>

      <section className="business-permits-table-card">
        <header className="business-permits-table-header"><div><p className="eyebrow">Permit Records</p><h3>Business Permit List</h3></div><span>{filteredRecords.length.toLocaleString()} result{filteredRecords.length === 1 ? '' : 's'}</span></header>
        <div className="business-permits-table-scroll">
          <table className="business-permits-table">
            <thead><tr><th>Date</th><th>Business / Owner</th><th>Barangay</th><th>Business ID</th><th>Permit No.</th><th>Type</th><th>OR No.</th><th>OR Date</th><th className="numeric-cell">Amount Paid</th><th>Nature / Line</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {pageRecords.length === 0 && <tr><td className="empty-table-message" colSpan="12">{status === 'loading' ? 'Loading business permit records...' : 'No permit records match the current filters.'}</td></tr>}
              {pageRecords.map((record, index) => (
                <tr key={`${record.business_id || 'record'}-${record.permit_no || 'permit'}-${record.or_number || index}`}>
                  <td className="date-cell">{formatDate(record.application_date)}</td>
                  <td className="business-name-cell"><strong>{record.business_name || '-'}</strong><span>{fullName(record)}</span></td>
                  <td>{record.barangay || '-'}</td><td className="code-cell">{record.business_id || '-'}</td><td className="code-cell">{record.permit_no || '-'}</td>
                  <td><span className="permit-type-badge">{record.application_type || '-'}</span></td><td className="code-cell">{record.or_number || '-'}</td><td className="date-cell">{formatDate(record.or_date)}</td>
                  <td className="numeric-cell amount-cell">{formatMoney(record.amount_paid || 0)}</td>
                  <td className="nature-cell"><strong>{record.business_nature || '-'}</strong><span>{record.business_line || '-'}</span></td>
                  <td><span className={`status-badge ${statusClass(record.status)}`}>{record.status || 'PENDING'}</span></td>
                  <td><button className="business-permit-view-button" onClick={() => setSelectedRecord(record)} title="View business card" type="button"><Eye size={15} aria-hidden="true" />View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="business-permits-pagination">
          <span>{filteredRecords.length ? `${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, filteredRecords.length)} of ${filteredRecords.length.toLocaleString()}` : '0 records'}</span>
          <div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} title="Previous page" type="button"><ChevronLeft size={17} /></button><strong>Page {currentPage} of {totalPages}</strong><button disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} title="Next page" type="button"><ChevronRight size={17} /></button></div>
        </footer>
      </section>

      {selectedRecord && (
        <div className="business-card-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRecord(null) }} role="presentation">
          <section aria-labelledby="business-card-title" aria-modal="true" className="business-card-dialog" role="dialog">
            <header className="business-card-dialog-header">
              <div><span className="business-card-dialog-icon"><BriefcaseBusiness size={20} /></span><div><p className="eyebrow">Business Permit Record</p><h3 id="business-card-title">Business Card</h3></div></div>
              <button aria-label="Close business card" onClick={() => setSelectedRecord(null)} title="Close" type="button"><X size={19} /></button>
            </header>
            <div className="business-card-identity">
              <div><h4>{selectedRecord.business_name || '-'}</h4><p>{fullName(selectedRecord)}</p><span><MapPin size={14} />{selectedRecord.location || selectedRecord.barangay || '-'}</span></div>
              <span className={`status-badge ${statusClass(selectedRecord.status)}`}>{selectedRecord.status || 'PENDING'}</span>
            </div>
            <div className="business-card-details">
              <BusinessCardField label="Business ID" value={selectedRecord.business_id} />
              <BusinessCardField label="Permit No." value={selectedRecord.permit_no} />
              <BusinessCardField label="Application type" value={selectedRecord.application_type} />
              <BusinessCardField label="Application date" value={formatDate(selectedRecord.application_date)} />
              <BusinessCardField label="Tax year" value={selectedRecord.tax_year} />
              <BusinessCardField label="Business type" value={selectedRecord.business_type} />
              <BusinessCardField label="Business nature" value={selectedRecord.business_nature} wide />
              <BusinessCardField label="Business line" value={selectedRecord.business_line} wide />
            </div>
            <div className="business-card-payment">
              <div className="business-card-payment-title"><ReceiptText size={17} /><strong>Payment information</strong></div>
              <div><BusinessCardField label="OR No." value={selectedRecord.or_number} /><BusinessCardField label="OR date" value={formatDate(selectedRecord.or_date)} /><BusinessCardField label="Amount paid" value={formatMoney(selectedRecord.amount_paid || 0)} emphasized /><BusinessCardField label="Business tax" value={formatMoney(selectedRecord.business_tax || 0)} /></div>
            </div>
            <div className="business-card-financials"><BusinessCardField label="Capital investment" value={formatMoney(selectedRecord.capital_investment || 0)} /><BusinessCardField label="Gross sales" value={formatMoney(selectedRecord.gross_sales || 0)} /><BusinessCardField label="Source type" value={selectedRecord.source_type} /></div>
            <footer><button className="primary-button" onClick={() => setSelectedRecord(null)} type="button">Close</button></footer>
          </section>
        </div>
      )}
    </div>
  )
}

function BusinessCardField({ emphasized = false, label, value, wide = false }) {
  return <div className={`business-card-field${wide ? ' wide' : ''}${emphasized ? ' emphasized' : ''}`}><span>{label}</span><strong>{value || '-'}</strong></div>
}
