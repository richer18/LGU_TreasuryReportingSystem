import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  Info,
  ListChecks,
  Menu,
  RefreshCcw,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import { formatMoney } from '../GeneralFund/utils/generalFundFormat'

const toLocalDate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getPeriod = (year) => {
  const today = new Date()
  const selectedYear = Number(year) || today.getFullYear()
  const dateTo = selectedYear === today.getFullYear() ? today : new Date(selectedYear, 11, 31)
  const yearStart = new Date(selectedYear, 0, 1)
  const monthStart = new Date(selectedYear, dateTo.getMonth(), 1)
  const yearEnd = new Date(selectedYear, 11, 31)
  const elapsedMs = dateTo.getTime() - yearStart.getTime()
  const totalMs = yearEnd.getTime() - yearStart.getTime()
  const elapsedRatio = Math.min(1, Math.max(0, elapsedMs / totalMs))

  return {
    dateTo: toLocalDate(dateTo),
    month: dateTo.getMonth() + 1,
    monthFrom: toLocalDate(monthStart),
    monthName: dateTo.toLocaleString('en-PH', { month: 'long' }),
    selectedYear,
    ytdFrom: toLocalDate(yearStart),
    elapsedRatio,
  }
}

const findTotalRow = (rows = []) =>
  rows.find((row) => row.total || String(row.source || '').toUpperCase() === 'TOTAL') || {}

const getCollectionTotal = (payload) => Number(findTotalRow(payload?.rows).total_collections || 0)
const normalizeName = (value) => String(value || '').trim().toLowerCase()

const sourceAmount = (rows, names) => {
  const lookup = new Set(names.map(normalizeName))
  return (rows || []).reduce((total, row) => (
    lookup.has(normalizeName(row.source))
      ? total + Number(row.total_collections || 0)
      : total
  ), 0)
}

const rptSharingMunicipalShareAmount = (payload) => {
  const rows = payload?.rows || []
  const grandTotal = rows.find((row) => row.grand_total)
  if (grandTotal) return Number(grandTotal.municipal_share_40 || 0)

  return rows
    .filter((row) => row.total && ['Land', 'Building'].includes(row.property_group))
    .reduce((total, row) => total + Number(row.municipal_share_40 || 0), 0)
}

const targetAmount = (rows, matcher) => {
  const row = (rows || []).find((item) => matcher(String(item.particular || '').toUpperCase()))
  return Number(row?.target_amount || 0)
}

const getDashboardError = (error, fallback) =>
  error.response?.data?.error || error.response?.data?.message || error.message || fallback

const emptyDashboardData = {
  collectors: null,
  diveTickets: null,
  diveTicketsYear: null,
  incomeTarget: null,
  recentPayments: null,
  monthCollections: null,
  rptSharing: null,
  ytdCollections: null,
  collectorsReconciliation: null,
}

const mapDashboardCachePayload = (payload = {}) => ({
  collectors: payload.collector_summary || null,
  collectorsReconciliation: payload.collector_reconciliation || null,
  diveTickets: payload.dive_ticket_summary?.current_month || null,
  diveTicketsYear: payload.dive_ticket_summary?.whole_year || null,
  incomeTarget: payload.income_target_summary || null,
  recentPayments: payload.recent_collections || null,
  monthCollections: payload.report_preview_cache?.report_21_current_month || null,
  rptSharing: payload.report_preview_cache?.report_27_ytd || null,
  ytdCollections: payload.report_preview_cache?.report_21_ytd || null,
})

const formatPercent = (value) =>
  new Intl.NumberFormat('en-PH', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(Number(value || 0))

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value || 0)))
const compactMoney = (value) =>
  new Intl.NumberFormat('en-PH', {
    currency: 'PHP',
    maximumFractionDigits: 1,
    notation: 'compact',
    style: 'currency',
  }).format(Number(value || 0))

const dashboardColors = ['#1687f8', '#38a3ff', '#22c55e', '#f59e0b', '#f97316', '#94a3b8']

