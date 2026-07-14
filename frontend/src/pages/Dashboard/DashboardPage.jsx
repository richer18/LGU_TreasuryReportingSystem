import { useEffect, useMemo, useState } from 'react'
import { Paper } from '@mui/material'
import {
  AlertCircle,
  CalendarDays,
  Landmark,
  ListChecks,
  RefreshCcw,
  Target,
  TrendingUp,
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
    fullYearTo: toLocalDate(yearEnd),
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
  return (rows || []).reduce((total, row) => {
    if (lookup.has(normalizeName(row.source))) {
      return total + Number(row.total_collections || 0)
    }
    return total
  }, 0)
}

const rptSharingMunicipalShareAmount = (payload) => {
  const rows = payload?.rows || []
  const grandTotal = rows.find((row) => row.grand_total)

  if (grandTotal) {
    return Number(grandTotal.municipal_share_40 || 0)
  }

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

const dashboardColors = ['#2563eb', '#60a5fa', '#22c55e', '#f59e0b', '#f97316', '#94a3b8']

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
      'Mayor\'s Permit',
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
    label: 'Receipt from Economic Enterprise',
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
  if (Number(target || 0) <= 0) return { label: 'Unavailable', tone: 'neutral' }
  if (rate >= 100) return { label: 'On track', tone: 'good' }
  if (rate >= 70) return { label: 'Keep an eye on this', tone: 'warning' }
  return { label: 'Needs attention', tone: 'critical' }
}

const normalizeRoleLabel = (role) =>
  String(role || 'Treasury user')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const initialsFromName = (name) => {
  const parts = String(name || 'U')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) return 'U'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

const reconciliationMessage = (reconciliation = {}) => {
  const difference = Number(reconciliation.difference || 0)
  const absolute = formatMoney(Math.abs(difference))

  if (Math.abs(difference) <= 0.01) {
    return 'Collector totals match the overall paid collections.'
  }

  if (difference > 0) {
    return `Collector totals are ${absolute} lower than overall paid collections.`
  }

  return `Collector totals are ${absolute} higher than overall paid collections.`
}

