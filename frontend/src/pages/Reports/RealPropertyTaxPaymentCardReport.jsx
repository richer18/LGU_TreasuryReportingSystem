import { FileText, Printer, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import './RealPropertyTaxPaymentCardReport.css'

const initialFilters = {
  taxDeclaration: '',
  owner: '',
  barangayCode: '',
  tctNumber: '',
  lotNumber: '',
  taxYear: '',
  dateFrom: '',
  dateTo: '',
}

const money = (amount) => {
  const value = Number(amount)
  if (!Number.isFinite(value)) return ''
  return value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const displayDate = (value) => {
  if (!value) return ''
  const parsed = new Date(String(value).slice(0, 10) + 'T00:00:00')
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

const printableRows = (payments) => {
  const rows = [...payments]
  while (rows.length < 16) rows.push(null)
  return rows
}

export function RealPropertyTaxPaymentCardReport({ canPrint = false }) {
  const [filters, setFilters] = useState(initialFilters)
  const [matches, setMatches] = useState([])
  const [card, setCard] = useState(null)
  const [selectedTaxtransId, setSelectedTaxtransId] = useState('')
  const [status, setStatus] = useState('empty')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }))
    setMessage('')
  }

  const requestParams = (taxtransId = '') => ({
    taxtrans_id: taxtransId || undefined,
    tax_declaration: filters.taxDeclaration.trim() || undefined,
    owner: filters.owner.trim() || undefined,
    barangay_code: filters.barangayCode.trim() || undefined,
    tct_number: filters.tctNumber.trim() || undefined,
    lot_number: filters.lotNumber.trim() || undefined,
    tax_year: filters.taxYear || undefined,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    limit: 25,
  })

  const loadCard = async (taxtransId = '') => {
    const hasLookup = taxtransId || filters.taxDeclaration.trim() || filters.owner.trim() || filters.tctNumber.trim() || filters.lotNumber.trim()

    if (!hasLookup) {
      setCard(null)
      setMatches([])
      setStatus('empty')
      setMessage('Select a property or enter a Tax Declaration Number to generate the report.')
      return
    }

    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      setMessage('Payment Date From must not be later than Payment Date To.')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const response = await axiosInstance.get('/rpt-payment-card', { params: requestParams(taxtransId) })
      const resultMatches = response.data.matches || []
      const resultCard = response.data.card || null
      setMatches(resultMatches)
      setCard(resultCard)
      setSelectedTaxtransId(taxtransId || resultCard?.property?.taxtrans_id || '')

      if (resultCard) {
        setStatus(resultCard.payments?.length ? 'ready' : 'no-payments')
        setMessage(resultCard.payments?.length ? '' : 'Property record found, but no tax payment entries are available.')
      } else if (resultMatches.length > 1) {
        setStatus('matches')
        setMessage('Multiple properties matched. Select the correct property below.')
      } else {
        setStatus('no-result')
        setMessage('No matching real property tax record was found.')
      }
    } catch (error) {
      setCard(null)
      setMatches([])
      setStatus('error')
      setMessage(error.response?.data?.message || error.response?.data?.errors?.tax_declaration?.[0] || 'Unable to load the Real Property Tax Payment Card. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const clearReport = () => {
    setFilters(initialFilters)
    setMatches([])
    setCard(null)
    setSelectedTaxtransId('')
    setStatus('empty')
    setMessage('')
  }

  const printReport = () => {
    if (!card) return
    const pageStyle = document.createElement('style')
    pageStyle.id = 'rpt-payment-card-page-style'
    pageStyle.textContent = '@page { size: A4 landscape; margin: 8mm; }'
    document.head.appendChild(pageStyle)

    const cleanup = () => {
      document.body.classList.remove('rpt-payment-card-printing')
      document.getElementById('rpt-payment-card-page-style')?.remove()
    }

    document.body.classList.add('rpt-payment-card-printing')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
    window.setTimeout(cleanup, 10000)
  }

  const ownership = card?.ownership || []
  const owners = [...ownership]
  while (owners.length < 3) owners.push(null)
  const property = card?.property || {}
  const payments = card?.payments || []
  const delinquencies = card?.delinquencies || []
  const delinquencyTotal = delinquencies.reduce((sum, row) => sum + Number(row.total || 0), 0)

  return (
    <section className="rpt-payment-card-module" aria-label="Real Property Tax Payment Card">
      <div className="rpt-card-toolbar no-print">
        <div className="rpt-card-toolbar-heading">
          <FileText size={20} aria-hidden="true" />
          <div>
            <h3>Real Property Tax Payment Card</h3>
            <p>Generate a property tax account register for a selected declaration or owner.</p>
          </div>
        </div>
        <div className="rpt-card-toolbar-actions">
          <button className="secondary-button" onClick={clearReport} type="button">
            <RotateCcw size={15} aria-hidden="true" /> Clear
          </button>
          {canPrint && (
            <button className="secondary-button" disabled={!card} onClick={printReport} type="button">
              <Printer size={15} aria-hidden="true" /> Print
            </button>
          )}
        </div>
      </div>

      <div className="rpt-card-filters no-print">
        <label className="treasury-field">
          <span>Tax Declaration Number</span>
          <input value={filters.taxDeclaration} onChange={(event) => updateFilter('taxDeclaration', event.target.value)} placeholder="Enter T.D. number" />
        </label>
        <label className="treasury-field rpt-card-owner-filter">
          <span>Property Owner</span>
          <input value={filters.owner} onChange={(event) => updateFilter('owner', event.target.value)} placeholder="Owner or declarant name" />
        </label>
        <label className="treasury-field">
          <span>Barangay Code</span>
          <input value={filters.barangayCode} onChange={(event) => updateFilter('barangayCode', event.target.value)} placeholder="Optional" />
        </label>
        <label className="treasury-field">
          <span>TCT Number</span>
          <input value={filters.tctNumber} onChange={(event) => updateFilter('tctNumber', event.target.value)} placeholder="Optional" />
        </label>
        <label className="treasury-field">
          <span>Lot Number</span>
          <input value={filters.lotNumber} onChange={(event) => updateFilter('lotNumber', event.target.value)} placeholder="Optional" />
        </label>
        <label className="treasury-field">
          <span>Tax Year</span>
          <input min="1900" max="2200" type="number" value={filters.taxYear} onChange={(event) => updateFilter('taxYear', event.target.value)} placeholder="All years" />
        </label>
        <label className="treasury-field">
          <span>Payment Date From</span>
          <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
        </label>
        <label className="treasury-field">
          <span>Payment Date To</span>
          <input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
        </label>
        <button className="primary-button rpt-card-generate" disabled={loading} onClick={() => loadCard()} type="button">
          <Search size={16} aria-hidden="true" /> {loading ? 'Loading...' : 'Generate Report'}
        </button>
      </div>

      {matches.length > 1 && (
        <label className="treasury-field rpt-card-match-picker no-print">
          <span>Matching Properties</span>
          <select
            value={selectedTaxtransId}
            onChange={(event) => {
              setSelectedTaxtransId(event.target.value)
              if (event.target.value) loadCard(event.target.value)
            }}
          >
            <option value="">Select the correct property</option>
            {matches.map((match) => (
              <option key={match.taxtrans_id} value={match.taxtrans_id}>
                {match.owner_name || 'Unknown owner'} - {match.tax_declaration_number} - {match.barangay || match.barangay_code || 'No barangay'}
              </option>
            ))}
          </select>
        </label>
      )}

      {message && <div className={status === 'error' ? 'rpt-card-message rpt-card-message-error no-print' : 'rpt-card-message no-print'}>{message}</div>}
      {!card && !message && <div className="rpt-card-empty no-print">Select a property or enter a Tax Declaration Number to generate the report.</div>}
      <p className="rpt-card-mobile-note no-print">Landscape desktop or print view is recommended for this report.</p>

      {card && (
        <div className="rpt-card-preview-shell">
          <article className="rpt-card-print-area">
            <h2>REAL PROPERTY TAX ACCOUNT REGISTER</h2>

            <div className="rpt-card-top-grid">
              <table className="rpt-card-ownership-table">
                <caption>RECORD OF OWNERSHIP</caption>
                <thead>
                  <tr><th>NAME</th><th>ADDRESS</th><th>DATE OF TRANSFER</th></tr>
                </thead>
                <tbody>
                  {owners.map((owner, index) => (
                    <tr key={owner ? (owner.name + owner.date_of_transfer + index) : 'blank-owner-' + index}>
                      <td>{owner?.name || ''}</td>
                      <td>{owner?.address || ''}</td>
                      <td>{displayDate(owner?.date_of_transfer)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="rpt-card-property-location">
                <h3>LOCATION OF PROPERTY</h3>
                <dl>
                  <div><dt>BARANGAY</dt><dd>{property.barangay || property.barangay_code || ''}</dd></div>
                  <div><dt>TCT</dt><dd>{property.tct_number || ''}</dd></div>
                  <div><dt>LOT NUMBER</dt><dd>{property.lot_number || ''}</dd></div>
                  <div><dt>AREA</dt><dd>{Number(property.area || 0).toLocaleString('en-PH')}</dd></div>
                </dl>
              </div>
            </div>

            <table className="rpt-card-payment-table">
              <caption>RECORD OF TAXES AND PAYMENTS</caption>
              <thead>
                <tr>
                  <th rowSpan={2}>TAX DECLARATION NUMBER</th>
                  <th colSpan={3}>ASSESSED VALUE</th>
                  <th rowSpan={2}>TAX YEAR</th>
                  <th colSpan={4}>TAX COLLECTED</th>
                  <th rowSpan={2}>OFFICIAL RECEIPT NUMBER</th>
                  <th rowSpan={2}>DATE</th>
                  <th rowSpan={2}>CLERK'S INITIAL</th>
                </tr>
                <tr>
                  <th>LAND</th><th>IMPROV.</th><th>TOTAL</th>
                  <th>BASIC</th><th>SEF</th><th>DISCOUNT / PENALTY</th><th>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {printableRows(payments).map((payment, index) => (
                  <tr key={payment ? (payment.official_receipt_number + payment.tax_year + index) : 'blank-payment-' + index}>
                    <td>{payment?.tax_declaration_number || ''}</td>
                    <td className="amount">{payment ? money(payment.land_assessed_value) : ''}</td>
                    <td className="amount">{payment ? money(payment.improvement_assessed_value) : ''}</td>
                    <td className="amount">{payment ? money(payment.total_assessed_value) : ''}</td>
                    <td>{payment?.tax_year || ''}</td>
                    <td className="amount">{payment ? money(payment.basic_tax) : ''}</td>
                    <td className="amount">{payment ? money(payment.sef_tax) : ''}</td>
                    <td className="amount">{payment ? money(payment.discount_penalty) : ''}</td>
                    <td className="amount">{payment ? money(payment.total_tax_collected) : ''}</td>
                    <td>{payment?.official_receipt_number || ''}</td>
                    <td>{displayDate(payment?.payment_date)}</td>
                    <td>{payment?.clerk_initials || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section className="rpt-card-delinquency-section">
              <div className="rpt-card-delinquency-heading">
                <div>
                  <h3>UNPAID / DELINQUENT TAXES</h3>
                  <p>Outstanding open BSC and SEF ledger balances as of {displayDate(card.delinquency_as_of)}.</p>
                </div>
                <strong>TOTAL: PHP {money(delinquencyTotal)}</strong>
              </div>
              <table className="rpt-card-delinquency-table">
                <thead>
                  <tr>
                    <th>TAX DECLARATION NUMBER</th>
                    <th>LOT NUMBER</th>
                    <th>UNPAID YEAR</th>
                    <th>BASIC DUE</th>
                    <th>BASIC PENALTY / ADJUSTMENT</th>
                    <th>SEF DUE</th>
                    <th>SEF PENALTY / ADJUSTMENT</th>
                    <th>TOTAL DELINQUENCY</th>
                  </tr>
                </thead>
                <tbody>
                  {delinquencies.length === 0 ? (
                    <tr>
                      <td className="rpt-card-no-delinquency" colSpan={8}>No outstanding delinquent tax balance was found for this property.</td>
                    </tr>
                  ) : delinquencies.map((row, index) => (
                    <tr key={`${row.tax_declaration_number}-${row.tax_year}-${index}`}>
                      <td>{row.tax_declaration_number || property.tax_declaration_number || ''}</td>
                      <td>{property.lot_number || ''}</td>
                      <td>{row.tax_year || ''}</td>
                      <td className="amount">{money(row.basic_tax_due)}</td>
                      <td className="amount">{money(row.basic_penalty)}</td>
                      <td className="amount">{money(row.sef_due)}</td>
                      <td className="amount">{money(row.sef_penalty)}</td>
                      <td className="amount rpt-card-delinquency-total">{money(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </article>
        </div>
      )}
    </section>
  )
}