const categoryConfig = [
  {
    key: 'tax_on_business',
    label: 'Tax on Business',
    target: (rows) => targetAmount(rows, (name) => name === 'TAX ON BUSINESS'),
    actual: (rows) => sourceAmount(rows, [
      'Manufacturing',
      'Distributor',
      'Retailing',
      'Banks & Other Financial Int.',
      'Other Business Tax',
    ]),
  },
  {
    key: 'regulatory',
    label: 'Regulatory Fees and Charges',
    target: (rows) => targetAmount(rows, (name) => name.startsWith('REGULATORY FEES')),
    actual: (rows) => sourceAmount(rows, [
      "Mayor's Permit",
      'Weights & Measures',
      'Tricycle Permit Fee',
      'Occupation Tax',
      'Cert. of Ownership',
      'Cert. of Transfer',
      'Sand & Gravel',
      'Fines & Penalties',
      'Docking and Mooring Fee',
      'Fishing Permit Fee',
      'Miscellaneous',
    ]),
  },
  {
    key: 'economic',
    label: 'Receipts from Economic Enterprise',
    target: (rows) => targetAmount(rows, (name) => name.startsWith('RECEIPTS FROM ECONOMIC ENTERPRISES')),
    actual: (rows) => sourceAmount(rows, [
      'Water Fee',
      'Market Stall Fee',
      'Cash Tickets',
      'SlaughterHouse Fee',
      'Slaughterhouse Fee',
      'Rental of Equipment',
      'Rent of Equipment',
      'Cockpit Share',
      'Sultadas',
      'Diving Fee',
    ]),
  },
  {
    key: 'service',
    label: 'Service/User Charges',
    target: (rows) => targetAmount(rows, (name) => name.startsWith('SERVICE/USER CHARGES')),
    actual: (rows) => sourceAmount(rows, [
      'Registration of Birth',
      'Marriage Fee',
      'Burial Fee',
      'Correction of Entry',
      'Sale of Agri. Prod.',
      'Sale of Acct. Forms',
      'Doc Stamp Tax',
      'Secretaries Fees',
      'Med./Lab. Fees',
      'Garbage Fees',
    ]),
  },
  {
    key: 'other_taxes',
    label: 'Other Taxes',
    target: (rows) => targetAmount(rows, (name) => name === 'OTHER TAXES'),
    actual: (rows) => sourceAmount(rows, ['Com Tax Cert.']),
  },
  {
    key: 'rpt',
    label: 'RPT Local GF (40%)',
    target: (rows) => targetAmount(rows, (name) => name === 'REAL PROPERTY TAX'),
    actual: (_rows, context) => rptSharingMunicipalShareAmount(context.rptSharing),
  },
]

const statusForRate = (rate, target = 0) => {
  if (Number(target || 0) <= 0) return { label: 'No data', tone: 'neutral' }
  if (rate >= 100) return { label: 'On track', tone: 'good' }
  if (rate >= 70) return { label: 'Watch', tone: 'warning' }
  return { label: 'Needs attention', tone: 'critical' }
}