export function DashboardPage({ user, connectionClass, connectionLabel }) {
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
        params: {
          year: targetYear,
          month: nextPeriod.month,
        },
      })

      setCacheMeta(response.data)

      if (!response.data.success) {
        setDashboardData(emptyDashboardData)
        setError(response.data.message || 'Dashboard cache not found. Please refresh dashboard data first.')
        return
      }

      setDashboardData(mapDashboardCachePayload(response.data.payload))
    } catch (requestError) {
      setDashboardData(emptyDashboardData)
      setCacheMeta(null)
      setError(getDashboardError(requestError, 'Unable to load collection target dashboard.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    loadDashboard(year).finally(() => {
      if (!isActive) return
    })

    return () => {
      isActive = false
    }
  }, [year])

  const handleYearChange = (event) => {
    setLoading(true)
    setError('')
    setYear(event.target.value)
  }

  const refreshDashboardData = async () => {
    const nextPeriod = getPeriod(year)
    setRefreshing(true)
    setError('')

    try {
      await axiosInstance.post('/dashboard/summary/refresh', null, {
        params: {
          year,
          month: nextPeriod.month,
        },
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
    const grandTarget = Number(summary.grand_total || 0)
    const targetToDate = localTarget * period.elapsedRatio
    const monthlyTarget = localTarget / 12
    const annualRate = localTarget > 0 ? (ytdTotal / localTarget) * 100 : 0
    const expectedRate = period.elapsedRatio * 100
    const ytdPaceRate = targetToDate > 0 ? (ytdTotal / targetToDate) * 100 : 0
    const monthRate = monthlyTarget > 0 ? (monthTotal / monthlyTarget) * 100 : 0
    const remaining = Math.max(0, localTarget - ytdTotal)
    const varianceToDate = ytdTotal - targetToDate

    return {
      annualRate,
      expectedRate,
      grandTarget,
      localTarget,
      monthRate,
      monthTotal,
      monthlyTarget,
      remaining,
      targetToDate,
      varianceToDate,
      ytdPaceRate,
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
      return {
        ...item,
        actual,
        rate,
        target,
        variance: actual - target,
      }
    })
  }, [dashboardData])

  const allCollectorRows = useMemo(() => dashboardData.collectors || [], [dashboardData.collectors])
  const collectorTotal = useMemo(
    () => allCollectorRows.reduce((total, row) => total + Number(row.total_amount || 0), 0),
    [allCollectorRows],
  )
  const topCollectorRows = useMemo(() => allCollectorRows.slice(0, 5), [allCollectorRows])
  const collectorReconciliation = dashboardData.collectorsReconciliation || {}

  const diveTickets = dashboardData.diveTickets || {}
  const topDiveBuyers = useMemo(
    () => dashboardData.diveTicketsYear?.top_buyers || [],
    [dashboardData.diveTicketsYear],
  )
  const topDiveBuyer = topDiveBuyers[0] || null

  const collectionShareRows = useMemo(() => {
    const ytdRow = collectionModel.ytdRow
    return [
      { label: 'Municipal GF', value: Number(ytdRow.municipal_general_fund || 0), color: dashboardColors[0] },
      { label: 'Municipal SEF', value: Number(ytdRow.municipal_sef || 0), color: dashboardColors[1] },
      { label: 'Municipal TF', value: Number(ytdRow.municipal_trust_fund || 0), color: dashboardColors[2] },
      { label: 'Provincial', value: Number(ytdRow.provincial_total || 0), color: dashboardColors[3] },
      { label: 'National', value: Number(ytdRow.national || 0), color: dashboardColors[4] },
      {
        label: 'Barangay/Fisheries',
        value: Number(ytdRow.barangay_share || 0) + Number(ytdRow.fisheries || 0),
        color: dashboardColors[5],
      },
    ]
  }, [collectionModel.ytdRow])

  const recentPaymentLogs = useMemo(
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

  const paceStatus = collectionModel.varianceToDate > 0
    ? 'On track'
    : collectionModel.varianceToDate < 0
      ? 'Needs attention'
      : 'On pace'
  const paceTone = collectionModel.varianceToDate >= 0 ? 'good' : 'warning'
  const paceMessage = collectionModel.varianceToDate > 0
    ? `You're ahead of the expected pace by ${formatMoney(collectionModel.varianceToDate)}.`
    : collectionModel.varianceToDate < 0
      ? `You're behind the expected pace by ${formatMoney(Math.abs(collectionModel.varianceToDate))}.`
      : 'Collections are exactly on the expected pace.'
  const userRoleLabel = normalizeRoleLabel(user?.role)
  const userName = user?.name || 'Treasury user'
  const dashboardViewModel = useMemo(() => ({
    summary: collectionModel,
    collectionShare: collectionShareRows,
    collectors: {
      all: allCollectorRows,
      topFive: topCollectorRows,
      total: collectorTotal,
    },
    sourceGroups: categoryRows,
    reconciliation: collectorReconciliation,
    diveTickets: {
      currentMonth: diveTickets,
      topBuyer: topDiveBuyer,
      topBuyers: topDiveBuyers,
    },
    recentReceipts: recentPaymentLogs,
    currentMonth: {
      name: period.monthName,
      total: collectionModel.monthTotal,
      target: collectionModel.monthlyTarget,
      rate: collectionModel.monthRate,
    },
    metadata: cacheMeta,
  }), [
    allCollectorRows,
    cacheMeta,
    categoryRows,
    collectionModel,
    collectionShareRows,
    collectorReconciliation,
    collectorTotal,
    diveTickets,
    period.monthName,
    recentPaymentLogs,
    topCollectorRows,
    topDiveBuyer,
    topDiveBuyers,
  ])

  return (
    <div className="page-stack dashboard-decision-page">
      <section className="dashboard-hero dashboard-hero-compact dashboard-welcome-header">
        <div className="dashboard-hero-main">
          <p className="eyebrow">Municipality of Zamboanguita</p>
          <h2>Revenue Collection Dashboard</h2>
          <span>Here's how collections are performing for the selected year.</span>
          <div className="dashboard-user-meta">
            <span>{userName}</span>
            <span>{userRoleLabel}</span>
          </div>
        </div>
        <div className="dashboard-year-actions dashboard-toolbar-actions">
          <label className="treasury-field dashboard-year-field">
            <span><CalendarDays size={14} aria-hidden="true" /> Year</span>
            <input
              aria-label="Dashboard year"
              max="2100"
              min="2000"
              onChange={handleYearChange}
              type="number"
              value={year}
            />
          </label>
          {cacheMeta?.generated_at && (
            <span className="dashboard-cache-updated">Updated {cacheMeta.generated_at}</span>
          )}
          <span className={`dashboard-connection-pill ${connectionClass || (cacheMeta?.success ? 'is-good' : 'is-warning')}`}>
            {connectionLabel || (cacheMeta?.success ? 'Cache ready' : 'Needs refresh')}
          </span>
          <button
            aria-label="Refresh dashboard data"
            className="primary-button dashboard-refresh-button"
            disabled={loading || refreshing}
            onClick={refreshDashboardData}
            type="button"
          >
            <RefreshCcw size={16} aria-hidden="true" />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </section>

      {error && (
        <section className="inline-alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          {error}
        </section>
      )}

      {loading && !error && (
        <section className="inline-alert is-info" role="status">
          <RefreshCcw size={18} aria-hidden="true" />
          Loading dashboard data...
        </section>
      )}

      <section className="dashboard-summary-grid" aria-label="Executive collection metrics">
        <CollectionProgressCard
          achievement={dashboardViewModel.summary.annualRate}
          collected={dashboardViewModel.summary.ytdTotal}
          helper={`Annual local target: ${formatMoney(dashboardViewModel.summary.localTarget)}`}
          status={paceStatus}
          statusMessage={paceMessage}
          tone={paceTone}
        />
        <div className="dashboard-support-card-grid">
          <ExecutiveKpi icon={Target} label="Annual target" value={formatMoney(dashboardViewModel.summary.localTarget)} helper="Approved local sources target" />
          <ExecutiveKpi icon={CalendarDays} label="Expected to date" value={formatMoney(dashboardViewModel.summary.targetToDate)} helper={`${formatPercent(dashboardViewModel.summary.expectedRate)}% of year elapsed`} />
          <ExecutiveKpi icon={Landmark} label="Remaining to target" value={formatMoney(dashboardViewModel.summary.remaining)} helper="Balance to reach local target" />
        </div>
      </section>

      <section className="dashboard-analysis-grid" aria-label="Primary dashboard analysis">
        <Paper className="dashboard-table-card dashboard-source-card" elevation={0} variant="outlined">
          <ChartHeader
            title="Source Group Performance"
            subtitle="Report 21 paid collections, Report 27 RPT municipal share, and income target rows."
          />
          <SourcePerformanceTable rows={dashboardViewModel.sourceGroups} />
        </Paper>

        <div className="dashboard-side-stack">
          <Paper className="dashboard-chart-card dashboard-share-card" elevation={0} variant="outlined">
            <ChartHeader title="Collection share" subtitle="YTD distribution from Report 21" />
            <DonutChart centerLabel={formatMoney(dashboardViewModel.summary.ytdTotal)} rows={dashboardViewModel.collectionShare} />
          </Paper>

          <ReconciliationAlert reconciliation={dashboardViewModel.reconciliation} />

          <Paper className="dashboard-compact-card" elevation={0} variant="outlined">
            <p className="label">{dashboardViewModel.currentMonth.name} collections</p>
            <strong>{formatMoney(dashboardViewModel.currentMonth.total)}</strong>
            <span>{formatPercent(dashboardViewModel.currentMonth.rate)}% of monthly target pace</span>
          </Paper>
        </div>
      </section>

      <section className="dashboard-performance-grid" aria-label="Collector and operational summaries">
        <TopCollectors rows={dashboardViewModel.collectors.topFive} allRows={dashboardViewModel.collectors.all} total={dashboardViewModel.collectors.total} />
        <DiveTicketsSummary period={period} summary={dashboardViewModel.diveTickets.currentMonth} topBuyer={dashboardViewModel.diveTickets.topBuyer} topBuyers={dashboardViewModel.diveTickets.topBuyers} />
      </section>

      <section className="dashboard-operations-grid" aria-label="Recent activity and notes">
        <RecentReceipts rows={dashboardViewModel.recentReceipts} />
        <Paper className="dashboard-method-card" elevation={0} variant="outlined">
          <ChartHeader title="Methodology Note" subtitle="Source of displayed values" />
          <div className="dashboard-note-list">
            <span>Collection totals use the existing dashboard summary cache.</span>
            <span>Report 21 is paid collections only.</span>
            <span>RPT local GF uses Report 27 municipal share where generated.</span>
            <span>LGU Grand Income Target is kept separate from Local Sources Annual Target.</span>
          </div>
        </Paper>
      </section>
    </div>
  )
}

function CollectionProgressCard({ achievement, collected, helper, status, statusMessage, tone }) {
  return (
    <Paper className="dashboard-progress-card" elevation={0} variant="outlined">
      <div className="dashboard-progress-card-top">
        <div>
          <span>Collection progress</span>
          <strong>{formatMoney(collected)}</strong>
          <p>{formatPercent(achievement)}% of the annual local target</p>
        </div>
        <StatusPill tone={tone}>{status}</StatusPill>
      </div>
      <ProgressBar label="Annual collection achievement" percent={achievement} tone={tone} />
      <div className={`dashboard-progress-message ${tone}`}>
        <TrendingUp size={18} aria-hidden="true" />
        <span>{statusMessage}</span>
      </div>
      <small>{helper}</small>
    </Paper>
  )
}

function ExecutiveKpi({ icon: Icon, label, value, helper, tone = 'neutral' }) {
  return (
    <Paper className={`dashboard-kpi-card ${tone}`} elevation={0} variant="outlined">
      <div className="dashboard-kpi-icon"><Icon size={18} aria-hidden="true" /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </Paper>
  )
}

function ChartHeader({ title, subtitle }) {
  return (
    <div className="dashboard-chart-header">
      <div>
        <h3>{title}</h3>
        <span>{subtitle}</span>
      </div>
    </div>
  )
}

function ProgressBar({ percent, color, label, tone = 'neutral' }) {
  return (
    <div className={`dashboard-progress ${tone}`} aria-label={label} role="img" title={`${formatPercent(percent)}%`}>
      <span style={{ '--progress-width': `${clamp(percent)}%`, '--progress-color': color || undefined }} />
    </div>
  )
}

function SourcePerformanceTable({ rows }) {
  if (!rows.length) {
    return <div className="empty-row">No source-group data for the selected period.</div>
  }

  return (
    <div className="dashboard-source-table" role="table" aria-label="Source group performance">
      <div className="dashboard-source-head" role="row">
        <span role="columnheader">Source group</span>
        <span role="columnheader">Actual</span>
        <span role="columnheader">Target</span>
        <span role="columnheader">Achievement</span>
        <span role="columnheader">Variance</span>
        <span role="columnheader">Progress</span>
        <span role="columnheader">Status</span>
      </div>
      {rows.map((row, index) => {
        const status = statusForRate(row.rate, row.target)
        return (
          <div className={`dashboard-source-row ${status.tone}`} key={row.key} role="row">
            <strong role="cell">{row.label}</strong>
            <span role="cell">{formatMoney(row.actual)}</span>
            <span role="cell">{formatMoney(row.target)}</span>
            <span role="cell">{formatPercent(row.rate)}%</span>
            <span className={row.variance >= 0 ? 'is-positive' : 'is-negative'} role="cell">{formatMoney(row.variance)}</span>
            <span role="cell"><ProgressBar label={`${row.label} progress`} percent={row.rate} tone={status.tone} /></span>
            <span role="cell"><StatusPill tone={status.tone}>{status.label}</StatusPill></span>
          </div>
        )
      })}
    </div>
  )
}

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`dashboard-status-pill ${tone}`}>{children}</span>
}

