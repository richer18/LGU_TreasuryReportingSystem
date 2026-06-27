import {
  Button,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
} from '@mui/material'
import { Calendar, RefreshCcw } from 'lucide-react'
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
  fontSize: 14,
  whiteSpace: 'nowrap',
}

const amountCellSx = {
  ...tableCellSx,
  fontWeight: 900,
  textAlign: 'right',
}

const getShare = (amount, total) => {
  if (!total) return '0%'
  return `${((Number(amount || 0) / total) * 100).toFixed(2)}%`
}

export function GeneralFundCollectorCollections({ collectors = [], filters = {} }) {
  const [dateFrom, setDateFrom] = useState(filters.date_from || '')
  const [dateTo, setDateTo] = useState(filters.date_to || '')
  const [rows, setRows] = useState(collectors)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalAmount = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0),
    [rows],
  )
  const totalReceipts = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.receipt_count || 0), 0),
    [rows],
  )

  const loadCollectors = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axiosInstance.get('/general-fund/collectors', {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
        },
      })

      setRows(response.data.data || [])
    } catch (requestError) {
      setRows([])
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load collector collections.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="dialog-content-panel">
      <form className="collector-date-filter" onSubmit={loadCollectors}>
        <label>
          <span><Calendar size={14} aria-hidden="true" /> Date from</span>
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label>
          <span><Calendar size={14} aria-hidden="true" /> Date to</span>
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <Button
          disabled={loading}
          startIcon={<RefreshCcw size={15} />}
          type="submit"
          variant="contained"
        >
          Apply Filter
        </Button>
      </form>

      {loading && <LinearProgress />}

      {error && (
        <section className="inline-alert">
          {error}
        </section>
      )}

      <div className="panel-title-row collector-collection-heading">
        <div>
          <h3>Collection kada Collector</h3>
          <p>General Fund collector totals from {dateFrom || '-'} to {dateTo || '-'}.</p>
        </div>
        <strong>{formatMoney(totalAmount)}</strong>
      </div>

      <Paper variant="outlined">
        <TableContainer sx={{ maxHeight: 560 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 760 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Collector</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Receipts</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Share</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Total Collection</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow hover key={row.collector}>
                  <TableCell sx={{ ...tableCellSx, fontWeight: 900 }}>
                    {String(row.collector || 'UNSPECIFIED').toUpperCase()}
                  </TableCell>
                  <TableCell align="right" sx={tableCellSx}>{row.receipt_count || 0}</TableCell>
                  <TableCell align="right" sx={tableCellSx}>{getShare(row.total_amount, totalAmount)}</TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(row.total_amount)}</TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell align="center" colSpan={4} sx={{ color: '#667085', py: 3 }}>
                    No collector collections found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell sx={{ ...tableHeaderSx, color: '#132238' }}>Total Overall</TableCell>
                <TableCell align="right" sx={{ ...amountCellSx, backgroundColor: '#f8fafc' }}>
                  {totalReceipts}
                </TableCell>
                <TableCell align="right" sx={{ ...amountCellSx, backgroundColor: '#f8fafc' }}>
                  {rows.length ? '100%' : '0%'}
                </TableCell>
                <TableCell sx={{ ...amountCellSx, backgroundColor: '#f8fafc' }}>
                  {formatMoney(totalAmount)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      </Paper>
    </section>
  )
}
