import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import {
  AlertTriangle,
  Ban,
  Download,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import { formatMoney } from '../GeneralFund/utils/generalFundFormat'

const fundTypes = [
  'General Fund - LBP',
  'Trust Fund Regular',
  'Veterans',
  'DBP',
  'SEF',
  'Trust Liability DRRM',
  'KALAHI',
  'BUB',
  'EGOV',
]

const statuses = ['Issued', 'Cancelled', 'Voided', 'Draft']

const bankDefaults = {
  'General Fund - LBP': { bank_name: 'LBP', bank_account_number: '0292-1068-86' },
  DBP: { bank_name: 'DBP', bank_account_number: '' },
  Veterans: { bank_name: 'Veterans Bank', bank_account_number: '' },
}

const today = () => new Date().toISOString().slice(0, 10)
const currentMonth = () => new Date().getMonth() + 1
const currentYear = () => new Date().getFullYear()

const emptyForm = {
  check_date: today(),
  check_number: '',
  dv_number: '',
  fund_type: 'General Fund - LBP',
  bank_name: 'LBP',
  bank_account_number: '0292-1068-86',
  payee: '',
  nature_of_payment: '',
  dv_amount: '',
  report_number: '',
  sheet_number: '',
  reporting_month: currentMonth(),
  reporting_year: currentYear(),
  status: 'Draft',
  remarks: '',
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    backgroundColor: '#fff',
  },
  '& .MuiInputLabel-root': {
    fontSize: 13,
    fontWeight: 800,
  },
}