function ReconciliationAlert({ reconciliation }) {
  const hasData = reconciliation.overall_total_collection !== undefined
  const isMatched = Boolean(reconciliation.is_matched)
  const tone = isMatched ? 'good' : 'warning'

  return (
    <Paper className={`dashboard-reconciliation-alert ${tone}`} elevation={0} variant="outlined">
      <div className="dashboard-alert-heading">
        <AlertCircle size={18} aria-hidden="true" />
        <div>
          <h3>Reconciliation</h3>
          <span>{hasData ? reconciliationMessage(reconciliation) : 'No reconciliation data loaded.'}</span>
        </div>
      </div>
      {hasData ? (
        <>
          <dl>
            <div><dt>Overall collections</dt><dd>{formatMoney(reconciliation.overall_total_collection || 0)}</dd></div>
            <div><dt>Collector total</dt><dd>{formatMoney(reconciliation.collector_summary_total || 0)}</dd></div>
            <div><dt>Difference</dt><dd>{formatMoney(reconciliation.difference || 0)}</dd></div>
            <div><dt>Status</dt><dd>{isMatched ? 'Matched' : 'Needs review'}</dd></div>
          </dl>
          <button className="dashboard-link-button" type="button">
            <ListChecks size={16} aria-hidden="true" />
            Review reconciliation
          </button>
        </>
      ) : (
        <p>No reconciliation values are available for this dashboard cache.</p>
      )}
    </Paper>
  )
}

