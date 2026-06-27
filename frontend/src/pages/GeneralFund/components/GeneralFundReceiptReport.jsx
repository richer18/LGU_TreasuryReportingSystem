import {
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material'
import { Download, FileSearch } from 'lucide-react'
import { useMemo, useState } from 'react'
import axiosInstance from '../../../axiosinstance/axiosInstance'
import { formatMoney } from '../utils/generalFundFormat'

const tableHeaderSx = {
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-muted)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const tableCellSx = {
  color: 'var(--color-text)',
  fontSize: 13,
  whiteSpace: 'nowrap',
}

const amountCellSx = {
  ...tableCellSx,
  fontWeight: 900,
  textAlign: 'right',
}

const collectorDefaults = [
  { label: 'FLORA MY', value: 'flora' },
  { label: 'IRIS', value: 'angelique' },
  { label: 'AGNES', value: 'agnes' },
  { label: 'RICARDO', value: 'ricardo' },
  { label: 'AMABELLA', value: 'amabella' },
]

const toDateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const getMonthRange = (monthValue) => {
  const [year, month] = String(monthValue).split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)

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
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

const displayReceiptType = (row) => {
  const collector = String(row.collector || '').toUpperCase()

  if (collector === 'AMABELLA') {
    return 'Cash Tickets'
  }

  return row.receipt_type || 'General Fund'
}

const statusColor = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'paid') return 'success'
  if (normalized === 'void') return 'error'
  if (normalized === 'cancelled') return 'warning'
  return 'default'
}

