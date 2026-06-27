import { useMemo, useState } from 'react'
import {
  Box,
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
  TextField,
  Typography,
} from '@mui/material'
import axiosInstance from '../../../axiosinstance/axiosInstance'
import { formatMoney, formatNumber } from '../utils/generalFundFormat'

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

const normalizeCategories = (categories) => {
  const grouped = new Map()

  categories.forEach((row) => {
    const name = row.category === 'Miscellaneous' ? 'Regulatory Fees' : row.category
    const current = grouped.get(name) || {
      category: name,
      receipt_count: 0,
      total_amount: 0,
    }

    current.receipt_count += Number(row.receipt_count || 0)
    current.total_amount += Number(row.total_amount || 0)
    grouped.set(name, current)
  })

  return Array.from(grouped.values()).sort((a, b) => Number(b.total_amount || 0) - Number(a.total_amount || 0))
}

export function GeneralFundCategoryBreakdown({ categories, filters }) {
  const [dateFrom, setDateFrom] = useState(filters?.date_from || '')
  const [dateTo, setDateTo] = useState(filters?.date_to || '')
  const [rows, setRows] = useState(categories)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const displayRows = useMemo(() => normalizeCategories(rows), [rows])
  const total = displayRows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0)
  const receiptTotal = displayRows.reduce((sum, row) => sum + Number(row.receipt_count || 0), 0)

  const loadByDate = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await axiosInstance.get('/general-fund/summary', {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
        },
      })

      if (!response.data?.ok) {
        throw new Error(response.data?.error || 'Unable to load category breakdown.')
      }

      setRows(response.data.data?.categories || [])
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load category breakdown.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="dialog-content-panel">
      <Box alignItems="center" display="flex" flexWrap="wrap" gap={1.5} mb={2}>
        <TextField
          InputLabelProps={{ shrink: true }}
          label="Date from"
          onChange={(event) => setDateFrom(event.target.value)}
          size="small"
          type="date"
          value={dateFrom}
        />
        <TextField
          InputLabelProps={{ shrink: true }}
          label="Date to"
          onChange={(event) => setDateTo(event.target.value)}
          size="small"
          type="date"
          value={dateTo}
        />
        <Button disabled={loading} onClick={loadByDate} variant="contained">
          Apply Filter
        </Button>
        <Typography color="text.secondary" fontSize={13}>
          Month / Day / Year filter
        </Typography>
      </Box>

      {loading && <LinearProgress sx={{ mb: 1.5 }} />}
      {error && (
        <Typography color="error" fontSize={13} mb={1.5}>
          {error}
        </Typography>
      )}

      <Paper variant="outlined">
        <TableContainer sx={{ maxHeight: 520 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 680 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Category</TableCell>
                <TableCell sx={tableHeaderSx}>Receipts</TableCell>
                <TableCell sx={tableHeaderSx}>Share</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayRows.map((category) => {
                const amount = Number(category.total_amount || 0)
                const percent = total ? Math.round((amount / total) * 100) : 0

                return (
                  <TableRow hover key={category.category}>
                    <TableCell sx={tableCellSx}>{category.category}</TableCell>
                    <TableCell sx={tableCellSx}>{formatNumber(category.receipt_count)}</TableCell>
                    <TableCell sx={tableCellSx}>{percent}%</TableCell>
                    <TableCell align="right" sx={{ ...tableCellSx, fontWeight: 900 }}>
                      {formatMoney(amount)}
                    </TableCell>
                  </TableRow>
                )
              })}
              {!displayRows.length && (
                <TableRow>
                  <TableCell align="center" colSpan={4} sx={{ color: '#667085', py: 3 }}>
                    No category records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell sx={{ ...tableCellSx, fontWeight: 900 }}>Total Overall</TableCell>
                <TableCell sx={{ ...tableCellSx, fontWeight: 900 }}>{formatNumber(receiptTotal)}</TableCell>
                <TableCell sx={{ ...tableCellSx, fontWeight: 900 }}>{total ? '100%' : '0%'}</TableCell>
                <TableCell align="right" sx={{ ...tableCellSx, fontWeight: 900 }}>
                  {formatMoney(total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </TableContainer>
      </Paper>
    </section>
  )
}