const headerCellSx = {
  backgroundColor: '#f8fafc',
  color: '#475569',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const statusColor = (status) => {
  if (status === 'Issued') return 'success'
  if (status === 'Cancelled') return 'warning'
  if (status === 'Voided') return 'error'
  return 'default'
}

const normalize = (value) => String(value || '').toLowerCase().trim()

const monthName = (month) =>
  new Date(2026, Number(month || 1) - 1, 1).toLocaleString('en-PH', { month: 'long' })

const getErrorMessage = (error) => {
  const errors = error.response?.data?.errors
  if (errors) {
    const first = Object.values(errors)?.[0]?.[0]
    if (first) return first
  }
  return error.response?.data?.message || error.message || 'Server error.'
}

export function ReportChecksIssuedPage({ user }) {
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState(null)
  const [warnings, setWarnings] = useState([])
  const [filters, setFilters] = useState({
    reporting_month: currentMonth(),
    reporting_year: currentYear(),
    fund_type: '',
    status: '',
    bank_name: '',
    payee: '',
    check_number: '',
    dv_number: '',
    search: '',
    sort_by: 'check_date',
    sort_dir: 'desc',
  })
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(15)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [viewRecord, setViewRecord] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [initialForm, setInitialForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [menuAnchor, setMenuAnchor] = useState(null)
  const [menuRecord, setMenuRecord] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [statusAction, setStatusAction] = useState(null)

  const canManage = Boolean(user?.permissions?.includes('rci.manage'))

  const queryParams = useMemo(() => ({
    ...filters,
    per_page: rowsPerPage,
    page: page + 1,
  }), [filters, page, rowsPerPage])

  const loadRecords = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await axiosInstance.get('/rci/checks', { params: queryParams })
      setRecords(response.data.records || [])
      setSummary(response.data.summary || null)
      setWarnings(response.data.warnings || [])
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [queryParams])

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }))
    setPage(0)
  }

  const updateForm = (field, value) => {
    const next = { ...form, [field]: value }
    if (field === 'check_date' && value) {
      const date = new Date(`${value}T00:00:00`)
      if (!Number.isNaN(date.getTime())) {
        next.reporting_month = date.getMonth() + 1
        next.reporting_year = date.getFullYear()
      }
    }
    if (field === 'fund_type' && bankDefaults[value]) {
      Object.assign(next, bankDefaults[value])
    }
    setForm(next)
    setFieldErrors((current) => ({ ...current, [field]: '' }))
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setInitialForm(emptyForm)
    setFieldErrors({})
    setDialogOpen(true)
  }

  const openEdit = (record) => {
    const next = {
      ...emptyForm,
      ...record,
      dv_amount: record.dv_amount || '',
      sheet_number: record.sheet_number || '',
      remarks: record.remarks || '',
    }
    setEditing(record)
    setForm(next)
    setInitialForm(next)
    setFieldErrors({})
    setDialogOpen(true)
    setMenuAnchor(null)
    setMenuRecord(null)
  }

  const closeForm = () => {
    if (JSON.stringify(form) !== JSON.stringify(initialForm) && !window.confirm('You have unsaved changes. Close this form?')) {
      return
    }
    setDialogOpen(false)
    setEditing(null)
    setFieldErrors({})
  }

  const possibleDuplicate = useMemo(() => {
    const payee = normalize(form.payee)
    const nature = normalize(form.nature_of_payment)
    const amount = Number(form.dv_amount || 0).toFixed(2)
    return records.find((record) =>
      record.id !== editing?.id &&
      normalize(record.payee) === payee &&
      record.check_date === form.check_date &&
      Number(record.dv_amount || 0).toFixed(2) === amount &&
      normalize(record.nature_of_payment) === nature &&
      payee &&
      nature &&
      Number(amount) > 0
    )
  }, [editing, form, records])

  const saveRecord = async (event) => {
    event.preventDefault()
    if (saving) return
    if (possibleDuplicate && !window.confirm('Possible duplicate found based on payee, amount, date, and nature of payment. Continue saving?')) {
      return
    }

    setSaving(true)
    setError('')
    setFieldErrors({})
    try {
      if (editing) {
        await axiosInstance.put(`/rci/checks/${editing.id}`, form)
        setSuccess('Check record updated.')
      } else {
        await axiosInstance.post('/rci/checks', form)
        setSuccess('Check record saved.')
      }
      setDialogOpen(false)
      setEditing(null)
      await loadRecords()
    } catch (requestError) {
      setFieldErrors(requestError.response?.data?.errors || {})
      setError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async () => {
    if (!statusAction) return
    setSaving(true)
    setError('')
    try {
      await axiosInstance.patch(`/rci/checks/${statusAction.record.id}/status`, {
        status: statusAction.status,
        remarks: statusAction.remarks,
      })
      setSuccess(`Check marked as ${statusAction.status}.`)
      setStatusAction(null)
      await loadRecords()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  const deleteRecord = async () => {
    if (!confirmDelete) return
    setSaving(true)
    setError('')
    try {
      await axiosInstance.delete(`/rci/checks/${confirmDelete.id}`)
      setSuccess('Check record deleted.')
      setConfirmDelete(null)
      await loadRecords()
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  const exportExcel = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await axiosInstance.get('/rci/checks/export', {
        params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined)),
        responseType: 'blob',
      })
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `report_of_checks_issued_${filters.reporting_year}_${filters.reporting_month}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  const printReport = () => {
    setPrintOpen(true)
  }

  const pagedRecords = records
  const printableRows = records.filter((record) => record.status === 'Issued')
  const printableByFund = printableRows.reduce((groups, record) => {
    const fund = record.fund_type || 'Unspecified'
    groups[fund] = groups[fund] || []
    groups[fund].push(record)
    return groups
  }, {})

  return (
    <Box className="page-stack" sx={{ display: 'grid', gap: 2.25 }}>
      <Paper elevation={0} sx={{ border: '1px solid #dbe4f0', borderRadius: 3, p: { xs: 2, md: 3 } }}>
        <Stack alignItems={{ xs: 'stretch', md: 'center' }} direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography sx={{ color: '#155eef', fontSize: 12, fontWeight: 950, letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Treasury Disbursement Reporting
            </Typography>
            <Typography component="h2" sx={{ color: '#0f172a', fontSize: { xs: 30, md: 42 }, fontWeight: 950, lineHeight: 1.05, mt: 1 }}>
              Report of Checks Issued
            </Typography>
            <Typography sx={{ color: '#64748b', mt: 1 }}>
              Manage issued, draft, cancelled, and voided checks with fund subtotals and audit-ready records.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button disabled={loading} onClick={loadRecords} startIcon={<RefreshCcw size={16} />} variant="outlined">
              Refresh
            </Button>
            <Button onClick={printReport} startIcon={<Printer size={16} />} variant="outlined">
              Print Preview
            </Button>
            <Button onClick={exportExcel} startIcon={<Download size={16} />} variant="outlined">
              Export Excel
            </Button>
            {canManage && (
              <Button onClick={openCreate} startIcon={<Plus size={16} />} variant="contained">
                Add Check Record
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      {loading && <LinearProgress />}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' } }}>
        {[
          ['Total Issued Amount', formatMoney(summary?.total_issued_amount || 0)],
          ['Total Issued Checks', summary?.total_issued_checks || 0],
          ['Incomplete Records', summary?.incomplete_records || 0],
          ['Voided Checks', summary?.voided_checks || 0],
          ['Possible Duplicates', summary?.possible_duplicates || 0],
        ].map(([label, value]) => (
          <Paper key={label} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2 }}>
            <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>{label}</Typography>
            <Typography sx={{ color: '#0f172a', fontSize: 26, fontWeight: 950, mt: 1 }}>{value}</Typography>
          </Paper>
        ))}
      </Box>

      {warnings.length > 0 && (
        <Alert icon={<AlertTriangle size={18} />} severity="warning">
          {warnings[0].message} {warnings.length > 1 ? `(${warnings.length} warnings)` : ''}
        </Alert>
      )}

      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, p: 2 }}>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
          <FormControl size="small" sx={fieldSx}>
            <InputLabel>Reporting Month</InputLabel>
            <Select label="Reporting Month" value={filters.reporting_month} onChange={(event) => updateFilter('reporting_month', event.target.value)}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <MenuItem key={month} value={month}>{monthName(month)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Reporting Year" size="small" sx={fieldSx} type="number" value={filters.reporting_year} onChange={(event) => updateFilter('reporting_year', event.target.value)} />
          <FormControl size="small" sx={fieldSx}>
            <InputLabel>Fund Type</InputLabel>
            <Select label="Fund Type" value={filters.fund_type} onChange={(event) => updateFilter('fund_type', event.target.value)}>
              <MenuItem value="">All funds</MenuItem>
              {fundTypes.map((fund) => <MenuItem key={fund} value={fund}>{fund}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={fieldSx}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
              <MenuItem value="">All statuses</MenuItem>
              {statuses.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Bank" size="small" sx={fieldSx} value={filters.bank_name} onChange={(event) => updateFilter('bank_name', event.target.value)} />
          <TextField label="Payee" size="small" sx={fieldSx} value={filters.payee} onChange={(event) => updateFilter('payee', event.target.value)} />
          <TextField label="Check Number" size="small" sx={fieldSx} value={filters.check_number} onChange={(event) => updateFilter('check_number', event.target.value)} />
          <TextField label="DV Number" size="small" sx={fieldSx} value={filters.dv_number} onChange={(event) => updateFilter('dv_number', event.target.value)} />
          <FormControl size="small" sx={fieldSx}>
            <InputLabel>Sort By</InputLabel>
            <Select label="Sort By" value={filters.sort_by} onChange={(event) => updateFilter('sort_by', event.target.value)}>
              <MenuItem value="check_date">Check Date</MenuItem>
              <MenuItem value="check_number">Check Number</MenuItem>
              <MenuItem value="dv_number">DV Number</MenuItem>
              <MenuItem value="fund_type">Fund Type</MenuItem>
              <MenuItem value="bank_name">Bank</MenuItem>
              <MenuItem value="payee">Payee</MenuItem>
              <MenuItem value="dv_amount">DV Amount</MenuItem>
              <MenuItem value="status">Status</MenuItem>
              <MenuItem value="report_number">Report Number</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={fieldSx}>
            <InputLabel>Sort Direction</InputLabel>
            <Select label="Sort Direction" value={filters.sort_dir} onChange={(event) => updateFilter('sort_dir', event.target.value)}>
              <MenuItem value="desc">Newest / Highest first</MenuItem>
              <MenuItem value="asc">Oldest / Lowest first</MenuItem>
            </Select>
          </FormControl>
          <TextField
            InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
            label="Search"
            size="small"
            sx={{ ...fieldSx, gridColumn: { md: 'span 2' } }}
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
          />
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 2 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 950 }}>Check Records</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 13 }}>{summary ? `${summary.total_issued_checks} issued check(s), ${records.length} row(s) loaded` : 'Loading records...'}</Typography>
        </Box>
        <TableContainer sx={{ maxHeight: 620 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1280 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={headerCellSx}>Check Date</TableCell>
                <TableCell sx={headerCellSx}>Check No.</TableCell>
                <TableCell sx={headerCellSx}>DV No.</TableCell>
                <TableCell sx={headerCellSx}>Fund</TableCell>
                <TableCell sx={headerCellSx}>Bank</TableCell>
                <TableCell sx={headerCellSx}>Payee</TableCell>
                <TableCell sx={headerCellSx}>Nature of Payment</TableCell>
                <TableCell align="right" sx={headerCellSx}>DV Amount</TableCell>
                <TableCell sx={headerCellSx}>Report / Sheet</TableCell>
                <TableCell sx={headerCellSx}>Status</TableCell>
                <TableCell align="center" sx={headerCellSx}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedRecords.map((record) => (
                <TableRow hover key={record.id}>
                  <TableCell>{record.check_date || '-'}</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>{record.check_number || '-'}</TableCell>
                  <TableCell>{record.dv_number || '-'}</TableCell>
                  <TableCell>{record.fund_type || '-'}</TableCell>
                  <TableCell>{record.bank_name || '-'}</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>{record.payee || '-'}</TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>{record.nature_of_payment || '-'}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 950 }}>{formatMoney(record.dv_amount || 0)}</TableCell>
                  <TableCell>{record.report_number || '-'} / {record.sheet_number || '-'}</TableCell>
                  <TableCell><Chip color={statusColor(record.status)} label={record.status} size="small" sx={{ fontWeight: 900 }} /></TableCell>
                  <TableCell align="center">
                    <IconButton onClick={(event) => { setMenuAnchor(event.currentTarget); setMenuRecord(record) }} size="small">
                      <MoreVertical size={18} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!pagedRecords.length && (
                <TableRow>
                  <TableCell align="center" colSpan={11} sx={{ color: '#64748b', py: 5 }}>
                    No check records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={summary ? Number(summary.total_records || 0) || records.length : records.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[15, 25, 50, 100]}
          onPageChange={(_, next) => setPage(next)}
          onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0) }}
        />
      </Paper>

      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, p: 2 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 950, mb: 1.5 }}>Fund Subtotals</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={headerCellSx}>Fund Type</TableCell>
                <TableCell align="right" sx={headerCellSx}>Issued Checks</TableCell>
                <TableCell align="right" sx={headerCellSx}>Subtotal</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(summary?.fund_subtotals || []).map((row) => (
                <TableRow key={row.fund_type}>
                  <TableCell sx={{ fontWeight: 900 }}>{row.fund_type}</TableCell>
                  <TableCell align="right">{row.issued_checks}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 950 }}>{formatMoney(row.issued_amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ fontWeight: 950 }}>Grand Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 950 }}>{summary?.total_issued_checks || 0}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 950 }}>{formatMoney(summary?.grand_total || 0)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => { setMenuAnchor(null); setMenuRecord(null) }}>
        <MenuItem onClick={() => { setViewRecord(menuRecord); setMenuAnchor(null) }}><Eye size={16} />&nbsp;View</MenuItem>
        {canManage && <MenuItem onClick={() => openEdit(menuRecord)}><Pencil size={16} />&nbsp;Edit</MenuItem>}
        {canManage && <MenuItem onClick={() => { setStatusAction({ record: menuRecord, status: 'Voided', remarks: menuRecord?.remarks || '' }); setMenuAnchor(null) }}><Ban size={16} />&nbsp;Void</MenuItem>}
        {canManage && <MenuItem onClick={() => { setStatusAction({ record: menuRecord, status: 'Cancelled', remarks: menuRecord?.remarks || '' }); setMenuAnchor(null) }}><X size={16} />&nbsp;Cancel</MenuItem>}
        {canManage && <MenuItem sx={{ color: '#dc2626' }} onClick={() => { setConfirmDelete(menuRecord); setMenuAnchor(null) }}><Trash2 size={16} />&nbsp;Delete</MenuItem>}
      </Menu>

      <Dialog fullWidth maxWidth="lg" open={dialogOpen} onClose={closeForm}>
        <Box component="form" onSubmit={saveRecord}>
          <DialogTitle sx={{ alignItems: 'center', bgcolor: '#10233f', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase' }}>Report of Checks Issued</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 950 }}>{editing ? 'Update Check Record' : 'Add Check Record'}</Typography>
            </Box>
            <IconButton onClick={closeForm} sx={{ color: '#fff' }}><X size={20} /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ bgcolor: '#f8fafc', display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, pt: 3 }}>
            {possibleDuplicate && (
              <Alert severity="warning" sx={{ gridColumn: '1 / -1' }}>
                Possible duplicate: same payee, amount, date, and nature of payment.
              </Alert>
            )}
            <TextField InputLabelProps={{ shrink: true }} error={Boolean(fieldErrors.check_date)} helperText={fieldErrors.check_date?.[0]} label="Check Date *" onChange={(event) => updateForm('check_date', event.target.value)} size="small" sx={fieldSx} type="date" value={form.check_date || ''} />
            <TextField error={Boolean(fieldErrors.check_number)} helperText={fieldErrors.check_number?.[0]} label="Check Number *" onChange={(event) => updateForm('check_number', event.target.value)} size="small" sx={fieldSx} value={form.check_number || ''} />
            <TextField error={Boolean(fieldErrors.dv_number)} helperText={fieldErrors.dv_number?.[0]} label="DV Number *" onChange={(event) => updateForm('dv_number', event.target.value)} size="small" sx={fieldSx} value={form.dv_number || ''} />
            <FormControl error={Boolean(fieldErrors.fund_type)} size="small" sx={fieldSx}>
              <InputLabel>Fund/Account Type *</InputLabel>
              <Select label="Fund/Account Type *" value={form.fund_type || ''} onChange={(event) => updateForm('fund_type', event.target.value)}>
                {fundTypes.map((fund) => <MenuItem key={fund} value={fund}>{fund}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Bank Name" onChange={(event) => updateForm('bank_name', event.target.value)} size="small" sx={fieldSx} value={form.bank_name || ''} />
            <TextField label="Bank Account Number" onChange={(event) => updateForm('bank_account_number', event.target.value)} size="small" sx={fieldSx} value={form.bank_account_number || ''} />
            <TextField error={Boolean(fieldErrors.payee)} helperText={fieldErrors.payee?.[0]} label="Payee *" onChange={(event) => updateForm('payee', event.target.value)} size="small" sx={{ ...fieldSx, gridColumn: { md: 'span 2' } }} value={form.payee || ''} />
            <TextField error={Boolean(fieldErrors.dv_amount)} helperText={fieldErrors.dv_amount?.[0]} inputProps={{ min: 0, step: '0.01' }} label="DV Amount *" onChange={(event) => updateForm('dv_amount', event.target.value)} size="small" sx={fieldSx} type="number" value={form.dv_amount || ''} />
            <TextField error={Boolean(fieldErrors.nature_of_payment)} helperText={fieldErrors.nature_of_payment?.[0]} label="Nature of Payment *" minRows={3} multiline onChange={(event) => updateForm('nature_of_payment', event.target.value)} sx={{ ...fieldSx, gridColumn: '1 / -1' }} value={form.nature_of_payment || ''} />
            <TextField label="Report Number" onChange={(event) => updateForm('report_number', event.target.value)} size="small" sx={fieldSx} value={form.report_number || ''} />
            <TextField label="Sheet Number" onChange={(event) => updateForm('sheet_number', event.target.value)} size="small" sx={fieldSx} type="number" value={form.sheet_number || ''} />
            <FormControl size="small" sx={fieldSx}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                {statuses.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Reporting Month" size="small" sx={fieldSx} type="number" value={form.reporting_month || ''} onChange={(event) => updateForm('reporting_month', event.target.value)} />
            <TextField label="Reporting Year" size="small" sx={fieldSx} type="number" value={form.reporting_year || ''} onChange={(event) => updateForm('reporting_year', event.target.value)} />
            <TextField error={Boolean(fieldErrors.remarks)} helperText={fieldErrors.remarks?.[0] || 'Required when status is Cancelled or Voided.'} label="Remarks" minRows={3} multiline onChange={(event) => updateForm('remarks', event.target.value)} sx={{ ...fieldSx, gridColumn: '1 / -1' }} value={form.remarks || ''} />
          </DialogContent>
          <DialogActions sx={{ bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', p: 2 }}>
            <Button disabled={saving} onClick={closeForm}>Close</Button>
            <Button disabled={saving} startIcon={<Save size={16} />} type="submit" variant="contained">
              {saving ? 'Saving...' : 'Save Check Record'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog fullWidth maxWidth="md" open={Boolean(viewRecord)} onClose={() => setViewRecord(null)}>
        <DialogTitle>Check Record Details</DialogTitle>
        <DialogContent dividers>
          {viewRecord && (
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {Object.entries(viewRecord).filter(([key]) => !key.endsWith('_by')).map(([key, value]) => (
                <Box key={key} sx={{ borderBottom: '1px solid #e2e8f0', py: 1 }}>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>{key.replaceAll('_', ' ')}</Typography>
                  <Typography sx={{ fontWeight: 800 }}>{key === 'dv_amount' ? formatMoney(value || 0) : (value || '-')}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewRecord(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="sm" open={Boolean(statusAction)} onClose={() => setStatusAction(null)}>
        <DialogTitle>Confirm {statusAction?.status}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>Remarks are required before a check can be {statusAction?.status?.toLowerCase()}.</Alert>
          <TextField fullWidth label="Remarks" minRows={4} multiline value={statusAction?.remarks || ''} onChange={(event) => setStatusAction((current) => ({ ...current, remarks: event.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setStatusAction(null)}>Close</Button>
          <Button disabled={saving || !statusAction?.remarks} onClick={changeStatus} variant="contained">Confirm</Button>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="xs" open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete Check Record?</DialogTitle>
        <DialogContent>
          <Typography>This will soft-delete the record and keep audit history. Continue?</Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button color="error" disabled={saving} onClick={deleteRecord} variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog fullScreen open={printOpen} onClose={() => setPrintOpen(false)}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between' }}>
          Print Preview
          <Stack direction="row" spacing={1}>
            <Button onClick={() => window.print()} startIcon={<Printer size={16} />} variant="contained">Print / Save PDF</Button>
            <IconButton onClick={() => setPrintOpen(false)}><X size={20} /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ '@media print': { '.no-print': { display: 'none' } } }}>
            {Object.entries(printableByFund).map(([fund, rows]) => (
              <Box key={fund} sx={{ breakAfter: 'page', mb: 4 }}>
                <Typography align="center" sx={{ fontWeight: 950, fontSize: 18 }}>REPORT OF CHECKS ISSUED</Typography>
                <Typography align="center">Zamboanguita, Negros Oriental</Typography>
                <Typography align="center">LGU</Typography>
                <Typography align="center">{monthName(filters.reporting_month)} 1-31, {filters.reporting_year}</Typography>
                <Typography sx={{ fontWeight: 950, mt: 3 }}>{fund}</Typography>
                <Typography>Report No.: {rows[0]?.report_number || '____'} &nbsp;&nbsp; Sheet No.: {rows[0]?.sheet_number || '____'}</Typography>
                <Typography>Bank Name/Account No.: {rows[0]?.bank_name || '____'} / {rows[0]?.bank_account_number || '____'}</Typography>
                <Table size="small" sx={{ mt: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Check Date</TableCell>
                      <TableCell>No.</TableCell>
                      <TableCell>DV Number</TableCell>
                      <TableCell>Payee</TableCell>
                      <TableCell>Nature of Payment</TableCell>
                      <TableCell align="right">DV Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.check_date}</TableCell>
                        <TableCell>{row.check_number}</TableCell>
                        <TableCell>{row.dv_number}</TableCell>
                        <TableCell>{row.payee}</TableCell>
                        <TableCell>{row.nature_of_payment}</TableCell>
                        <TableCell align="right">{formatMoney(row.dv_amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell align="center" colSpan={5} sx={{ fontStyle: 'italic' }}>nothing follows</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 950 }}>{formatMoney(rows.reduce((sum, row) => sum + Number(row.dv_amount || 0), 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>
            ))}
            {!printableRows.length && <Typography>No issued checks to print.</Typography>}
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar autoHideDuration={3500} open={Boolean(success)} onClose={() => setSuccess('')}>
        <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
      </Snackbar>
    </Box>
  )
}