function TopCollectors({ rows, allRows, total }) {
  return (
    <Paper className="dashboard-table-card" elevation={0} variant="outlined">
      <ChartHeader title="Top collectors" subtitle="Top 5 only; complete generated list is expandable below." />
      <div className="dashboard-rank-list">
        {rows.map((row, index) => {
          const value = Number(row.total_amount || 0)
          const share = total > 0 ? (value / total) * 100 : 0
          return (
            <div className="dashboard-rank-row" key={`${row.collector}-${index}`}>
              <div className="dashboard-rank-avatar" aria-hidden="true">{initialsFromName(row.collector)}</div>
              <div>
                <strong>{index + 1}. {row.collector || 'Unspecified'}</strong>
                <span>{Number(row.receipt_count || 0).toLocaleString('en-PH')} receipts - {formatPercent(share)}% share</span>
              </div>
              <em>{formatMoney(value)}</em>
              <ProgressBar label={`${row.collector || 'Collector'} share`} percent={share} tone="blue" />
            </div>
          )
        })}
        {!rows.length && <div className="empty-row">No collector totals for the selected period.</div>}
      </div>
      {allRows.length > rows.length && (
        <details className="dashboard-expander">
          <summary>View all collectors</summary>
          <div className="dashboard-detail-list">
            {allRows.map((row, index) => (
              <div key={`${row.collector}-${index}`}>
                <span>{row.collector || 'Unspecified'}</span>
                <strong>{formatMoney(row.total_amount || 0)}</strong>
                <em>{Number(row.receipt_count || 0)} receipts</em>
              </div>
            ))}
          </div>
        </details>
      )}
    </Paper>
  )
}

