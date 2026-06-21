import {
  Alert,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material'
import { Download, Eye, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import axiosInstance from '../../../axiosinstance/axiosInstance'
import { formatMoney, formatNumber } from '../utils/generalFundFormat'

const months = [
  { label: 'January', value: '01' },
  { label: 'February', value: '02' },
  { label: 'March', value: '03' },
  { label: 'April', value: '04' },
  { label: 'May', value: '05' },
  { label: 'June', value: '06' },
  { label: 'July', value: '07' },
  { label: 'August', value: '08' },
  { label: 'September', value: '09' },
  { label: 'October', value: '10' },
  { label: 'November', value: '11' },
  { label: 'December', value: '12' },
]

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 8 }, (_, index) => String(currentYear - 3 + index))

const tableHeaderSx = {
  backgroundColor: '#f3f6f9',
  color: '#667085',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const tableCellSx = {
  color: '#132238',
  fontSize: 13,
  whiteSpace: 'nowrap',
}

const amountCellSx = {
  ...tableCellSx,
  fontWeight: 800,
  textAlign: 'right',
}

const toDateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const monthRange = (month, year) => {
  const monthIndex = Number(month) - 1
  const firstDay = new Date(Number(year), monthIndex, 1)
  const lastDay = new Date(Number(year), monthIndex + 1, 0)

  return {
    date_from: toDateInputValue(firstDay),
    date_to: toDateInputValue(lastDay),
  }
}

const formatDate = (dateValue) => {
  if (!dateValue) return '-'

  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateValue

  return new Intl.DateTimeFormat('en-PH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

export function GeneralFundDailyTable({ daily = [] }) {
  const now = useMemo(() => new Date(), [])
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'))
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()))
  const [rows, setRows] = useState(daily)
  const [detailRows, setDetailRows] = useState([])
  const [detailDate, setDetailDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [dailyPage, setDailyPage] = useState(0)
  const [dailyRowsPerPage, setDailyRowsPerPage] = useState(10)
  const [detailPage, setDetailPage] = useState(0)
  const [detailRowsPerPage, setDetailRowsPerPage] = useState(10)

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => ({
          miscellaneous: sum.miscellaneous + Number(row.miscellaneous || 0),
          receipt_count: sum.receipt_count + Number(row.receipt_count || 0),
          receipts_from_economic_enterprises:
            sum.receipts_from_economic_enterprises + Number(row.receipts_from_economic_enterprises || 0),
          regulatory_fees: sum.regulatory_fees + Number(row.regulatory_fees || 0),
          service_user_charges: sum.service_user_charges + Number(row.service_user_charges || 0),
          tax_on_business: sum.tax_on_business + Number(row.tax_on_business || 0),
          total_amount: sum.total_amount + Number(row.total_amount || 0),
        }),
        {
          miscellaneous: 0,
          receipt_count: 0,
          receipts_from_economic_enterprises: 0,
          regulatory_fees: 0,
          service_user_charges: 0,
          tax_on_business: 0,
          total_amount: 0,
        },
      ),
    [rows],
  )

  const visibleDailyRows = useMemo(
    () => rows.slice(dailyPage * dailyRowsPerPage, dailyPage * dailyRowsPerPage + dailyRowsPerPage),
    [dailyPage, dailyRowsPerPage, rows],
  )

  const visibleDetailRows = useMemo(
    () => detailRows.slice(detailPage * detailRowsPerPage, detailPage * detailRowsPerPage + detailRowsPerPage),
    [detailPage, detailRows, detailRowsPerPage],
  )

  const loadDaily = async () => {
    setLoading(true)
    setError('')
    setDailyPage(0)
    setDetailRows([])
    setDetailDate('')

    try {
      const response = await axiosInstance.get('/general-fund/daily', {
        params: monthRange(selectedMonth, selectedYear),
      })

      setRows(response.data.data || [])
    } catch (requestError) {
      setRows([])
      setError(
        requestError.response?.status === 401
          ? 'Session expired. Please sign in again.'
          : requestError.response?.data?.error ||
              requestError.response?.data?.message ||
              requestError.message ||
              'Unable to load daily collections.',
      )
    } finally {
      setLoading(false)
    }
  }

  const viewDailyDetails = async (dateValue) => {
    setDetailLoading(true)
    setError('')
    setDetailDate(dateValue)
    setDetailPage(0)

    try {
      const response = await axiosInstance.get('/general-fund/collections', {
        params: {
          date_from: dateValue,
          date_to: dateValue,
          limit: 1000,
        },
      })

      setDetailRows(response.data.data || [])
    } catch (requestError) {
      setDetailRows([])
      setError(
        requestError.response?.status === 401
          ? 'Session expired. Please sign in again.'
          : requestError.response?.data?.error ||
              requestError.response?.data?.message ||
              requestError.message ||
              'Unable to load transaction details.',
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDownload = () => {
    if (!rows.length) return

    const header = [
      'Date',
      'Tax on Business',
      'Regulatory Fees',
      'Receipts From Economic Enterprise',
      'Service/User Charges',
      'Miscellaneous',
      'Receipts',
      'Total',
    ]
    const body = rows.map((row) =>
      [
        row.collection_date,
        row.tax_on_business,
        row.regulatory_fees,
        row.receipts_from_economic_enterprises,
        row.service_user_charges,
        row.miscellaneous,
        row.receipt_count,
        row.total_amount,
      ]
        .map(csvValue)
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...body].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `general-fund-daily-${selectedYear}-${selectedMonth}-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="dialog-content-panel">
      <Box className="daily-report-toolbar">
        <label>
          Month
          <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Year
          <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <Button disabled={loading} onClick={loadDaily} startIcon={<Search size={16} />} variant="contained">
          {loading ? 'Loading...' : 'Load Daily'}
        </Button>

        <Button disabled={!rows.length} onClick={handleDownload} startIcon={<Download size={16} />} variant="outlined">
          Download CSV
        </Button>
      </Box>

      {loading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      <div className="daily-summary-strip">
        <div>
          <span>Receipts</span>
          <strong>{formatNumber(totals.receipt_count)}</strong>
        </div>
        <div>
          <span>Total Collection</span>
          <strong>{formatMoney(totals.total_amount)}</strong>
        </div>
      </div>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <TableContainer sx={{ maxHeight: 520 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1180 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Date</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Tax on Business</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Regulatory Fees</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Economic Enterprise</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Service/User Charges</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Miscellaneous</TableCell>
                <TableCell sx={tableHeaderSx}>Receipts</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Total</TableCell>
                <TableCell sx={tableHeaderSx}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleDailyRows.map((row) => (
                <TableRow hover key={row.collection_date}>
                  <TableCell sx={tableCellSx}>{formatDate(row.collection_date)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(row.tax_on_business)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(row.regulatory_fees)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(row.receipts_from_economic_enterprises)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(row.service_user_charges)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(row.miscellaneous)}</TableCell>
                  <TableCell sx={tableCellSx}>{formatNumber(row.receipt_count)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(row.total_amount)}</TableCell>
                  <TableCell sx={tableCellSx}>
                    <Button
                      disabled={detailLoading && detailDate === row.collection_date}
                      onClick={() => viewDailyDetails(row.collection_date)}
                      size="small"
                      startIcon={<Eye size={15} />}
                      variant="outlined"
                    >
                      {detailLoading && detailDate === row.collection_date ? 'Loading' : 'View'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!!rows.length && (
                <TableRow sx={{ '& td': { backgroundColor: '#f8fbff', fontWeight: 900 } }}>
                  <TableCell sx={tableCellSx}>Total</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(totals.tax_on_business)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(totals.regulatory_fees)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(totals.receipts_from_economic_enterprises)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(totals.service_user_charges)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(totals.miscellaneous)}</TableCell>
                  <TableCell sx={tableCellSx}>{formatNumber(totals.receipt_count)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(totals.total_amount)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
              {!rows.length && (
                <TableRow>
                  <TableCell align="center" colSpan={9} sx={{ color: '#667085', py: 3 }}>
                    No daily collections found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={rows.length}
          onPageChange={(_, nextPage) => setDailyPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setDailyRowsPerPage(Number(event.target.value))
            setDailyPage(0)
          }}
          page={dailyPage}
          rowsPerPage={dailyRowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Paper>

      {detailDate && (
        <Paper className="daily-detail-panel" variant="outlined">
          <Box alignItems="center" display="flex" gap={2} justifyContent="space-between">
            <Typography color="#132238" fontWeight={800} variant="h6">
              Transaction Details - {formatDate(detailDate)}
            </Typography>
            <IconButton aria-label="Close transaction details" onClick={() => setDetailDate('')}>
              <X size={18} />
            </IconButton>
          </Box>

          {detailLoading ? (
            <Box>
              <LinearProgress />
              <Typography color="text.secondary" fontSize={13} mt={1}>
                Loading transaction details...
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer sx={{ maxHeight: 360 }}>
                <Table stickyHeader size="small" sx={{ minWidth: 820 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={tableHeaderSx}>Date</TableCell>
                      <TableCell sx={tableHeaderSx}>Name</TableCell>
                      <TableCell sx={tableHeaderSx}>OR Number</TableCell>
                      <TableCell sx={tableHeaderSx}>Cashier</TableCell>
                      <TableCell sx={tableHeaderSx}>Lines</TableCell>
                      <TableCell align="right" sx={tableHeaderSx}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleDetailRows.map((row) => (
                      <TableRow hover key={row.payment_id}>
                        <TableCell sx={tableCellSx}>{formatDate(row.collection_date)}</TableCell>
                        <TableCell sx={tableCellSx}>{row.taxpayer || '-'}</TableCell>
                        <TableCell sx={tableCellSx}>{row.receipt_no || '-'}</TableCell>
                        <TableCell sx={tableCellSx}>{String(row.collector || '-').toUpperCase()}</TableCell>
                        <TableCell sx={tableCellSx}>{formatNumber(row.line_count)}</TableCell>
                        <TableCell sx={amountCellSx}>{formatMoney(row.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                    {!visibleDetailRows.length && (
                      <TableRow>
                        <TableCell align="center" colSpan={6} sx={{ color: '#667085', py: 3 }}>
                          No transaction details found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={detailRows.length}
                onPageChange={(_, nextPage) => setDetailPage(nextPage)}
                onRowsPerPageChange={(event) => {
                  setDetailRowsPerPage(Number(event.target.value))
                  setDetailPage(0)
                }}
                page={detailPage}
                rowsPerPage={detailRowsPerPage}
                rowsPerPageOptions={[5, 10, 25]}
              />
            </>
          )}
        </Paper>
      )}
    </section>
  )
}