const initialsFromName = (name) => {
  const parts = String(name || 'U').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const reconciliationMessage = (reconciliation = {}) => {
  const difference = Number(reconciliation.difference || 0)
  const absolute = formatMoney(Math.abs(difference))
  if (Math.abs(difference) <= 0.01) return 'Collector totals match overall paid collections.'
  if (difference > 0) return `Collector totals are ${absolute} lower than overall paid collections.`
  return `Collector totals exceed overall paid collections by ${absolute}.`
}

const navigateTo = (path) => {
  if (typeof window === 'undefined') return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function DashboardPage({ user, connectionClass, connectionLabel, onOpenMenu }) {
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [dashboardData, setDashboardData] = useState(emptyDashboardData)
  const [cacheMeta, setCacheMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const period = useMemo(() => getPeriod(year), [year])

  const loadDashboard = async (targetYear = year) => {
    const nextPeriod = getPeriod(targetYear)
    setLoading(true)
    setError('')

    try {
      const response = await axiosInstance.get('/dashboard/summary', {
        params: { year: targetYear, month: nextPeriod.month },
      })
      setCacheMeta(response.data)
      if (!response.data.success) {
        setDashboardData(emptyDashboardData)
        setError(response.data.message || 'Dashboard cache not found. Refresh dashboard data first.')
        return
      }
      setDashboardData(mapDashboardCachePayload(response.data.payload))
    } catch (requestError) {
      setDashboardData(emptyDashboardData)
      setCacheMeta(null)
      setError(getDashboardError(requestError, 'Unable to load collection dashboard.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard(year)
  }, [year])

  const refreshDashboardData = async () => {
    const nextPeriod = getPeriod(year)
    setRefreshing(true)
    setError('')
    try {
      await axiosInstance.post('/dashboard/summary/refresh', null, {
        params: { year, month: nextPeriod.month },
      })
      await loadDashboard(year)
    } catch (requestError) {
      setError(getDashboardError(requestError, 'Unable to refresh dashboard cache.'))
    } finally {
      setRefreshing(false)
    }
  }

  const collectionModel = useMemo(() => {
    const summary = dashboardData.incomeTarget?.summary || {}
    const ytdRow = findTotalRow(dashboardData.ytdCollections?.rows)
    const monthTotal = getCollectionTotal(dashboardData.monthCollections)
    const ytdTotal = Number(ytdRow.total_collections || 0)
    const localTarget = Number(summary.local_sources || 0)
    const targetToDate = localTarget * period.elapsedRatio
    const monthlyTarget = localTarget / 12
    const annualRate = localTarget > 0 ? (ytdTotal / localTarget) * 100 : 0
    const expectedRate = period.elapsedRatio * 100
    const monthRate = monthlyTarget > 0 ? (monthTotal / monthlyTarget) * 100 : 0
    const remaining = Math.max(0, localTarget - ytdTotal)
    const varianceToDate = ytdTotal - targetToDate

    return {
      annualRate,
      expectedRate,
      localTarget,
      monthRate,
      monthTotal,
      monthlyTarget,
      remaining,
      targetToDate,
      varianceToDate,
      ytdRow,
      ytdTotal,
    }
  }, [dashboardData, period])

  const categoryRows = useMemo(() => {
    const targetRows = dashboardData.incomeTarget?.rows || []
    const collectionRows = dashboardData.ytdCollections?.rows || []
    return categoryConfig.map((item) => {
      const target = item.target(targetRows)
      const actual = item.actual(collectionRows, dashboardData)
      const rate = target > 0 ? (actual / target) * 100 : 0
      return { ...item, actual, rate, target, variance: actual - target }
    })
  }, [dashboardData])

  const allCollectorRows = useMemo(() => dashboardData.collectors || [], [dashboardData.collectors])
  const collectorTotal = useMemo(
    () => allCollectorRows.reduce((total, row) => total + Number(row.total_amount || 0), 0),
    [allCollectorRows],
  )
  const topCollectorRows = useMemo(() => allCollectorRows.slice(0, 5), [allCollectorRows])
  const reconciliation = dashboardData.collectorsReconciliation || {}
  const diveTickets = dashboardData.diveTickets || {}
  const topDiveBuyers = dashboardData.diveTicketsYear?.top_buyers || []
  const topDiveBuyer = topDiveBuyers[0] || null

  const collectionShareRows = useMemo(() => {
    const row = collectionModel.ytdRow
    return [
      { label: 'Municipal GF', value: Number(row.municipal_general_fund || 0), color: dashboardColors[0] },
      { label: 'Municipal SEF', value: Number(row.municipal_sef || 0), color: dashboardColors[1] },
      { label: 'Municipal TF', value: Number(row.municipal_trust_fund || 0), color: dashboardColors[2] },
      { label: 'Provincial', value: Number(row.provincial_total || 0), color: dashboardColors[3] },
      { label: 'National', value: Number(row.national || 0), color: dashboardColors[4] },
      {
        label: 'Barangay/Fisheries',
        value: Number(row.barangay_share || 0) + Number(row.fisheries || 0),
        color: dashboardColors[5],
      },
    ]
  }, [collectionModel.ytdRow])

  const recentPayments = useMemo(
    () => (dashboardData.recentPayments || [])
      .filter((row) => String(row.collection_status || 'Paid') === 'Paid')
      .sort((a, b) => {
        const dateSort = String(b.collection_date || '').localeCompare(String(a.collection_date || ''))
        if (dateSort !== 0) return dateSort
        return String(b.receipt_no || '').localeCompare(String(a.receipt_no || ''), undefined, { numeric: true })
      })
      .slice(0, 5),
    [dashboardData.recentPayments],
  )

  const dataReady = Boolean(dashboardData.ytdCollections && dashboardData.incomeTarget)
  const variancePositive = collectionModel.varianceToDate >= 0
  const paceLabel = variancePositive ? 'Ahead of pace' : 'Behind pace'
  const canReviewReconciliation = Boolean(user?.permissions?.includes('aco_dashboard.view'))
  const paceMessage = variancePositive
    ? `Collections are ${formatMoney(collectionModel.varianceToDate)} ahead of expected pace.`
    : `Collections are ${formatMoney(Math.abs(collectionModel.varianceToDate))} below expected pace.`

  return (
    <div className="revenue-bi">
      <header className="revenue-bi-topbar">
        <div className="revenue-bi-heading">
          <button aria-label="Open navigation" className="revenue-bi-mobile-menu" onClick={onOpenMenu} type="button">
            <Menu size={20} aria-hidden="true" />
          </button>
          <div>
            <div className="revenue-bi-breadcrumb"><span>Dashboard</span><b>/</b><span>Revenue</span></div>
            <div className="revenue-bi-title-line">
              <h1>Revenue Overview</h1>
              <button
                aria-label="Dashboard methodology"
                className="revenue-bi-info"
                title="Figures use generated paid Report 21 collections, Report 27 municipal share where applicable, and configured income-target records."
                type="button"
              >
                <Info size={16} aria-hidden="true" />
              </button>
            </div>
            <p>Municipal collection performance for the selected year</p>
          </div>
        </div>

        <div className="revenue-bi-toolbar">
          <label>
            <span><CalendarDays size={13} aria-hidden="true" /> Year</span>
            <input
              aria-label="Dashboard year"
              max="2100"
              min="2000"
              onChange={(event) => setYear(event.target.value)}
              type="number"
              value={year}
            />
          </label>
          <div className="revenue-bi-updated">
            <span>Last updated</span>
            <strong>{cacheMeta?.generated_at || 'Not available'}</strong>
          </div>
          <span className={`revenue-bi-connection ${connectionClass || ''}`}>
            <i aria-hidden="true" />
            {connectionLabel || (cacheMeta?.success ? 'Connected' : 'Unavailable')}
          </span>
          <button
            className="revenue-bi-refresh"
            disabled={loading || refreshing}
            onClick={refreshDashboardData}
            type="button"
          >
            <RefreshCcw className={refreshing ? 'is-spinning' : ''} size={16} aria-hidden="true" />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <StateBanner message={error} tone="error" />}
      {loading && !error && <DashboardSkeleton />}
      {!loading && !error && (
        <>
          <section className="revenue-bi-section">
            <SectionHeading title="Overview" />
            <div className="revenue-bi-kpis">
              <MetricCard
                icon={WalletCards}
                label="Collected YTD"
                value={dataReady ? formatMoney(collectionModel.ytdTotal) : null}
                detail={dataReady ? `${formatPercent(collectionModel.annualRate)}% of annual local target` : null}
                percent={collectionModel.annualRate}
                tone="blue"
              />
              <MetricCard
                icon={Target}
                label="Annual target"
                value={dataReady ? formatMoney(collectionModel.localTarget) : null}
                detail={dataReady ? `${formatMoney(collectionModel.remaining)} remaining` : null}
                percent={collectionModel.annualRate}
                tone="slate"
              />
              <MetricCard
                icon={CalendarDays}
                label="Expected pace"
                value={dataReady ? formatMoney(collectionModel.targetToDate) : null}
                detail={dataReady ? `${formatPercent(collectionModel.expectedRate)}% of year elapsed` : null}
                percent={collectionModel.expectedRate}
                tone="cyan"
              />
              <MetricCard
                icon={variancePositive ? TrendingUp : TrendingDown}
                label="Variance to pace"
                value={dataReady ? formatMoney(collectionModel.varianceToDate) : null}
                detail={dataReady ? paceMessage : null}
                percent={collectionModel.annualRate - collectionModel.expectedRate}
                status={dataReady ? paceLabel : null}
                tone={variancePositive ? 'good' : 'warning'}
              />
            </div>
          </section>

          <section className="revenue-bi-analytics" aria-label="Revenue analytics">
            <AnalyticsCard title="Collection performance" subtitle="Actual and expected collections for the selected year">
              {dataReady ? (
                <ComparisonChart
                  ariaLabel="YTD actual collections compared with expected pace and annual target"
                  values={[
                    { label: 'Collected YTD', value: collectionModel.ytdTotal, tone: 'actual' },
                    { label: 'Expected to date', value: collectionModel.targetToDate, tone: 'expected' },
                    { label: 'Annual target', value: collectionModel.localTarget, tone: 'target' },
                  ]}
                />
              ) : <EmptyState message="No collection performance data is available for the selected year." />}
            </AnalyticsCard>

            <AnalyticsCard title="Monthly collections" subtitle={`${period.monthName} actual collection versus target pace`}>
              {dashboardData.monthCollections && dashboardData.incomeTarget ? (
                <ComparisonChart
                  ariaLabel={`${period.monthName} actual collection compared with monthly target pace`}
                  values={[
                    { label: period.monthName + ' actual', value: collectionModel.monthTotal, tone: 'actual' },
                    { label: 'Monthly target', value: collectionModel.monthlyTarget, tone: 'expected' },
                  ]}
                />
              ) : <EmptyState message="No monthly collection data is available for the selected year." />}
            </AnalyticsCard>
          </section>

          <section className="revenue-bi-section">
            <SectionHeading title="Revenue details" />
            <div className="revenue-bi-details">
              <RevenueSourceTable available={dataReady} rows={categoryRows} />
              <aside className="revenue-bi-insights" aria-label="Revenue insights">
                <CollectionMixCard rows={collectionShareRows} total={collectionModel.ytdTotal} />
                <ReconciliationCard onReview={canReviewReconciliation ? () => navigateTo('/aco-dashboard') : null} reconciliation={reconciliation} />
                <CurrentMonthCard available={Boolean(dashboardData.monthCollections && dashboardData.incomeTarget)} model={collectionModel} monthName={period.monthName} />
                <DiveTicketCard available={Boolean(dashboardData.diveTickets)} summary={diveTickets} topBuyer={topDiveBuyer} />
              </aside>
            </div>
          </section>

          <section className="revenue-bi-section">
            <SectionHeading title="Operations" />
            <div className="revenue-bi-operations">
              <TopCollectors rows={topCollectorRows} total={collectorTotal} />
              <RecentReceipts rows={recentPayments} />
            </div>
          </section>

          <p className="revenue-bi-methodology">
            <Info size={14} aria-hidden="true" />
            Figures use generated paid Report 21 collections, Report 27 municipal share where applicable, and configured income-target records.
          </p>
        </>
      )}
    </div>
  )
}

function SectionHeading({ title }) {
  return <div className="revenue-bi-section-heading"><h2>{title}</h2></div>
}

function StateBanner({ message, tone }) {
  return (
    <div className={`revenue-bi-state-banner ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <AlertCircle size={18} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="revenue-bi-skeleton" aria-label="Loading dashboard data" role="status">
      <div className="revenue-bi-skeleton-row">
        {[1, 2, 3, 4].map((item) => <span key={item} />)}
      </div>
      <div className="revenue-bi-skeleton-charts"><span /><span /></div>
      <em>Loading generated revenue data...</em>
    </div>
  )
}

function MetricCard({ detail, icon: Icon, label, percent, status, tone, value }) {
  const barValue = tone === 'warning' ? Math.abs(percent) : percent
  return (
    <article className={`revenue-bi-metric ${tone}`}>
      <div className="revenue-bi-metric-top">
        <span className="revenue-bi-metric-icon"><Icon size={17} aria-hidden="true" /></span>
        {status && <StatusChip tone={tone}>{status}</StatusChip>}
      </div>
      <span className="revenue-bi-metric-label">{label}</span>
      <strong>{value || 'Not available'}</strong>
      <small>{detail || 'Generated data is unavailable.'}</small>
      <div className="revenue-bi-mini-progress" aria-label={label + ' progress'} role="img">
        <span style={{ '--metric-width': clamp(Math.abs(barValue)) + '%' }} />
      </div>
    </article>
  )
}

function AnalyticsCard({ children, subtitle, title }) {
  return (
    <article className="revenue-bi-card revenue-bi-chart-card">
      <CardHeader subtitle={subtitle} title={title} />
      {children}
    </article>
  )
}

function CardHeader({ action, subtitle, title }) {
  return (
    <div className="revenue-bi-card-header">
      <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
      {action}
    </div>
  )
}

function ComparisonChart({ ariaLabel, values }) {
  const maxValue = Math.max(...values.map((item) => Number(item.value || 0)), 1)
  return (
    <div className="revenue-bi-comparison" aria-label={ariaLabel} role="img">
      <div className="revenue-bi-chart-gridlines" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="revenue-bi-chart-bars">
        {values.map((item) => {
          const height = Math.max(4, (Number(item.value || 0) / maxValue) * 100)
          return (
            <div className="revenue-bi-chart-column" key={item.label}>
              <span className={`revenue-bi-chart-value ${item.tone}`}>{compactMoney(item.value)}</span>
              <div className={`revenue-bi-bar ${item.tone}`} style={{ '--bar-height': height + '%' }} title={formatMoney(item.value)} />
              <strong>{item.label}</strong>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return <div className="revenue-bi-empty"><ListChecks size={20} aria-hidden="true" /><span>{message}</span></div>
}

function RevenueSourceTable({ available, rows }) {
  return (
    <article className="revenue-bi-card revenue-bi-source-card">
      <CardHeader subtitle="Generated collection performance against configured income targets" title="Revenue sources" />
      {!available || !rows.length ? <EmptyState message="No source-group records are available." /> : (
        <div className="revenue-bi-table-scroll">
          <div className="revenue-bi-source-table" role="table" aria-label="Revenue source performance">
            <div className="revenue-bi-source-head" role="row">
              <span role="columnheader">Source group</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Actual</span>
              <span role="columnheader">Target</span>
              <span role="columnheader">Achievement</span>
              <span role="columnheader">Variance</span>
              <span role="columnheader">Trend</span>
            </div>
            {rows.map((row) => {
              const status = statusForRate(row.rate, row.target)
              return (
                <div className="revenue-bi-source-row" key={row.key} role="row">
                  <strong role="cell">{row.label}</strong>
                  <span role="cell"><StatusChip tone={status.tone}>{status.label}</StatusChip></span>
                  <span role="cell">{formatMoney(row.actual)}</span>
                  <span role="cell">{formatMoney(row.target)}</span>
                  <span role="cell">{formatPercent(row.rate)}%</span>
                  <span className={row.variance >= 0 ? 'positive' : 'negative'} role="cell">{formatMoney(row.variance)}</span>
                  <span role="cell"><ProgressLine percent={row.rate} tone={status.tone} /></span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </article>
  )
}

function StatusChip({ children, tone = 'neutral' }) {
  return <span className={`revenue-bi-chip ${tone}`}>{children}</span>
}

function ProgressLine({ percent, tone = 'blue' }) {
  return <span className={`revenue-bi-progress ${tone}`}><i style={{ '--progress-width': clamp(percent) + '%' }} /></span>
}

function CollectionMixCard({ rows, total }) {
  const mixTotal = rows.reduce((sum, row) => sum + Number(row.value || 0), 0)
  let cursor = 0
  const gradient = mixTotal > 0
    ? rows.filter((row) => row.value > 0).map((row) => {
      const start = cursor
      cursor += (Number(row.value) / mixTotal) * 100
      return row.color + ' ' + start + '% ' + cursor + '%'
    }).join(', ')
    : '#263244 0% 100%'

  return (
    <article className="revenue-bi-card revenue-bi-mix-card">
      <CardHeader subtitle="YTD distribution from Report 21" title="Collection mix" />
      {mixTotal <= 0 ? <EmptyState message="No collection-share data is available." /> : (
        <>
          <div className="revenue-bi-donut" style={{ background: `conic-gradient(${gradient})` }}>
            <div><strong>{compactMoney(total)}</strong><span>Total</span></div>
          </div>
          <div className="revenue-bi-mix-list">
            {rows.map((row) => {
              const percent = mixTotal > 0 ? (Number(row.value || 0) / mixTotal) * 100 : 0
              return (
                <div key={row.label} title={row.label + ': ' + formatMoney(row.value)}>
                  <i style={{ background: row.color }} />
                  <span>{row.label}</span>
                  <em>{formatPercent(percent)}%</em>
                  <strong>{compactMoney(row.value)}</strong>
                </div>
              )
            })}
          </div>
        </>
      )}
    </article>
  )
}

function ReconciliationCard({ onReview, reconciliation }) {
  const hasData = reconciliation.overall_total_collection !== undefined
  const isMatched = Boolean(reconciliation.is_matched)
  return (
    <article className={`revenue-bi-card revenue-bi-reconciliation ${isMatched ? 'good' : 'warning'}`}>
      <CardHeader
        action={<StatusChip tone={hasData ? (isMatched ? 'good' : 'warning') : 'neutral'}>{hasData ? (isMatched ? 'Matched' : 'Review') : 'No data'}</StatusChip>}
        title="Reconciliation"
      />
      {!hasData ? <EmptyState message="No reconciliation data is available." /> : (
        <>
          <p>{reconciliationMessage(reconciliation)}</p>
          <dl>
            <div><dt>Overall paid</dt><dd>{formatMoney(reconciliation.overall_total_collection || 0)}</dd></div>
            <div><dt>Collector total</dt><dd>{formatMoney(reconciliation.collector_summary_total || 0)}</dd></div>
            <div><dt>Difference</dt><dd>{formatMoney(reconciliation.difference || 0)}</dd></div>
          </dl>
          <button disabled={!onReview} onClick={onReview || undefined} title={onReview ? 'Open ACO reconciliation' : 'Your role cannot open ACO reconciliation'} type="button"><ListChecks size={15} aria-hidden="true" /> Review discrepancy</button>
        </>
      )}
    </article>
  )
}

function CurrentMonthCard({ available, model, monthName }) {
  const remaining = Math.max(0, model.monthlyTarget - model.monthTotal)
  return (
    <article className="revenue-bi-card revenue-bi-current-month">
      <CardHeader subtitle="Performance against monthly target pace" title={monthName + ' collections'} />
      {!available ? <EmptyState message="No current-month collection data is available." /> : <>
      <strong>{formatMoney(model.monthTotal)}</strong>
      <div className="revenue-bi-current-grid">
        <span>Target pace <b>{formatMoney(model.monthlyTarget)}</b></span>
        <span>Achievement <b>{formatPercent(model.monthRate)}%</b></span>
        <span>Remaining <b>{formatMoney(remaining)}</b></span>
      </div>
      <ProgressLine percent={model.monthRate} tone={model.monthRate >= 100 ? 'good' : 'blue'} />
      </>}
    </article>
  )
}

function DiveTicketCard({ available, summary, topBuyer }) {
  const receipts = Number(summary.receipt_count || 0)
  const total = Number(summary.total_amount || 0)
  const average = receipts > 0 ? total / receipts : 0
  return (
    <article className="revenue-bi-card revenue-bi-dive-card">
      <CardHeader subtitle="Current-month operating summary" title="Dive tickets" />
      {!available ? <EmptyState message="No dive-ticket data is available." /> : <>
      <div className="revenue-bi-dive-grid">
        <span>Total <b>{formatMoney(total)}</b></span>
        <span>Receipts <b>{receipts.toLocaleString('en-PH')}</b></span>
        <span>Buyers <b>{Number(summary.buyer_count || 0).toLocaleString('en-PH')}</b></span>
        <span>Average <b>{formatMoney(average)}</b></span>
      </div>
      <div className="revenue-bi-top-buyer"><span>Top buyer</span><strong>{topBuyer?.taxpayer || 'Not available'}</strong></div>
      </>}
    </article>
  )
}

function TopCollectors({ rows, total }) {
  return (
    <article className="revenue-bi-card">
      <CardHeader
        action={<button className="revenue-bi-text-action" onClick={() => navigateTo('/reports')} type="button">View collector report</button>}
        subtitle="Top five generated collector totals"
        title="Top collectors"
      />
      {!rows.length ? <EmptyState message="No collector totals are available." /> : (
        <div className="revenue-bi-collector-list">
          {rows.map((row, index) => {
            const amount = Number(row.total_amount || 0)
            const share = total > 0 ? (amount / total) * 100 : 0
            return (
              <div className="revenue-bi-collector-row" key={(row.collector || 'collector') + index}>
                <span className="revenue-bi-rank">{index + 1}</span>
                <span className="revenue-bi-avatar" aria-hidden="true">{initialsFromName(row.collector)}</span>
                <div>
                  <strong>{row.collector || 'Unspecified'}</strong>
                  <small>{Number(row.receipt_count || 0).toLocaleString('en-PH')} receipts | {formatPercent(share)}% share</small>
                  <ProgressLine percent={share} tone="blue" />
                </div>
                <em>{formatMoney(amount)}</em>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}

function RecentReceipts({ rows }) {
  return (
    <article className="revenue-bi-card">
      <CardHeader
        action={<button className="revenue-bi-text-action" onClick={() => navigateTo('/search-receipt')} type="button">View all transactions</button>}
        subtitle="Five latest paid receipt logs"
        title="Recent paid receipts"
      />
      {!rows.length ? <EmptyState message="No recent paid receipts are available." /> : (
        <div className="revenue-bi-receipts-scroll">
          <div className="revenue-bi-receipts" role="table" aria-label="Recent paid receipts">
            <div role="row"><span>Payor</span><span>OR number</span><span>Date</span><span>Collector</span><span>Amount</span></div>
            {rows.map((row) => (
              <div key={(row.payment_id || '') + '-' + (row.receipt_no || '')} role="row">
                <strong role="cell" title={row.taxpayer || 'Unspecified'}>{row.taxpayer || 'Unspecified'}</strong>
                <span role="cell">{row.receipt_no || '-'}</span>
                <span role="cell">{row.collection_date || '-'}</span>
                <span role="cell" title={row.collector || 'Unassigned'}>{row.collector || 'Unassigned'}</span>
                <em role="cell">{formatMoney(row.total_amount || 0)}</em>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