export function GeneralFundReceiptReport({ collectors = [] }) {
  const today = useMemo(() => new Date(), [])
  const [dateType, setDateType] = useState('dateRange')
  const [dateFrom, setDateFrom] = useState(toDateInputValue(today))
  const [dateTo, setDateTo] = useState(toDateInputValue(today))
  const [monthValue, setMonthValue] = useState(toDateInputValue(today).slice(0, 7))
  const [collector, setCollector] = useState(collectorDefaults[0].value)
  const [receiptFrom, setReceiptFrom] = useState('')
  const [receiptTo, setReceiptTo] = useState('')
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(5)

  const collectorOptions = useMemo(() => {
    const options = new Map()

    collectorDefaults.forEach((option) => options.set(option.value, option))
    collectors.forEach((row) => {
      const value = String(row.collector || row.cashier || row.value || '').trim()
      if (!value) return
      if (options.has(value.toLowerCase())) return

      options.set(value.toLowerCase(), {
        label: value.toUpperCase(),
        value: value.toLowerCase(),
      })
    })

    return Array.from(options.values())
  }, [collectors])

  const visibleRows = useMemo(
    () => rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [page, rows, rowsPerPage],
  )

  const totalAmount = useMemo(
    () =>
      rows.reduce((sum, row) => {
        if (String(row.collection_status || 'Paid').toLowerCase() !== 'paid') {
          return sum
        }

        return sum + Number(row.total_amount || 0)
      }, 0),
    [rows],
  )

  const buildParams = () => {
    const params =
      dateType === 'monthYear'
        ? getMonthRange(monthValue)
        : {
            date_from: dateFrom,
            date_to: dateTo,
          }

    return {
      ...params,
      collector,
      limit: 500,
      receipt_from: receiptFrom || undefined,
      receipt_to: receiptTo || undefined,
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setError('')
    setPage(0)

    try {
      const response = await axiosInstance.get('/general-fund/receipt-report', {
        params: buildParams(),
      })

      setRows(response.data.data || [])
      setStatus('success')
    } catch (requestError) {
      setRows([])
      setStatus('error')
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load the collector receipt report.',
      )
    }
  }

  const handleDownload = () => {
    if (!rows.length) return

    const header = ['Date', 'Collector', 'Receipt Type', 'Receipt No.', 'Taxpayer', 'Lines', 'Status', 'Total']
    const body = rows.map((row) =>
      [
        row.collection_date,
        row.collector,
        displayReceiptType(row),
        row.receipt_no,
        row.taxpayer,
        row.line_count,
        row.collection_status || 'Paid',
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
    link.download = `general-fund-receipt-report-${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="dialog-content-panel">
      <form className="receipt-report-form" onSubmit={handleSubmit}>
        <div className="receipt-report-grid">
          <label>
            Filter Type
            <select value={dateType} onChange={(event) => setDateType(event.target.value)}>
              <option value="dateRange">Daily or Date Range</option>
              <option value="monthYear">Month and Year</option>
            </select>
          </label>

          {dateType === 'dateRange' ? (
            <>
              <label>
                From Collection Date
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </label>
              <label>
                To Collection Date
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </label>
            </>
          ) : (
            <label>
              Collection Month
              <input type="month" value={monthValue} onChange={(event) => setMonthValue(event.target.value)} />
            </label>
          )}

          <label>
            Collector
            <select value={collector} onChange={(event) => setCollector(event.target.value)}>
              {collectorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Receipt No. From
            <input value={receiptFrom} onChange={(event) => setReceiptFrom(event.target.value)} />
          </label>

          <label>
            Receipt No. To
            <input value={receiptTo} onChange={(event) => setReceiptTo(event.target.value)} />
          </label>
        </div>

        <button className="primary-button receipt-report-submit" disabled={status === 'loading'} type="submit">
          <FileSearch size={16} aria-hidden="true" />
          {status === 'loading' ? 'Checking Collection...' : 'Check Collection'}
        </button>
      </form>

      {status === 'error' && (
        <section className="inline-alert">
          {error}
        </section>
      )}

      {status === 'success' && !rows.length && <div className="empty-row">No receipts found.</div>}

      <div className="receipt-report-total">
        <span>Total Collection</span>
        <strong>{formatMoney(totalAmount)}</strong>
      </div>

      {rows.length > 0 && (
        <div className="panel-title-row">
          <h3>Receipt Results ({rows.length})</h3>
          <Button onClick={handleDownload} startIcon={<Download size={16} />} type="button" variant="outlined">
            Download CSV
          </Button>
        </div>
      )}

      <Paper variant="outlined">
        <TableContainer sx={{ maxHeight: 560 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1080 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Date</TableCell>
                <TableCell sx={tableHeaderSx}>Collector</TableCell>
                <TableCell sx={tableHeaderSx}>Receipt Type</TableCell>
                <TableCell sx={tableHeaderSx}>Receipt No.</TableCell>
                <TableCell sx={tableHeaderSx}>Taxpayer</TableCell>
                <TableCell sx={tableHeaderSx}>Lines</TableCell>
                <TableCell sx={tableHeaderSx}>Status</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow hover key={row.payment_id}>
                  <TableCell sx={tableCellSx}>{formatDate(row.collection_date)}</TableCell>
                  <TableCell sx={tableCellSx}>{String(row.collector || '-').toUpperCase()}</TableCell>
                  <TableCell sx={tableCellSx}>{displayReceiptType(row)}</TableCell>
                  <TableCell sx={{ ...tableCellSx, fontWeight: 900 }}>{row.receipt_no || '-'}</TableCell>
                  <TableCell sx={{ ...tableCellSx, minWidth: 240 }}>{row.taxpayer || '-'}</TableCell>
                  <TableCell sx={tableCellSx}>{row.line_count || 0}</TableCell>
                  <TableCell sx={tableCellSx}>
                    <Chip
                      color={statusColor(row.collection_status || 'Paid')}
                      label={row.collection_status || 'Paid'}
                      size="small"
                      sx={{ fontWeight: 900 }}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(row.total_amount)}</TableCell>
                </TableRow>
              ))}
              {!visibleRows.length && (
                <TableRow>
                  <TableCell align="center" colSpan={8} sx={{ color: '#667085', py: 3 }}>
                    Run a receipt search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={rows.length}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value))
            setPage(0)
          }}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Paper>
    </section>
  )
}