function DiveTicketsSummary({ period, summary, topBuyer, topBuyers }) {
  const receiptCount = Number(summary.receipt_count || 0)
  const totalAmount = Number(summary.total_amount || 0)
  const averageTicketValue = receiptCount > 0 ? totalAmount / receiptCount : 0

  return (
    <Paper className="dashboard-table-card" elevation={0} variant="outlined">
      <ChartHeader title="Dive Tickets" subtitle={`${period.monthName} summary and top annual buyer`} />
      <div className="dashboard-ticket-summary">
        <div>
          <span>Current-month total</span>
          <strong>{formatMoney(totalAmount)}</strong>
        </div>
        <div>
          <span>Receipts</span>
          <strong>{receiptCount.toLocaleString('en-PH')}</strong>
        </div>
        <div>
          <span>Buyers</span>
          <strong>{Number(summary.buyer_count || 0)}</strong>
        </div>
        <div>
          <span>Top buyer</span>
          <strong>{topBuyer?.taxpayer || 'No buyer yet'}</strong>
          <small>{topBuyer ? `${formatMoney(topBuyer.total_amount)} | ${topBuyer.receipt_count} receipts` : period.selectedYear}</small>
        </div>
        <div>
          <span>Average ticket value</span>
          <strong>{receiptCount > 0 ? formatMoney(averageTicketValue) : formatMoney(0)}</strong>
          <small>Derived from total divided by receipt count</small>
        </div>
      </div>
      {topBuyers.length > 0 && (
        <details className="dashboard-expander">
          <summary>View dive-ticket details</summary>
          <div className="dashboard-detail-list">
            {topBuyers.map((buyer, index) => (
              <div key={`${buyer.taxpayer}-${index}`}>
                <span>{buyer.taxpayer || 'Unspecified'}</span>
                <strong>{formatMoney(buyer.total_amount || 0)}</strong>
                <em>{Number(buyer.receipt_count || 0)} receipts</em>
              </div>
            ))}
          </div>
        </details>
      )}
    </Paper>
  )
}

