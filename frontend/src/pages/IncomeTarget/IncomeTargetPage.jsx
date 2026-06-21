import {
  Chip,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material'
import { Calendar, RefreshCcw, Search, Target } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import { formatMoney } from '../GeneralFund/utils/generalFundFormat'

const tableHeaderSx = {
  backgroundColor: '#f8fafc',
  color: '#667085',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const tableCellSx = {
  color: '#132238',
  fontSize: 14,
}

const amountCellSx = {
  ...tableCellSx,
  fontWeight: 900,
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

const summaryCards = [
  { key: 'grand_total', label: 'Grand Total' },
  { key: 'general_fund', label: 'General Fund' },
  { key: 'special_education_fund', label: 'Special Education Fund' },
  { key: 'local_sources', label: 'Local Sources' },
  { key: 'external_sources', label: 'External Sources' },
]

export function IncomeTargetPage() {
  const [year, setYear] = useState('2026')
  const [payload, setPayload] = useState(null)
  const [query, setQuery] = useState('')
  const [section, setSection] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(15)

  const loadIncomeTarget = async (targetYear = year) => {
    setLoading(true)
    setError('')

    try {
      const response = await axiosInstance.get('/income-target', {
        params: { year: targetYear },
      })

      setPayload(response.data.data)
      setPage(0)
    } catch (requestError) {
      setPayload(null)
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load Income Target workbook.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    axiosInstance
      .get('/income-target', { params: { year } })
      .then((response) => {
        if (!isActive) return
        setPayload(response.data.data)
      })
      .catch((requestError) => {
        if (!isActive) return
        setPayload(null)
        setError(
          requestError.response?.data?.error ||
            requestError.response?.data?.message ||
            requestError.message ||
            'Unable to load Income Target workbook.',
        )
      })
      .finally(() => {
        if (!isActive) return
        setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [year])

  const sections = useMemo(() => {
    const names = new Set((payload?.rows || []).map((row) => row.section).filter(Boolean))
    return Array.from(names)
  }, [payload])

  const filteredRows = useMemo(() => {
    const searchText = query.trim().toLowerCase()

    return (payload?.rows || []).filter((row) => {
      const matchesSection = section === 'all' || row.section === section
      const matchesSearch = !searchText || row.particular.toLowerCase().includes(searchText)
      return matchesSection && matchesSearch
    })
  }, [payload, query, section])

  const visibleRows = useMemo(
    () => filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredRows, page, rowsPerPage],
  )

  const handleYearChange = (event) => {
    setLoading(true)
    setError('')
    setYear(event.target.value)
    setSection('all')
    setQuery('')
    setPage(0)
  }

  return (
    <div className="page-stack income-target-page">
      <section className="general-fund-hero">
        <div>
          <p className="eyebrow">Approved Budget Target</p>
          <h2>Income Target</h2>
        </div>
      </section>

      <section className="toolbar-panel income-target-filter-panel">
        <div className="income-target-controls">
          <label className="treasury-field">
            <span><Calendar size={14} aria-hidden="true" /> Year</span>
            <input type="number" value={year} onChange={handleYearChange} min="2000" max="2100" />
          </label>
          <label className="treasury-field">
            <span><Target size={14} aria-hidden="true" /> Section</span>
            <select value={section} onChange={(event) => {
              setSection(event.target.value)
              setPage(0)
            }}>
              <option value="all">All sections</option>
              {sections.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
          <label className="treasury-field">
            <span><Search size={14} aria-hidden="true" /> Search</span>
            <input
              placeholder="Search particulars"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(0)
              }}
            />
          </label>
          <button className="secondary-button" disabled={loading} onClick={() => loadIncomeTarget()} type="button">
            <RefreshCcw size={16} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </section>

      {loading && <LinearProgress />}

      {error && (
        <section className="inline-alert">
          {error}
        </section>
      )}

      {payload?.projection && (
        <section className={`income-target-projection-note ${payload.projection.is_projected ? 'is-projected' : ''}`}>
          <strong>
            {payload.projection.is_projected ? 'Projected Income Target' : 'Actual Workbook Target'}
          </strong>
          <span>
            {payload.projection.is_projected
              ? `${payload.year} is computed from ${payload.source_year} using 10% annual increase. Factor: ${payload.projection.factor}.`
              : `${payload.year} values are loaded directly from the workbook.`}
          </span>
        </section>
      )}

      <section className="income-target-summary-grid">
        {summaryCards.map((card) => (
          <Paper className="income-target-summary-card" key={card.key} variant="outlined">
            <span>{card.label}</span>
            <strong>{formatMoney(payload?.summary?.[card.key] || 0)}</strong>
          </Paper>
        ))}
      </section>

      <Paper className="reports-table income-target-table" variant="outlined">
        <div className="table-toolbar">
          <div>
            <strong><span className="toolbar-live-dot" />Income Target Workbook</strong>
            <span>{filteredRows.length} rows from {payload?.sheet || 'Sheet1'}</span>
          </div>
        </div>
        <TableContainer sx={{ maxHeight: 660 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 860 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Particulars</TableCell>
                <TableCell sx={tableHeaderSx}>Section</TableCell>
                <TableCell sx={tableHeaderSx}>Type</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Income Target</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow hover key={`${row.row_number}-${row.particular}`}>
                  <TableCell
                    sx={{
                      ...tableCellSx,
                      fontWeight: row.kind !== 'target' ? 900 : 700,
                      pl: 2 + row.level * 3,
                      whiteSpace: 'normal',
                    }}
                  >
                    {row.particular}
                  </TableCell>
                  <TableCell sx={{ ...tableCellSx, whiteSpace: 'nowrap' }}>{row.section || '-'}</TableCell>
                  <TableCell sx={tableCellSx}>
                    <Chip
                      color={row.kind === 'total' ? 'success' : row.kind === 'group' ? 'primary' : 'default'}
                      label={row.kind}
                      size="small"
                      sx={{ fontWeight: 800, textTransform: 'capitalize' }}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={amountCellSx}>
                    {row.target_amount === null || row.target_amount === undefined ? '-' : formatMoney(row.target_amount)}
                  </TableCell>
                </TableRow>
              ))}
              {!visibleRows.length && (
                <TableRow>
                  <TableCell align="center" colSpan={4} sx={{ color: '#667085', py: 3 }}>
                    No income target rows found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredRows.length}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value))
            setPage(0)
          }}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[15, 25, 50]}
        />
      </Paper>
    </div>
  )
}
