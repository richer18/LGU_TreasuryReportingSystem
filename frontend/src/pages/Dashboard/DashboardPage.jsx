import { useEffect, useMemo, useState } from 'react'
import {
  Chip,
  LinearProgress,
  Paper,
} from '@mui/material'
import {
  AlertCircle,
  CalendarDays,
  Gauge,
  Landmark,
  ReceiptText,
  RefreshCcw,
  Target,
  TrendingUp,
  Users,
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

const formatPercent = (value) =>
  new Intl.NumberFormat('en-PH', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(Number(value || 0))

const formatCompactMoney = (value) => {
  const amount = Number(value || 0)
  const absolute = Math.abs(amount)

  if (absolute >= 1_000_000) {
    return `₱${(amount / 1_000_000).toLocaleString('en-PH', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}M`
  }

  if (absolute >= 1_000) {
    return `₱${(amount / 1_000).toLocaleString('en-PH', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    })}K`
  }

  return formatMoney(amount)
}

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value || 0)))

const dashboardColors = ['#0f766e', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#475467']

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

export function DashboardPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [dashboardData, setDashboardData] = useState({
    collectors: null,
    diveTickets: null,
    diveTicketsYear: null,
    incomeTarget: null,
    monthCollections: null,
    rptSharing: null,
    ytdCollections: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const period = useMemo(() => getPeriod(year), [year])

  const loadDashboard = async (targetYear = year) => {
    const nextPeriod = getPeriod(targetYear)
    setLoading(true)
    setError('')

    try {
      const [incomeTarget, ytdCollections, monthCollections, rptSharing, collectors, diveTickets, diveTicketsYear] = await Promise.all([
        axiosInstance.get('/income-target', { params: { year: targetYear } }),
        axiosInstance.get('/generated-reports/21/preview', {
          params: {
            date_from: nextPeriod.ytdFrom,
            date_to: nextPeriod.dateTo,
          },
        }),
        axiosInstance.get('/generated-reports/21/preview', {
          params: {
            date_from: nextPeriod.monthFrom,
            date_to: nextPeriod.dateTo,
          },
        }),
        axiosInstance.get('/generated-reports/27/preview', {
          params: {
            date_from: nextPeriod.ytdFrom,
            date_to: nextPeriod.dateTo,
          },
        }),
        axiosInstance.get('/general-fund/collectors', {
          params: {
            date_from: nextPeriod.ytdFrom,
            date_to: nextPeriod.dateTo,
            limit: 1000,
          },
        }),
        axiosInstance.get('/general-fund/dive-tickets', {
          params: {
            date_from: nextPeriod.monthFrom,
            date_to: nextPeriod.dateTo,
            limit: 100,
          },
        }),
        axiosInstance.get('/general-fund/dive-tickets', {
          params: {
            date_from: nextPeriod.ytdFrom,
            date_to: nextPeriod.fullYearTo,
            limit: 100,
          },
        }),
      ])

      setDashboardData({
        collectors: collectors.data.data,
        diveTickets: diveTickets.data.data,
        diveTicketsYear: diveTicketsYear.data.data,
        incomeTarget: incomeTarget.data.data,
        monthCollections: monthCollections.data,
        rptSharing: rptSharing.data,
        ytdCollections: ytdCollections.data,
      })
    } catch (requestError) {
      setDashboardData({
        collectors: null,
        diveTickets: null,
        diveTicketsYear: null,
        incomeTarget: null,
        monthCollections: null,
        rptSharing: null,
        ytdCollections: null,
      })
      setError(getDashboardError(requestError, 'Unable to load collection target dashboard.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true
    const targetYear = year
    const nextPeriod = getPeriod(targetYear)

    Promise.all([
      axiosInstance.get('/income-target', { params: { year: targetYear } }),
      axiosInstance.get('/generated-reports/21/preview', {
        params: {
          date_from: nextPeriod.ytdFrom,
          date_to: nextPeriod.dateTo,
        },
      }),
      axiosInstance.get('/generated-reports/21/preview', {
        params: {
          date_from: nextPeriod.monthFrom,
          date_to: nextPeriod.dateTo,
        },
      }),
      axiosInstance.get('/generated-reports/27/preview', {
        params: {
          date_from: nextPeriod.ytdFrom,
          date_to: nextPeriod.dateTo,
        },
      }),
      axiosInstance.get('/general-fund/collectors', {
        params: {
          date_from: nextPeriod.ytdFrom,
          date_to: nextPeriod.dateTo,
          limit: 1000,
        },
      }),
      axiosInstance.get('/general-fund/dive-tickets', {
        params: {
          date_from: nextPeriod.monthFrom,
          date_to: nextPeriod.dateTo,
          limit: 100,
        },
      }),
      axiosInstance.get('/general-fund/dive-tickets', {
        params: {
          date_from: nextPeriod.ytdFrom,
          date_to: nextPeriod.fullYearTo,
          limit: 100,
        },
      }),
    ])
      .then(([incomeTarget, ytdCollections, monthCollections, rptSharing, collectors, diveTickets, diveTicketsYear]) => {
        if (!isActive) return
        setDashboardData({
          collectors: collectors.data.data,
          diveTickets: diveTickets.data.data,
          diveTicketsYear: diveTicketsYear.data.data,
          incomeTarget: incomeTarget.data.data,
          monthCollections: monthCollections.data,
          rptSharing: rptSharing.data,
          ytdCollections: ytdCollections.data,
        })
      })
      .catch((requestError) => {
        if (!isActive) return
        setDashboardData({
          collectors: null,
          diveTickets: null,
          diveTicketsYear: null,
          incomeTarget: null,
          monthCollections: null,
          rptSharing: null,
          ytdCollections: null,
        })
        setError(getDashboardError(requestError, 'Unable to load collection target dashboard.'))
      })
      .finally(() => {
        if (!isActive) return
        setLoading(false)
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

  const topCollectors = useMemo(
    () => (dashboardData.collectors || []).slice(0, 6),
    [dashboardData.collectors],
  )

  const diveTickets = dashboardData.diveTickets || {}
  const topDiveBuyers = useMemo(
    () => dashboardData.diveTicketsYear?.top_buyers || [],
    [dashboardData.diveTicketsYear],
  )
  const collectionShareRows = useMemo(() => {
    const ytdRow = collectionModel.ytdRow
    return [
      { label: 'Municipal GF', value: Number(ytdRow.municipal_general_fund || 0), color: dashboardColors[0] },
      { label: 'Municipal SEF', value: Number(ytdRow.municipal_sef || 0), color: dashboardColors[1] },
      { label: 'Provincial', value: Number(ytdRow.provincial_total || 0), color: dashboardColors[2] },
      {
        label: 'Barangay/Fisheries',
        value: Number(ytdRow.barangay_share || 0) + Number(ytdRow.fisheries || 0),
        color: dashboardColors[3],
      },
    ]
  }, [collectionModel.ytdRow])

  const collectorChartRows = useMemo(
    () => topCollectors.map((collector, index) => ({
      color: dashboardColors[index % dashboardColors.length],
      label: collector.collector || 'Unspecified',
      value: Number(collector.total_amount || 0),
    })),
    [topCollectors],
  )

  const diveBuyerChartRows = useMemo(
    () => topDiveBuyers.map((buyer, index) => ({
      color: dashboardColors[index % dashboardColors.length],
      label: buyer.taxpayer || 'Unspecified',
      value: Number(buyer.total_amount || 0),
    })),
    [topDiveBuyers],
  )

  const categoryChartRows = useMemo(
    () => categoryRows.map((row, index) => ({
      color: dashboardColors[index % dashboardColors.length],
      label: row.label,
      percent: row.rate,
      value: row.actual,
    })),
    [categoryRows],
  )

  const paceStatus = collectionModel.varianceToDate >= 0 ? 'On Pace' : 'Behind Target'
  const paceClass = collectionModel.varianceToDate >= 0 ? 'is-good' : 'is-warning'

  return (
    <div className="page-stack">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Collection Target Monitor</p>
          <h2>Collections vs Income Target</h2>
          <span>
            Paid collections from Report 21 compared against Local Sources target for {period.selectedYear}.
          </span>
        </div>
        <div className="dashboard-year-actions">
          <label className="treasury-field">
            <span><CalendarDays size={14} aria-hidden="true" /> Year</span>
            <input
              max="2100"
              min="2000"
              onChange={handleYearChange}
              type="number"
              value={year}
            />
          </label>
          <button className="secondary-button" disabled={loading} onClick={() => loadDashboard()} type="button">
            <RefreshCcw size={16} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </section>

      {error && (
        <section className="inline-alert">
          <AlertCircle size={18} aria-hidden="true" />
          {error}
        </section>
      )}

      <Paper className="target-monitor-panel" elevation={0} variant="outlined">
        <div className="target-monitor-summary">
          <div>
            <p className="label">Local Collection Achievement</p>
            <h3>{formatPercent(collectionModel.annualRate)}%</h3>
            <span>
              {formatMoney(collectionModel.ytdTotal)} collected of {formatMoney(collectionModel.localTarget)}
            </span>
          </div>
          <div className={`target-status-pill ${paceClass}`}>
            <Gauge size={16} aria-hidden="true" />
            {paceStatus}
          </div>
        </div>
        <div className="target-monitor-chart-row">
          <GaugeChart
            label="Annual Target"
            percent={collectionModel.annualRate}
            value={formatMoney(collectionModel.ytdTotal)}
          />
          <div className="target-monitor-progress-stack">
            <ChartMetric label="Expected to date" value={`${formatMoney(collectionModel.targetToDate)} (${formatPercent(collectionModel.expectedRate)}%)`} />
            <ChartMetric label="Variance" value={formatMoney(collectionModel.varianceToDate)} tone={collectionModel.varianceToDate >= 0 ? 'good' : 'warning'} />
            <ChartMetric label="Remaining" value={formatMoney(collectionModel.remaining)} />
          </div>
        </div>
        <div className="target-monitor-detail">
          <span>Expected to date: {formatMoney(collectionModel.targetToDate)} ({formatPercent(collectionModel.expectedRate)}%)</span>
          <span>Variance: {formatMoney(collectionModel.varianceToDate)}</span>
          <span>Remaining: {formatMoney(collectionModel.remaining)}</span>
        </div>
      </Paper>

      <section className="metrics-grid dashboard-target-grid" aria-label="Collection target cards">
        <Metric icon={ReceiptText} label="YTD Paid Collections" value={formatMoney(collectionModel.ytdTotal)} />
        <Metric icon={Target} label="Local Sources Target" value={formatMoney(collectionModel.localTarget)} />
        <Metric icon={TrendingUp} label={`${period.monthName} Collections`} value={formatMoney(collectionModel.monthTotal)} />
        <Metric icon={CalendarDays} label="Monthly Target Pace" value={formatMoney(collectionModel.monthlyTarget)} />
      </section>

      <section className="dashboard-chart-grid" aria-label="Dashboard charts">
        <Paper className="dashboard-chart-card" elevation={0} variant="outlined">
          <ChartHeader title="Collection Share" subtitle="YTD distribution from Report 21" />
          <DonutChart centerLabel={formatCompactMoney(collectionModel.ytdTotal)} rows={collectionShareRows} />
        </Paper>

        <Paper className="dashboard-chart-card" elevation={0} variant="outlined">
          <ChartHeader title="Collector Collection" subtitle="Top collectors by paid amount" />
          <HorizontalBarChart rows={collectorChartRows} />
        </Paper>

        <Paper className="dashboard-chart-card" elevation={0} variant="outlined">
          <ChartHeader title="Dive Ticket Buyers" subtitle={`${period.selectedYear} top 3 buyers`} />
          <HorizontalBarChart rows={diveBuyerChartRows} />
        </Paper>
      </section>

      <Paper className="dashboard-chart-card dashboard-wide-chart" elevation={0} variant="outlined">
        <ChartHeader title="Source Group Target Gauge" subtitle="Actual paid YTD collection vs annual income target" />
        <div className="source-gauge-grid">
          {categoryChartRows.map((row) => (
            <SourceGauge key={row.label} row={row} />
          ))}
        </div>
      </Paper>

      <section className="dashboard-grid">
        <div className="panel">
          <h3>Collector Collection</h3>
          <div className="snapshot-list">
            {topCollectors.map((collector, index) => (
              <Snapshot
                icon={Users}
                key={collector.collector || index}
                label={`${index + 1}. ${collector.collector || 'Unspecified'}`}
                value={`${formatMoney(collector.total_amount)} - ${collector.receipt_count} receipts`}
              />
            ))}
            {!topCollectors.length && (
              <Snapshot icon={Users} label="Collectors" value="No collection data for the selected period." />
            )}
          </div>
        </div>

        <div className="panel">
          <h3>Dive Tickets Monthly Collection</h3>
          <dl>
            <div>
              <dt>{period.monthName} Total</dt>
              <dd>{formatMoney(diveTickets.total_amount || 0)}</dd>
            </div>
            <div>
              <dt>Receipts / Buyers</dt>
              <dd>{Number(diveTickets.receipt_count || 0)} receipts / {Number(diveTickets.buyer_count || 0)} buyers</dd>
            </div>
          </dl>
          <div className="dashboard-mini-list">
            <p className="label">Top 3 Dive Ticket Buyers - Whole Year</p>
            {topDiveBuyers.map((buyer, index) => (
              <div className="dashboard-mini-row" key={`${buyer.taxpayer}-${index}`}>
                <strong>{index + 1}. {buyer.taxpayer}</strong>
                <span>{formatMoney(buyer.total_amount)} - {buyer.receipt_count} receipts</span>
              </div>
            ))}
            {!topDiveBuyers.length && (
              <div className="dashboard-mini-row">
                <strong>No dive tickets found</strong>
                <span>{period.selectedYear}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="panel dashboard-category-panel">
        <div className="panel-title-row">
          <div>
            <h3>Collections vs Income Target by Source Group</h3>
            <span>Paid YTD collections compared with the approved income target.</span>
          </div>
          <div className="target-status-pill is-good">
            <Landmark size={16} aria-hidden="true" />
            Report 21/27 + Income Target
          </div>
        </div>

        <div className="dashboard-category-table">
          <div className="dashboard-category-head">
            <span>Source Group</span>
            <span>Actual</span>
            <span>Target</span>
            <span>Rate</span>
            <span>Variance</span>
          </div>
          {categoryRows.map((row) => (
            <div className="dashboard-category-row" key={row.key}>
              <strong>{row.label}</strong>
              <span>{formatMoney(row.actual)}</span>
              <span>{formatMoney(row.target)}</span>
              <span>{formatPercent(row.rate)}%</span>
              <span className={row.variance >= 0 ? 'is-positive' : 'is-negative'}>{formatMoney(row.variance)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <h3>Target Snapshot</h3>
          <div className="snapshot-list">
            <Snapshot icon={ReceiptText} label="Report Basis" value="Report 21 paid collections only" />
            <Snapshot icon={Target} label="Grand Income Target" value={formatMoney(collectionModel.grandTarget)} />
            <Snapshot icon={Users} label="YTD Pace" value={`${formatPercent(collectionModel.ytdPaceRate)}% of expected local target`} />
          </div>
        </div>

        <div className="panel">
          <h3>Collection Share</h3>
          <dl>
            <div>
              <dt>Municipal General Fund</dt>
              <dd>{formatMoney(collectionModel.ytdRow.municipal_general_fund || 0)}</dd>
            </div>
            <div>
              <dt>Municipal SEF</dt>
              <dd>{formatMoney(collectionModel.ytdRow.municipal_sef || 0)}</dd>
            </div>
            <div>
              <dt>Provincial Share</dt>
              <dd>{formatMoney(collectionModel.ytdRow.provincial_total || 0)}</dd>
            </div>
            <div>
              <dt>Barangay / Fisheries Share</dt>
              <dd>
                {formatMoney(
                  Number(collectionModel.ytdRow.barangay_share || 0) + Number(collectionModel.ytdRow.fisheries || 0),
                )}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  )
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="metric">
      <Icon size={20} aria-hidden="true" />
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Snapshot({ icon: Icon, label, value }) {
  return (
    <div className="snapshot-item">
      <Icon size={18} aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
    </div>
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

function ChartMetric({ label, value, tone = 'neutral' }) {
  return (
    <div className={`chart-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function GaugeChart({ label, percent, value }) {
  const safePercent = clamp(percent)

  return (
    <div className="dashboard-gauge">
      <svg aria-label={`${label} ${formatPercent(safePercent)} percent`} role="img" viewBox="0 0 120 72">
        <path className="dashboard-gauge-track" d="M20 58 A40 40 0 0 1 100 58" pathLength="100" />
        <path
          className="dashboard-gauge-value"
          d="M20 58 A40 40 0 0 1 100 58"
          pathLength="100"
          style={{ strokeDasharray: `${safePercent} 100` }}
        />
      </svg>
      <div className="dashboard-gauge-center">
        <strong>{formatPercent(safePercent)}%</strong>
        <span>{label}</span>
      </div>
      <p>{value}</p>
    </div>
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
    <div className="donut-chart-layout">
      <div className="donut-chart" style={{ background: `conic-gradient(${gradient})` }}>
        <div>
          <strong>{centerLabel}</strong>
          <span>Total</span>
        </div>
      </div>
      <div className="chart-legend">
        {rows.map((row) => {
          const percent = total > 0 ? (Number(row.value || 0) / total) * 100 : 0
          return (
          <div key={row.label}>
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

function HorizontalBarChart({ rows }) {
  const max = Math.max(...rows.map((row) => Number(row.value || 0)), 0)

  if (!rows.length) {
    return <div className="empty-row">No chart data for the selected period.</div>
  }

  return (
    <div className="horizontal-bar-chart">
      {rows.map((row) => {
        const percent = max > 0 ? (Number(row.value || 0) / max) * 100 : 0
        return (
          <div className="horizontal-bar-row" key={row.label}>
            <div>
              <strong>{row.label}</strong>
              <span>{formatMoney(row.value)}</span>
            </div>
            <div className="horizontal-bar-track">
              <span style={{ backgroundColor: row.color, width: `${clamp(percent)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SourceGauge({ row }) {
  const safePercent = clamp(row.percent)
  const tone = row.percent >= 100 ? 'success' : row.percent >= 70 ? 'warning' : 'default'

  return (
    <div className="source-gauge-card">
      <div className="source-gauge-heading">
        <strong>{row.label}</strong>
        <Chip label={`${formatPercent(row.percent)}%`} color={tone} size="small" variant="outlined" />
      </div>
      <LinearProgress
        value={safePercent}
        variant="determinate"
        sx={{
          backgroundColor: '#e4eaf0',
          borderRadius: 999,
          height: 10,
          '& .MuiLinearProgress-bar': {
            backgroundColor: row.color,
            borderRadius: 999,
          },
        }}
      />
      <div className="source-gauge-values">
        <span>{formatMoney(row.value)}</span>
        <span>Target rate</span>
      </div>
    </div>
  )
}