function RecentReceipts({ rows }) {
  return (
    <Paper className="dashboard-table-card" elevation={0} variant="outlined">
      <ChartHeader title="Recent Paid Receipts" subtitle="Five latest paid receipt logs from the generated cache." />
      <div className="payment-log-list dashboard-payment-list">
        {rows.map((row) => (
          <div className="payment-log-row" key={`${row.payment_id}-${row.receipt_no}`}>
            <div>
              <strong>{row.taxpayer || 'UNSPECIFIED'}</strong>
              <span>OR {row.receipt_no || '-'} | {row.collection_date || '-'} | {row.collector || 'Unassigned'}</span>
            </div>
            <em>{formatMoney(row.total_amount || 0)}</em>
          </div>
        ))}
        {!rows.length && (
          <div className="payment-log-empty">
            <ListChecks size={18} aria-hidden="true" />
            <span>No recent paid receipt logs for the selected year.</span>
          </div>
        )}
      </div>
      <details className="dashboard-expander dashboard-action-expander">
        <summary>View all activity</summary>
        <p>Open the existing General Fund, Reports, or Search Receipt page for the full receipt history.</p>
      </details>
    </Paper>
  )
}

function DonutChart({ centerLabel, rows }) {
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0)
  let cursor = 0
  const gradient = total > 0
    ? rows
      .filter((row) => Number(row.value || 0) > 0)
      .map((row) => {
        const start = cursor
        const width = (Number(row.value || 0) / total) * 100
        cursor += width
        return `${row.color} ${start}% ${cursor}%`
      })
      .join(', ')
    : '#e4eaf0 0% 100%'

  return (
    <div className="donut-chart-layout dashboard-share-layout">
      <div className="donut-chart" style={{ '--donut-delay': '120ms', background: `conic-gradient(${gradient})` }}>
        <div>
          <strong title={centerLabel}>{centerLabel}</strong>
          <span>Total</span>
        </div>
      </div>
      <div className="chart-legend">
        {rows.map((row, index) => {
          const percent = total > 0 ? (Number(row.value || 0) / total) * 100 : 0
          return (
            <div key={row.label} style={{ '--legend-delay': `${180 + index * 60}ms` }}>
              <i style={{ backgroundColor: row.color }} />
              <span>{row.label}</span>
              <em>{formatPercent(percent)}%</em>
              <strong>{formatMoney(row.value)}</strong>
            </div>
          )
        })}
      </div>
    </div>
  )
}




