import { AlertTriangle, Calculator, FileSearch, Landmark, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import { formatMoney } from '../GeneralFund/utils/generalFundFormat'

const formatDate = (dateValue) => {
  if (!dateValue) return '-'
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateValue
  return new Intl.DateTimeFormat('en-PH', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const fieldValue = (...values) => {
  const value = values.find((item) => item !== undefined && item !== null && String(item).trim() !== '')
  return value === undefined ? '-' : String(value).trim()
}

const getTaxYear = (row) => fieldValue(row?.taxyear, row?.tax_year, row?.period_covered)

const asNumber = (value) => Number(String(value ?? '').replace(/,/g, '')) || 0

const getErrorMessage = (error) =>
  error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to search TD No.'

export function SearchTdNoPage() {
  const [tdNo, setTdNo] = useState('')
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [manualStatus, setManualStatus] = useState('idle')
  const [manualMessage, setManualMessage] = useState('')
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false)
  const [manualSearchTdNo, setManualSearchTdNo] = useState('')
  const [manualSearchRows, setManualSearchRows] = useState([])
  const [manualSearchSummary, setManualSearchSummary] = useState(null)
  const [manualSearchStatus, setManualSearchStatus] = useState('idle')
  const [manualSearchError, setManualSearchError] = useState('')
  const [manualForm, setManualForm] = useState({
    payment_date: '',
    declared_owner: '',
    paid_by: '',
    receipt_no: '',
    tax_year: '',
    basic_tax: '',
    basic_penalty: '',
    sef_tax: '',
    sef_penalty: '',
    total_amount: '',
    collector: '',
    basic_current_gross: '',
    basic_discount: '',
    basic_prior_years: '',
    basic_penalty_current_year: '',
    basic_penalty_previous_years: '',
    basic_penalty_prior_years: '',
    basic_gross_total: '',
    basic_net_total: '',
    sef_current_gross: '',
    sef_discount: '',
    sef_prior_years: '',
    sef_penalty_current_year: '',
    sef_penalty_previous_years: '',
    sef_penalty_prior_years: '',
    sef_gross_total: '',
    sef_net_total: '',
    grand_gross_total: '',
    grand_net_total: '',
    share_25_percent: '',
    property_classification: '',
    property_kind: '',
    payment_status_ct: 'PAID',
    is_cancelled: false,
    payment_total_amount: '',
    booking_reference: '',
    is_void: false,
    include_in_report: true,
    rcd_number: '',
    remarks: '',
  })

  const totalAmount = useMemo(() => rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0), [rows])
  const latestRow = rows[0] || null
  const manualReferenceRows = manualSearchRows.length > 0 ? manualSearchRows : rows
  const latestManualReferenceRow = manualReferenceRows[0] || latestRow
  const manualComputedTotal = useMemo(() => {
    const basicPenaltyTotal = asNumber(manualForm.basic_penalty_current_year) + asNumber(manualForm.basic_penalty_previous_years) + asNumber(manualForm.basic_penalty_prior_years)
    const sefPenaltyTotal = asNumber(manualForm.sef_penalty_current_year) + asNumber(manualForm.sef_penalty_previous_years) + asNumber(manualForm.sef_penalty_prior_years)
    const basicGross = asNumber(manualForm.basic_gross_total) || asNumber(manualForm.basic_current_gross) + asNumber(manualForm.basic_prior_years) + basicPenaltyTotal
    const basicNet = asNumber(manualForm.basic_net_total) || Math.max(basicGross - asNumber(manualForm.basic_discount), 0)
    const sefGross = asNumber(manualForm.sef_gross_total) || asNumber(manualForm.sef_current_gross) + asNumber(manualForm.sef_prior_years) + sefPenaltyTotal
    const sefNet = asNumber(manualForm.sef_net_total) || Math.max(sefGross - asNumber(manualForm.sef_discount), 0)
    return asNumber(manualForm.payment_total_amount) || asNumber(manualForm.grand_net_total) || asNumber(manualForm.total_amount) || basicNet + sefNet || ['basic_tax', 'basic_penalty', 'sef_tax', 'sef_penalty'].reduce((sum, field) => sum + asNumber(manualForm[field]), 0)
  }, [manualForm])

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
      setManualMessage('')
      setStatus('success')
    } catch (requestError) {
      setStatus('error')
      setError(getErrorMessage(requestError))
    }
  }

  const updateManualForm = (field, value) => {
    setManualForm((current) => ({ ...current, [field]: value }))
  }

  const buildManualForm = (referenceRow = null) => {
    const today = new Date().toISOString().slice(0, 10)
    return {
      payment_date: today,
      declared_owner: referenceRow?.declared_owner || referenceRow?.taxpayer_name || '',
      paid_by: '',
      receipt_no: '',
      tax_year: referenceRow ? getTaxYear(referenceRow) : '',
      basic_tax: '',
      basic_penalty: '',
      sef_tax: '',
      sef_penalty: '',
      total_amount: '',
      collector: referenceRow?.collector || '',
      pin: referenceRow?.new_pin || referenceRow?.pin || referenceRow?.property_index_number || '',
      td_arp_no: referenceRow?.td_no || referenceRow?.td_no_for_gr || '',
      barangay_name: referenceRow?.barangay_name || referenceRow?.barangay || referenceRow?.barangay_code || '',
      property_classification: referenceRow?.property_classification || '',
      property_kind: referenceRow?.property_kind || '',
      payment_status_ct: referenceRow?.payment_status_ct || 'PAID',
      include_in_report: true,
      rcd_number: '',
      booking_reference: '',
      remarks: 'Manual payment accepted by office for already-paid TD No.',
    }
  }

  const resetManualForm = (referenceRow = latestManualReferenceRow) => {
    setManualForm(buildManualForm(referenceRow))
  }

  const applyReferenceRow = (referenceRow) => {
    if (!referenceRow) return
    setManualForm((current) => ({
      ...current,
      declared_owner: referenceRow.declared_owner || referenceRow.taxpayer_name || current.declared_owner,
      tax_year: getTaxYear(referenceRow) === '-' ? current.tax_year : getTaxYear(referenceRow),
      collector: referenceRow.collector || current.collector,
      pin: referenceRow.new_pin || referenceRow.pin || referenceRow.property_index_number || current.pin,
      td_arp_no: referenceRow.td_no || referenceRow.td_no_for_gr || current.td_arp_no,
      barangay_name: referenceRow.barangay_name || referenceRow.barangay || referenceRow.barangay_code || current.barangay_name,
      property_classification: referenceRow.property_classification || current.property_classification,
      property_kind: referenceRow.property_kind || current.property_kind,
    }))
  }

  const openManualDialog = () => {
    const searchText = tdNo.trim()
    setManualSearchTdNo(searchText)
    setManualSearchRows(rows)
    setManualSearchSummary(summary)
    setManualSearchStatus(rows.length > 0 ? 'success' : 'idle')
    setManualSearchError('')
    setManualMessage('')
    setManualStatus('idle')
    setManualForm(buildManualForm(latestRow))
    setIsManualDialogOpen(true)
  }

  const closeManualDialog = () => {
    if (manualStatus === 'saving') return
    setIsManualDialogOpen(false)
  }

  const searchManualTdNo = async (event) => {
    event.preventDefault()
    const searchText = manualSearchTdNo.trim()
    if (!searchText) return
    setManualSearchStatus('loading')
    setManualSearchError('')
    setManualSearchRows([])
    setManualSearchSummary(null)
    try {
      const response = await axiosInstance.get('/search-td-no', { params: { td_no: searchText, limit: 200 } })
      const data = response.data.data || []
      setManualSearchRows(data)
      setManualSearchSummary(response.data.summary || null)
      setTdNo(searchText)
      setRows(data)
      setSummary(response.data.summary || null)
      setStatus('success')
      setError('')
      setManualSearchStatus('success')
      if (data[0]) {
        applyReferenceRow(data[0])
      }
    } catch (requestError) {
      setManualSearchStatus('error')
      setManualSearchError(getErrorMessage(requestError))
    }
  }

  const saveManualPayment = async (event) => {
    event.preventDefault()
    const searchText = manualSearchTdNo.trim() || tdNo.trim()
    if (!searchText) return

    setManualStatus('saving')
    setManualMessage('')
    try {
      await axiosInstance.post('/search-td-no/manual-payments', {
        td_no: searchText,
        ...manualForm,
        total_amount: manualForm.total_amount || manualComputedTotal,
      })
      setManualMessage('Manual RPT payment saved.')
      setIsManualDialogOpen(false)
      setManualForm(buildManualForm())
      const response = await axiosInstance.get('/search-td-no', { params: { td_no: searchText, limit: 200 } })
      setTdNo(searchText)
      setRows(response.data.data || [])
      setSummary(response.data.summary || null)
      setStatus('success')
      setManualStatus('idle')
    } catch (requestError) {
      setManualStatus('error')
      setManualMessage(getErrorMessage(requestError))
    }
  }

  const deleteManualPayment = async (manualId) => {
    if (!manualId || !window.confirm('Delete this manual RPT payment record?')) return
    setManualStatus('saving')
    setManualMessage('')
    try {
      await axiosInstance.delete(`/search-td-no/manual-payments/${manualId}`)
      const response = await axiosInstance.get('/search-td-no', { params: { td_no: tdNo.trim(), limit: 200 } })
      setRows(response.data.data || [])
      setSummary(response.data.summary || null)
      setManualStatus('idle')
    } catch (requestError) {
      setManualStatus('error')
      setManualMessage(getErrorMessage(requestError))
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

      {manualMessage && !isManualDialogOpen && <section className={manualStatus === 'error' ? 'inline-alert' : 'inline-info'}>{manualMessage}</section>}

      {isManualDialogOpen && (
        <div className="modal-layer" role="presentation">
          <button aria-label="Close manual RPT payment" className="modal-backdrop" onClick={closeManualDialog} type="button" />
          <section aria-modal="true" className="report-dialog manual-rpt-dialog" role="dialog">
            <header className="report-dialog-header">
              <div className="dialog-title-lockup">
                <span className="dialog-title-icon"><Landmark size={18} aria-hidden="true" /></span>
                <div>
                  <h2>Manual RPT Payment</h2>
                  <p>Search the TD No. in iTax, review the property details, then encode the manual payment.</p>
                </div>
              </div>
              <button aria-label="Close" className="icon-button" onClick={closeManualDialog} type="button"><X size={20} /></button>
            </header>

            <form className="manual-rpt-dialog-body" onSubmit={saveManualPayment}>
              <aside className="manual-rpt-reference-panel">
                <div className="manual-td-search-form">
                  <label className="treasury-field">
                    <span><Search size={14} aria-hidden="true" /> Search TD No.</span>
                    <input autoComplete="off" onChange={(event) => setManualSearchTdNo(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchManualTdNo(event) }} placeholder="Tax Declaration No." value={manualSearchTdNo} />
                  </label>
                  <button className="secondary-button" disabled={manualSearchStatus === 'loading' || !manualSearchTdNo.trim()} onClick={searchManualTdNo} type="button">
                    <Search size={16} aria-hidden="true" />
                    Search
                  </button>
                </div>
                {manualSearchStatus === 'loading' && <div className="inline-info">Searching iTax records...</div>}
                {manualSearchError && <div className="inline-alert">{manualSearchError}</div>}
                <p className="eyebrow">TD Reference</p>
                <h3>{manualSearchTdNo.trim() || tdNo.trim() || '-'}</h3>
                <dl>
                  <div><dt>Name of the Taxpayer</dt><dd>{fieldValue(latestManualReferenceRow?.declared_owner, latestManualReferenceRow?.taxpayer_name, manualForm.declared_owner)}</dd></div>
                  <div><dt>Paid By</dt><dd>{fieldValue(latestManualReferenceRow?.paid_by)}</dd></div>
                  <div><dt>O.R. No.</dt><dd>{fieldValue(latestManualReferenceRow?.receipt_no)}</dd></div>
                  <div><dt>Date</dt><dd>{formatDate(latestManualReferenceRow?.payment_date)}</dd></div>
                  <div><dt>Period Covered</dt><dd>{getTaxYear(latestManualReferenceRow)}</dd></div>
                  <div><dt>PIN</dt><dd>{fieldValue(latestManualReferenceRow?.new_pin, latestManualReferenceRow?.pin, latestManualReferenceRow?.property_index_number)}</dd></div>
                  <div><dt>Name of the Brgy.</dt><dd>{fieldValue(latestManualReferenceRow?.barangay_name, latestManualReferenceRow?.barangay, latestManualReferenceRow?.barangay_code)}</dd></div>
                </dl>
                <div className="manual-rpt-total-card">
                  <span><Calculator size={16} aria-hidden="true" /> Manual Total</span>
                  <strong>{formatMoney(Number(manualForm.total_amount || 0) > 0 ? Number(manualForm.total_amount) : manualComputedTotal)}</strong>
                </div>
              </aside>

              <div className="manual-rpt-payment-grid">
                {manualMessage && <div className={manualStatus === 'error' ? 'inline-alert manual-rpt-dialog-message' : 'inline-info manual-rpt-dialog-message'}>{manualMessage}</div>}

                <div className="manual-reference-table-wrap">
                  <div className="manual-reference-table-heading">
                    <strong>Search Result Details</strong>
                    <span>{manualReferenceRows.length} record(s){manualSearchSummary?.receipt_count ? `, ${manualSearchSummary.receipt_count} receipt(s)` : ''}</span>
                  </div>
                  <div className="table-scroll">
                    <table className="reports-table compact-table manual-reference-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Paid By</th>
                          <th>Name of the Taxpayer</th>
                          <th>Period Covered</th>
                          <th>PIN</th>
                          <th>O.R. No.</th>
                          <th>TD/ARP No.</th>
                          <th>Name of the Brgy.</th>
                          <th>Use</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manualReferenceRows.length === 0 && (
                          <tr><td colSpan="9" className="empty-table-message">Search TD No. to load iTax payment details.</td></tr>
                        )}
                        {manualReferenceRows.map((row, index) => (
                          <tr key={`${row.payment_id || row.manual_id || index}-${row.taxtrans_id || ''}-${row.taxyear || ''}`}>
                            <td>{formatDate(row.payment_date)}</td>
                            <td>{fieldValue(row.paid_by)}</td>
                            <td>{fieldValue(row.declared_owner, row.taxpayer_name)}</td>
                            <td>{getTaxYear(row)}</td>
                            <td>{fieldValue(row.new_pin, row.pin, row.property_index_number)}</td>
                            <td><strong>{fieldValue(row.receipt_no)}</strong></td>
                            <td>{fieldValue(row.td_no, row.td_no_for_gr, manualSearchTdNo)}</td>
                            <td>{fieldValue(row.barangay_name, row.barangay, row.barangay_code)}</td>
                            <td><button className="text-button" type="button" onClick={() => applyReferenceRow(row)}>Use</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <label className="treasury-field"><span>OR No.</span><input autoFocus required value={manualForm.receipt_no} onChange={(event) => updateManualForm('receipt_no', event.target.value)} placeholder="Official receipt no." /></label>
                <label className="treasury-field"><span>Date Paid</span><input required type="date" value={manualForm.payment_date} onChange={(event) => updateManualForm('payment_date', event.target.value)} /></label>
                <label className="treasury-field"><span>Paid By</span><input required value={manualForm.paid_by} onChange={(event) => updateManualForm('paid_by', event.target.value)} placeholder="Name of payer/client" /></label>
                <label className="treasury-field"><span>Collector</span><input required value={manualForm.collector} onChange={(event) => updateManualForm('collector', event.target.value)} placeholder="Collector name" /></label>
                <label className="treasury-field"><span>Name of the Taxpayer</span><input value={manualForm.declared_owner} onChange={(event) => updateManualForm('declared_owner', event.target.value)} placeholder={latestManualReferenceRow?.declared_owner || 'Taxpayer / declared owner'} /></label>
                <label className="treasury-field"><span>Period Covered</span><input required value={manualForm.tax_year} onChange={(event) => updateManualForm('tax_year', event.target.value)} placeholder="Tax year or period" /></label>
                <label className="treasury-field"><span>PIN</span><input value={manualForm.pin || ''} onChange={(event) => updateManualForm('pin', event.target.value)} placeholder="Property Index No." /></label>
                <label className="treasury-field"><span>TD/ARP No.</span><input value={manualForm.td_arp_no || ''} onChange={(event) => updateManualForm('td_arp_no', event.target.value)} placeholder="TD/ARP No." /></label>
                <label className="treasury-field"><span>Name of Brgy.</span><input value={manualForm.barangay_name || ''} onChange={(event) => updateManualForm('barangay_name', event.target.value)} placeholder="Barangay" /></label>
                <label className="treasury-field"><span>Basic Current Gross</span><input min="0" step="0.01" type="number" value={manualForm.basic_current_gross || ''} onChange={(event) => updateManualForm('basic_current_gross', event.target.value)} /></label>
                <label className="treasury-field"><span>Basic Discount</span><input min="0" step="0.01" type="number" value={manualForm.basic_discount || ''} onChange={(event) => updateManualForm('basic_discount', event.target.value)} /></label>
                <label className="treasury-field"><span>Basic Prior Years</span><input min="0" step="0.01" type="number" value={manualForm.basic_prior_years || ''} onChange={(event) => updateManualForm('basic_prior_years', event.target.value)} /></label>
                <label className="treasury-field"><span>Basic Penalty Current</span><input min="0" step="0.01" type="number" value={manualForm.basic_penalty_current_year || ''} onChange={(event) => updateManualForm('basic_penalty_current_year', event.target.value)} /></label>
                <label className="treasury-field"><span>Basic Penalty Previous</span><input min="0" step="0.01" type="number" value={manualForm.basic_penalty_previous_years || ''} onChange={(event) => updateManualForm('basic_penalty_previous_years', event.target.value)} /></label>
                <label className="treasury-field"><span>Basic Penalty Prior</span><input min="0" step="0.01" type="number" value={manualForm.basic_penalty_prior_years || ''} onChange={(event) => updateManualForm('basic_penalty_prior_years', event.target.value)} /></label>
                <label className="treasury-field"><span>SEF Current Gross</span><input min="0" step="0.01" type="number" value={manualForm.sef_current_gross || ''} onChange={(event) => updateManualForm('sef_current_gross', event.target.value)} /></label>
                <label className="treasury-field"><span>SEF Discount</span><input min="0" step="0.01" type="number" value={manualForm.sef_discount || ''} onChange={(event) => updateManualForm('sef_discount', event.target.value)} /></label>
                <label className="treasury-field"><span>SEF Prior Years</span><input min="0" step="0.01" type="number" value={manualForm.sef_prior_years || ''} onChange={(event) => updateManualForm('sef_prior_years', event.target.value)} /></label>
                <label className="treasury-field"><span>SEF Penalty Current</span><input min="0" step="0.01" type="number" value={manualForm.sef_penalty_current_year || ''} onChange={(event) => updateManualForm('sef_penalty_current_year', event.target.value)} /></label>
                <label className="treasury-field"><span>SEF Penalty Previous</span><input min="0" step="0.01" type="number" value={manualForm.sef_penalty_previous_years || ''} onChange={(event) => updateManualForm('sef_penalty_previous_years', event.target.value)} /></label>
                <label className="treasury-field"><span>SEF Penalty Prior</span><input min="0" step="0.01" type="number" value={manualForm.sef_penalty_prior_years || ''} onChange={(event) => updateManualForm('sef_penalty_prior_years', event.target.value)} /></label>
                <label className="treasury-field"><span>Property Classification</span><input value={manualForm.property_classification || ''} onChange={(event) => updateManualForm('property_classification', event.target.value)} /></label>
                <label className="treasury-field"><span>Property Kind</span><input value={manualForm.property_kind || ''} onChange={(event) => updateManualForm('property_kind', event.target.value)} /></label>
                <label className="treasury-field"><span>PAYMENT STATUS_CT</span><input value={manualForm.payment_status_ct || ''} onChange={(event) => updateManualForm('payment_status_ct', event.target.value)} /></label>
                <label className="treasury-field"><span>BOOKINGREFERENCE</span><input value={manualForm.booking_reference || ''} onChange={(event) => updateManualForm('booking_reference', event.target.value)} placeholder="RCD / booking reference" /></label>
                <label className="treasury-field"><span>Basic</span><input min="0" step="0.01" type="number" value={manualForm.basic_tax} onChange={(event) => updateManualForm('basic_tax', event.target.value)} /></label>
                <label className="treasury-field"><span>Basic Penalty</span><input min="0" step="0.01" type="number" value={manualForm.basic_penalty} onChange={(event) => updateManualForm('basic_penalty', event.target.value)} /></label>
                <label className="treasury-field"><span>SEF</span><input min="0" step="0.01" type="number" value={manualForm.sef_tax} onChange={(event) => updateManualForm('sef_tax', event.target.value)} /></label>
                <label className="treasury-field"><span>SEF Penalty</span><input min="0" step="0.01" type="number" value={manualForm.sef_penalty} onChange={(event) => updateManualForm('sef_penalty', event.target.value)} /></label>
                <label className="treasury-field"><span>Total Override</span><input min="0" step="0.01" type="number" value={manualForm.total_amount} onChange={(event) => updateManualForm('total_amount', event.target.value)} placeholder={manualComputedTotal ? String(manualComputedTotal.toFixed(2)) : 'Auto total'} /></label>
                <label className="treasury-field"><span>RCD No.</span><input value={manualForm.rcd_number} onChange={(event) => updateManualForm('rcd_number', event.target.value)} placeholder="Optional RCD No." /></label>
                <label className="treasury-field manual-rpt-remarks"><span>Remarks</span><textarea value={manualForm.remarks} onChange={(event) => updateManualForm('remarks', event.target.value)} placeholder="Reason / approval notes" /></label>
              </div>

              <footer className="manual-rpt-dialog-actions">
                <button className="secondary-button" type="button" onClick={closeManualDialog}>Cancel</button>
                <button className="secondary-button" type="button" onClick={() => resetManualForm(latestManualReferenceRow)}>Use latest iTax details</button>
                <button className="primary-button" disabled={manualStatus === 'saving'} type="submit"><Plus size={16} aria-hidden="true" />Save Manual Payment</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      <section className="report-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Payment History</p>
            <h3>RPT Receipts by TD No.</h3>
            <span>{rows.length} record(s) loaded</span>
          </div>
          <div className="search-td-header-actions">
            <div className="metric-pill">
              <FileSearch size={16} aria-hidden="true" />
              {formatMoney(summary?.total_amount ?? totalAmount)}
            </div>
            <button className="primary-button" type="button" onClick={openManualDialog}>
              <Plus size={16} aria-hidden="true" />
              Manual Payment
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="reports-table compact-table">
            <thead>
              <tr>
                <th>Source</th><th>Date Paid</th><th>TD No.</th><th>Declared Owner</th><th>Paid By</th><th>OR No.</th><th>Tax Year</th><th>Basic</th><th>Basic Penalty</th><th>SEF</th><th>SEF Penalty</th><th>Total</th><th>Collector</th><th>RCD No.</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan="15" className="empty-table-message">{status === 'success' ? 'No paid RPT receipts found for this TD No.' : 'Search a TD No. to load RPT payment history.'}</td></tr>
              )}
              {rows.map((row) => (
                <tr key={`${row.payment_id || row.manual_id}-${row.taxtrans_id || ''}-${row.taxyear || row.tax_year || ''}`}>
                  <td><span className={row.source === 'manual' ? 'status-badge warning' : 'status-badge'}>{row.source === 'manual' ? 'Manual' : 'iTax'}</span></td><td>{formatDate(row.payment_date)}</td><td><strong>{row.td_no || row.td_no_for_gr || '-'}</strong></td><td>{row.declared_owner || '-'}</td><td>{row.paid_by || '-'}</td><td><strong>{row.receipt_no || '-'}</strong></td><td>{row.taxyear || row.tax_year || '-'}</td><td>{formatMoney(row.basic_tax || 0)}</td><td>{formatMoney(row.basic_penalty || 0)}</td><td>{formatMoney(row.sef_tax || 0)}</td><td>{formatMoney(row.sef_penalty || 0)}</td><td><strong>{formatMoney(row.total_amount || 0)}</strong></td><td>{row.collector || '-'}</td><td>{row.rcd_number || '-'}</td><td>{row.source === 'manual' ? <button className="text-danger-button" type="button" onClick={() => deleteManualPayment(row.manual_id)}><Trash2 size={14} aria-hidden="true" />Delete</button> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
