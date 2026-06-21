import { Alert, Box, Button, LinearProgress, Paper, Table, TableBody, TableCell, TableContainer, TableFooter, TableHead, TableRow, TextField } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import axiosInstance from '../../../axiosinstance/axiosInstance'
import { formatMoney, formatNumber } from '../utils/generalFundFormat'

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

const toDateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const monthRange = (monthValue) => {
  if (!monthValue) return {}

  const [year, month] = monthValue.split('-').map(Number)
  if (!year || !month) return {}

  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)

  return {
    date_from: toDateInputValue(firstDay),
    date_to: toDateInputValue(lastDay),
  }
}

const defaultMonth = (filters) => (filters?.date_from || toDateInputValue(new Date())).slice(0, 7)

export function GeneralFundSourceBreakdown({ filters }) {
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth(filters))
  const [appliedMonth, setAppliedMonth] = useState(defaultMonth(filters))
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSources = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await axiosInstance.get('/general-fund/sources', {
        params: monthRange(appliedMonth),
      })

      setSources(response.data.data || [])
    } catch (requestError) {
      setSources([])
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load source breakdown.',
      )
    } finally {
      setLoading(false)
    }
  }, [appliedMonth])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadSources()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadSources])

  const totalReceipts = sources.reduce((sum, source) => sum + Number(source.receipt_count || 0), 0)
  const totalAmount = sources.reduce((sum, source) => sum + Number(source.total_amount || 0), 0)

  return (
    <section className="dialog-content-panel">
      <Box alignItems="center" display="flex" flexWrap="wrap" gap={1.5} mb={2}>
        <TextField
          InputLabelProps={{ shrink: true }}
          label="Month / Year"
          onChange={(event) => setSelectedMonth(event.target.value)}
          size="small"
          type="month"
          value={selectedMonth}
        />
        <Button disabled={loading} onClick={() => setAppliedMonth(selectedMonth)} variant="contained">
          Apply Filter
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 1.5 }} />}
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      <Paper variant="outlined">
        <TableContainer sx={{ maxHeight: 620 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 860 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Source</TableCell>
                <TableCell sx={tableHeaderSx}>Code</TableCell>
                <TableCell sx={tableHeaderSx}>Category</TableCell>
                <TableCell sx={tableHeaderSx}>Receipts</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sources.map((source) => (
                <TableRow hover key={`${source.source_code}-${source.source_name}-${source.category}`}>
                  <TableCell sx={tableCellSx}>{source.description}</TableCell>
                  <TableCell sx={tableCellSx}>{source.source_code || '-'}</TableCell>
                  <TableCell sx={tableCellSx}>{source.category}</TableCell>
                  <TableCell sx={tableCellSx}>{formatNumber(source.receipt_count)}</TableCell>
                  <TableCell align="right" sx={{ ...tableCellSx, fontWeight: 900 }}>
                    {formatMoney(source.total_amount)}
                  </TableCell>
                </TableRow>
              ))}
              {!sources.length && !loading && (
                <TableRow>
                  <TableCell align="center" colSpan={5} sx={{ color: '#667085', py: 3 }}>
                    No source records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell sx={{ ...tableCellSx, fontWeight: 900 }}>Total Overall</TableCell>
                <TableCell sx={tableCellSx}>-</TableCell>
                <TableCell sx={tableCellSx}>-</TableCell>
                <TableCell sx={{ ...tableCellSx, fontWeight: 900 }}>{formatNumber(totalReceipts)}</TableCell>
                <TableCell align="right" sx={{ ...tableCellSx, fontWeight: 900 }}>
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
