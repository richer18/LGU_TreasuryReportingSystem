import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import CloseIcon from '@mui/icons-material/Close'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import SearchIcon from '@mui/icons-material/Search'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import axiosInstance from '../../axiosinstance/axiosInstance'

const colors = {
  navy: 'var(--color-text-strong)',
  teal: 'var(--color-primary)',
  tealHover: 'var(--color-primary-dark)',
  steel: 'var(--color-muted)',
  border: 'var(--color-border)',
  bg: 'var(--color-bg)',
}

const todayValue = () => new Date().toISOString().slice(0, 10)

const firstDayOfYear = () => {
  const now = new Date()
  return `${now.getFullYear()}-01-01`
}

const formatPeso = (value) => Number(value || 0).toLocaleString('en-PH', {
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: 'currency',
})

const countReceiptRange = (from, to) => {
  const start = Number(String(from || '').replace(/\D/g, ''))
  const end = Number(String(to || '').replace(/\D/g, ''))
  if (!start || !end || end < start) return 0
  return end - start + 1
}

const statusColor = (status) => {
  if (status === 'Remitted to ACO') return { bg: 'var(--color-primary-soft)', color: 'var(--color-primary)' }
  if (status === 'Received by ACO') return { bg: 'var(--color-success-soft)', color: 'var(--color-success-dark)' }
  if (status === 'With Variance') return { bg: 'var(--color-warning-soft)', color: 'var(--color-warning-dark)' }
  if (['Voided', 'Cancelled'].includes(status)) return { bg: 'var(--color-danger-soft)', color: 'var(--color-danger-dark)' }
  if (status === 'Printed') return { bg: 'var(--color-secondary-soft)', color: 'var(--color-primary)' }
  return { bg: 'rgba(107, 114, 128, 0.12)', color: colors.steel }
}

function StatusChip({ value }) {
  const meta = statusColor(value)
  return <Chip label={value || '-'} size="small" sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 900 }} />
}

const emptyReceiveForm = (userName = '') => ({
  amountReceived: 0,
  cashAmount: 0,
  checkAmount: 0,
  referenceNo: '',
  receivedByAco: userName,
  receivedAt: `${todayValue()}T${new Date().toTimeString().slice(0, 5)}`,
  remarks: '',
  confirmed: false,
})

export function AcoDashboardPage({ user }) {
  const [activeTab, setActiveTab] = useState('remittances')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    dateFrom: firstDayOfYear(),
    dateTo: todayValue(),
    collector: '',
    status: '',
    fund: '',
    form: '',
    search: '',
  })
  const [menuAnchor, setMenuAnchor] = useState(null)
  const [menuRow, setMenuRow] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedBatch, setSelectedBatch] = useState(null)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveForm, setReceiveForm] = useState(emptyReceiveForm(user?.name || ''))
  const [receiveMessage, setReceiveMessage] = useState('')
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditRows, setAuditRows] = useState([])

  const loadRows = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await axiosInstance.get('/rcd/batches')
      setRows(response.data?.data || [])
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to load ACO remittances.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return rows.filter((row) => {
      const rowDate = String(row.date || '').slice(0, 10)
      if (filters.dateFrom && rowDate < filters.dateFrom) return false
      if (filters.dateTo && rowDate > filters.dateTo) return false
      if (filters.collector && !String(row.collector || '').toLowerCase().includes(filters.collector.toLowerCase())) return false
      if (filters.status && row.stage !== filters.status) return false
      if (filters.fund && !String(row.fund || '').toLowerCase().includes(filters.fund.toLowerCase())) return false
      if (filters.form && !String(row.forms || '').toLowerCase().includes(filters.form.toLowerCase())) return false
      if (!search) return true
      return [row.id, row.action_key, row.collector, row.forms, row.fund, row.stage].join(' ').toLowerCase().includes(search)
    })
  }, [filters, rows])

  const summary = useMemo(() => {
    const today = todayValue()
    return filteredRows.reduce((acc, row) => {
      const total = Number(row.total || 0)
      if (row.stage === 'Remitted to ACO' || row.stage === 'For Remittance' || row.stage === 'Saved') acc.pending += 1
      if (row.stage === 'Received by ACO' && String(row.updated_at || row.created_at || row.date).startsWith(today)) acc.receivedToday += total
      if (row.stage === 'With Variance' || Number(row.variance_amount || 0) !== 0) acc.withVariance += 1
      if (['Voided', 'Cancelled'].includes(row.stage)) acc.voided += 1
      acc.orCount += Number(row.receipt_count || 0)
      acc.totalReceived += row.stage === 'Received by ACO' ? total : 0
      return acc
    }, { pending: 0, receivedToday: 0, totalReceived: 0, withVariance: 0, voided: 0, orCount: 0 })
  }, [filteredRows])

  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }))

  const closeMenu = () => {
    setMenuAnchor(null)
    setMenuRow(null)
  }

  const openMenu = (event, row) => {
    setMenuAnchor(event.currentTarget)
    setMenuRow(row)
  }

  const loadBatch = async (row) => {
    const response = await axiosInstance.get(`/rcd/batches/${encodeURIComponent(row.action_key || row.id)}`)
    return response.data?.data
  }

  const viewDetails = async (row) => {
    closeMenu()
    setLoading(true)
    try {
      setSelectedBatch(await loadBatch(row))
      setDetailsOpen(true)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to load RCD details.')
    } finally {
      setLoading(false)
    }
  }

  const openReceive = async (row) => {
    closeMenu()
    setLoading(true)
    setReceiveMessage('')
    try {
      const batch = await loadBatch(row)
      setSelectedBatch(batch)
      const total = Number(batch?.total || 0)
      setReceiveForm({
        ...emptyReceiveForm(user?.name || ''),
        amountReceived: total,
        cashAmount: total,
      })
      setReceiveOpen(true)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to load receive remittance form.')
    } finally {
      setLoading(false)
    }
  }

  const submitReceive = async () => {
    if (!selectedBatch) return
    const total = Number(selectedBatch.total || 0)
    const amountReceived = Number(receiveForm.amountReceived || 0)
    const cashPlusCheck = Number(receiveForm.cashAmount || 0) + Number(receiveForm.checkAmount || 0)
    const variance = total - amountReceived

    if (amountReceived <= 0) {
      setReceiveMessage('Amount received must be greater than zero.')
      return
    }
    if (Math.round(cashPlusCheck * 100) !== Math.round(amountReceived * 100)) {
      setReceiveMessage('Cash amount plus check amount must equal amount received.')
      return
    }
    if (Math.round(variance * 100) !== 0 && !receiveForm.remarks.trim()) {
      setReceiveMessage('Variance requires remarks.')
      return
    }
    if (!receiveForm.confirmed) {
      setReceiveMessage('Please check the confirmation checkbox.')
      return
    }

    setLoading(true)
    setReceiveMessage('')
    try {
      await axiosInstance.post(`/rcd/batches/${encodeURIComponent(selectedBatch.action_key || selectedBatch.id)}/receive`, {
        amount_received: amountReceived,
        cash_amount: Number(receiveForm.cashAmount || 0),
        check_amount: Number(receiveForm.checkAmount || 0),
        reference_no: receiveForm.referenceNo,
        received_by_aco: receiveForm.receivedByAco,
        received_by_aco_at: receiveForm.receivedAt,
        remittance_remarks: receiveForm.remarks,
        confirmed: receiveForm.confirmed,
      })
      setReceiveOpen(false)
      setSelectedBatch(null)
      await loadRows()
    } catch (err) {
      const errors = err.response?.data?.errors
      setReceiveMessage(Array.isArray(errors) ? errors.join(' ') : err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to receive remittance.')
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = async (row) => {
    closeMenu()
    try {
      const response = await axiosInstance.get(`/rcd/batches/${encodeURIComponent(row.action_key || row.id)}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `${String(row.collector || 'RCD').replace(/[^A-Za-z0-9-]+/g, '_')}_${row.date || todayValue()}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      await loadRows()
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to download report.')
    }
  }

  const loadAudit = async (row) => {
    closeMenu()
    setLoading(true)
    try {
      const response = await axiosInstance.get(`/rcd/batches/${encodeURIComponent(row.action_key || row.id)}/audit`)
      setAuditRows(response.data?.data || [])
      setSelectedBatch(row)
      setAuditOpen(true)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to load audit trail.')
    } finally {
      setLoading(false)
    }
  }

  const actionsForRow = (row) => {
    if (['Voided', 'Cancelled'].includes(row.stage)) {
      return [
        { label: 'View Details', action: () => viewDetails(row) },
        { label: 'Audit Trail', action: () => loadAudit(row) },
      ]
    }
    if (row.stage === 'Remitted to ACO') {
      return [
        { label: 'View Details', action: () => viewDetails(row) },
        { label: 'Receive Remittance', action: () => openReceive(row), accent: true },
        { label: 'Print Preview', action: () => downloadReport(row) },
        { label: 'Audit Trail', action: () => loadAudit(row) },
      ]
    }
    if (row.stage === 'Received by ACO' || row.stage === 'Printed') {
      return [
        { label: 'View Details', action: () => viewDetails(row) },
        { label: row.stage === 'Printed' ? 'Reprint' : 'Print', action: () => downloadReport(row) },
        { label: 'Download PDF', action: () => downloadReport(row) },
        { label: 'Audit Trail', action: () => loadAudit(row) },
        { label: 'Void / Cancel with reason', action: () => setError('Void / Cancel with reason is prepared for the next control step.'), danger: true },
      ]
    }
    if (row.stage === 'With Variance') {
      return [
        { label: 'View Details', action: () => viewDetails(row) },
        { label: 'Resolve Variance', action: () => openReceive(row), accent: true },
        { label: 'Audit Trail', action: () => loadAudit(row) },
        { label: 'Void / Cancel with reason', action: () => setError('Void / Cancel with reason is prepared for the next control step.'), danger: true },
      ]
    }
    return [
      { label: 'View Details', action: () => viewDetails(row) },
      { label: 'Audit Trail', action: () => loadAudit(row) },
    ]
  }

  const activeActions = menuRow ? actionsForRow(menuRow) : []
  const varianceAmount = selectedBatch ? Number(selectedBatch.total || 0) - Number(receiveForm.amountReceived || 0) : 0

  return (
    <Box sx={{ bgcolor: colors.bg, display: 'grid', gap: 3, minHeight: '100%', p: { xs: 1, md: 0 } }}>
      <Paper sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
        <Box sx={{ alignItems: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="overline" sx={{ color: colors.teal, fontWeight: 900 }}>Accountable Officer Control</Typography>
            <Typography variant="h4" sx={{ color: colors.navy, fontWeight: 950, lineHeight: 1.1 }}>ACO Dashboard</Typography>
            <Typography sx={{ color: colors.steel, fontWeight: 700, mt: 0.5 }}>Monitor collector remittances, verify RCD totals, and receive turn-over collections.</Typography>
          </Box>
          <Button disabled={loading} onClick={loadRows} startIcon={loading ? <CircularProgress size={16} /> : <VerifiedUserIcon />} sx={{ bgcolor: colors.teal, borderRadius: 2, color: '#fff', fontWeight: 900, minHeight: 42, textTransform: 'none', '&:hover': { bgcolor: colors.tealHover } }} variant="contained">Refresh</Button>
        </Box>
        {error && <Alert onClose={() => setError('')} severity="warning" sx={{ mt: 2 }}>{error}</Alert>}
      </Paper>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(6, 1fr)' } }}>
        {[
          ['Pending Remittances', summary.pending],
          ['Received Today', formatPeso(summary.receivedToday)],
          ['Total Amount Received', formatPeso(summary.totalReceived)],
          ['With Variance', summary.withVariance],
          ['Voided / Cancelled', summary.voided],
          ['Total OR Count', summary.orCount],
        ].map(([label, value]) => (
          <Card key={label} sx={{ border: `1px solid ${colors.border}`, borderRadius: 2, boxShadow: '0 10px 24px rgba(15,39,71,0.08)', p: 2 }}>
            <Typography sx={{ color: colors.steel, fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>{label}</Typography>
            <Typography variant="h6" sx={{ color: colors.navy, fontWeight: 950, mt: 1 }}>{value}</Typography>
          </Card>
        ))}
      </Box>

      <Paper sx={{ border: `1px solid ${colors.border}`, borderRadius: 3 }}>
        <Tabs onChange={(_, value) => setActiveTab(value)} value={activeTab}>
          <Tab label="Remittances" value="remittances" />
          <Tab label="Accountable Forms" value="forms" />
          <Tab label="Audit Trail" value="audit" />
          <Tab label="Reports" value="reports" />
        </Tabs>
      </Paper>

      {activeTab === 'remittances' && (
        <>
          <Paper sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(6, 1fr)' } }}>
              <TextField InputLabelProps={{ shrink: true }} label="Date From" onChange={(event) => updateFilter('dateFrom', event.target.value)} size="small" type="date" value={filters.dateFrom} />
              <TextField InputLabelProps={{ shrink: true }} label="Date To" onChange={(event) => updateFilter('dateTo', event.target.value)} size="small" type="date" value={filters.dateTo} />
              <TextField label="Collector" onChange={(event) => updateFilter('collector', event.target.value)} size="small" value={filters.collector} />
              <TextField label="Status" onChange={(event) => updateFilter('status', event.target.value)} select size="small" value={filters.status}>
                <MenuItem value="">All statuses</MenuItem>
                {['Draft', 'For Remittance', 'Remitted to ACO', 'Received by ACO', 'With Variance', 'Printed', 'Voided', 'Cancelled', 'Saved'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
              </TextField>
              <TextField label="Fund Type" onChange={(event) => updateFilter('fund', event.target.value)} size="small" value={filters.fund} />
              <TextField InputProps={{ startAdornment: <SearchIcon sx={{ color: colors.steel, mr: 1 }} /> }} label="Search RCD / OR / Collector" onChange={(event) => updateFilter('search', event.target.value)} size="small" value={filters.search} />
            </Box>
          </Paper>

          <TableContainer component={Paper} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3 }}>
            <Table sx={{ minWidth: 1260 }}>
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#f7f9fc', color: colors.navy, fontWeight: 900, textTransform: 'uppercase' } }}>
                  <TableCell>RCD No.</TableCell>
                  <TableCell>Collection Date</TableCell>
                  <TableCell>Remittance Date</TableCell>
                  <TableCell>Collector</TableCell>
                  <TableCell>Fund</TableCell>
                  <TableCell>Forms</TableCell>
                  <TableCell>OR Range</TableCell>
                  <TableCell align="center">OR Count</TableCell>
                  <TableCell align="right">Total Collection</TableCell>
                  <TableCell align="right">Amount Remitted</TableCell>
                  <TableCell align="right">Variance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow><TableCell align="center" colSpan={13} sx={{ color: colors.steel, fontWeight: 800, py: 5 }}>No collector remittances found.</TableCell></TableRow>
                ) : filteredRows.map((row) => (
                  <TableRow hover key={row.action_key || row.db_id}>
                    <TableCell sx={{ fontWeight: 900 }}>{row.id}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.remitted_to_aco_at || row.updated_at || '-'}</TableCell>
                    <TableCell>{row.collector}</TableCell>
                    <TableCell>{row.fund}</TableCell>
                    <TableCell>{row.forms}</TableCell>
                    <TableCell>{row.receipt_no_from && row.receipt_no_to ? `${row.receipt_no_from} - ${row.receipt_no_to}` : '-'}</TableCell>
                    <TableCell align="center">{row.receipt_count || 0}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900 }}>{formatPeso(row.total)}</TableCell>
                    <TableCell align="right">{formatPeso(row.amount_remitted || row.total)}</TableCell>
                    <TableCell align="right">{formatPeso(row.variance_amount || 0)}</TableCell>
                    <TableCell><StatusChip value={row.stage} /></TableCell>
                    <TableCell align="center">
                      <Button endIcon={<MoreVertIcon />} onClick={(event) => openMenu(event, row)} size="small" sx={{ borderColor: `${colors.navy}33`, borderRadius: 2, color: colors.navy, fontWeight: 900, textTransform: 'none' }} variant="outlined">Actions</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {activeTab !== 'remittances' && (
        <Paper sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 3 }}>
          <Typography variant="h6" sx={{ color: colors.navy, fontWeight: 900 }}>{activeTab === 'forms' ? 'Accountable Forms Tracking' : activeTab === 'audit' ? 'Audit Trail' : 'Reports'}</Typography>
          <Typography sx={{ color: colors.steel, mt: 1 }}>This tab is prepared for Phase 2 after the ACO remittance workflow is stable.</Typography>
        </Paper>
      )}

      <Menu anchorEl={menuAnchor} onClose={closeMenu} open={Boolean(menuAnchor)}>
        {activeActions.map((item) => (
          <MenuItem key={item.label} onClick={item.action} sx={{ color: item.danger ? 'var(--color-danger-dark)' : item.accent ? colors.teal : colors.navy, fontWeight: item.accent || item.danger ? 900 : 700, minWidth: 220 }}>
            {item.label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog fullWidth maxWidth="lg" onClose={() => setDetailsOpen(false)} open={detailsOpen}>
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ color: colors.navy, fontWeight: 900 }}>RCD Details</Typography>
            <Typography sx={{ color: colors.steel }}>{selectedBatch?.id || '-'}</Typography>
          </Box>
          <IconButton onClick={() => setDetailsOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
              <TextField InputProps={{ readOnly: true }} label="Collector" value={selectedBatch?.collector || '-'} />
              <TextField InputProps={{ readOnly: true }} label="Collection Date" value={selectedBatch?.date || '-'} />
              <TextField InputProps={{ readOnly: true }} label="Status" value={selectedBatch?.status || '-'} />
              <TextField InputProps={{ readOnly: true }} label="Total Amount" value={formatPeso(selectedBatch?.total)} />
            </Box>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead><TableRow><TableCell>Form Type</TableCell><TableCell>OR From</TableCell><TableCell>OR To</TableCell><TableCell align="center">OR Count</TableCell><TableCell align="right">Amount</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                <TableBody>
                  {(selectedBatch?.lines || []).map((line, index) => (
                    <TableRow key={`${line.receiptFrom}-${index}`}>
                      <TableCell>{line.formType}</TableCell>
                      <TableCell>{line.receiptFrom}</TableCell>
                      <TableCell>{line.receiptTo}</TableCell>
                      <TableCell align="center">{countReceiptRange(line.receiptFrom, line.receiptTo)}</TableCell>
                      <TableCell align="right">{formatPeso(line.collectorAmount)}</TableCell>
                      <TableCell>{line.validationStatus || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailsOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="sm" onClose={() => setReceiveOpen(false)} open={receiveOpen}>
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ color: colors.navy, fontWeight: 900 }}>Receive Remittance</Typography>
            <Typography sx={{ color: colors.steel }}>{selectedBatch?.id || '-'}</Typography>
          </Box>
          <IconButton onClick={() => setReceiveOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {receiveMessage && <Alert severity="error" sx={{ mb: 2 }}>{receiveMessage}</Alert>}
          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField InputProps={{ readOnly: true }} label="Collector Name" value={selectedBatch?.collector || '-'} />
            <TextField InputProps={{ readOnly: true }} label="Total Collection Amount" value={formatPeso(selectedBatch?.total)} />
            <TextField InputProps={{ readOnly: true }} label="Amount Remitted by Collector" value={formatPeso(selectedBatch?.amount_remitted || selectedBatch?.total)} />
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <TextField label="Amount Received by ACO" onChange={(event) => setReceiveForm((current) => ({ ...current, amountReceived: Number(event.target.value || 0) }))} type="number" value={receiveForm.amountReceived} />
              <TextField InputProps={{ readOnly: true }} label="Variance Amount" value={formatPeso(varianceAmount)} />
              <TextField label="Cash Amount" onChange={(event) => setReceiveForm((current) => ({ ...current, cashAmount: Number(event.target.value || 0) }))} type="number" value={receiveForm.cashAmount} />
              <TextField label="Check Amount" onChange={(event) => setReceiveForm((current) => ({ ...current, checkAmount: Number(event.target.value || 0) }))} type="number" value={receiveForm.checkAmount} />
              <TextField label="Reference No." onChange={(event) => setReceiveForm((current) => ({ ...current, referenceNo: event.target.value }))} value={receiveForm.referenceNo} />
              <TextField label="Received By ACO" onChange={(event) => setReceiveForm((current) => ({ ...current, receivedByAco: event.target.value }))} value={receiveForm.receivedByAco} />
            </Box>
            <TextField InputLabelProps={{ shrink: true }} label="Received Date/Time" onChange={(event) => setReceiveForm((current) => ({ ...current, receivedAt: event.target.value }))} type="datetime-local" value={receiveForm.receivedAt} />
            <TextField label="Remarks" minRows={3} multiline onChange={(event) => setReceiveForm((current) => ({ ...current, remarks: event.target.value }))} value={receiveForm.remarks} />
            <FormControlLabel control={<Checkbox checked={receiveForm.confirmed} onChange={(event) => setReceiveForm((current) => ({ ...current, confirmed: event.target.checked }))} />} label="I confirm that I received and verified this remittance." />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReceiveOpen(false)}>Cancel</Button>
          <Button disabled={loading} onClick={submitReceive} startIcon={loading ? <CircularProgress color="inherit" size={16} /> : <AssignmentTurnedInIcon />} sx={{ bgcolor: colors.teal, color: '#fff', fontWeight: 900, textTransform: 'none', '&:hover': { bgcolor: colors.tealHover } }} variant="contained">Confirm Receive</Button>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="md" onClose={() => setAuditOpen(false)} open={auditOpen}>
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ color: colors.navy, fontWeight: 900 }}>Audit Trail</Typography>
            <Typography sx={{ color: colors.steel }}>{selectedBatch?.id || '-'}</Typography>
          </Box>
          <IconButton onClick={() => setAuditOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead><TableRow><TableCell>Action</TableCell><TableCell>By</TableCell><TableCell>Date</TableCell><TableCell>Details</TableCell></TableRow></TableHead>
              <TableBody>
                {auditRows.length === 0 ? (
                  <TableRow><TableCell align="center" colSpan={4}>No audit records found.</TableCell></TableRow>
                ) : auditRows.map((row, index) => (
                  <TableRow key={`${row.action}-${index}`}>
                    <TableCell sx={{ fontWeight: 900 }}>{row.action}</TableCell>
                    <TableCell>{row.performed_by || '-'}</TableCell>
                    <TableCell>{row.created_at || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{typeof row.details === 'string' ? row.details : JSON.stringify(row.details, null, 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions><Button onClick={() => setAuditOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  )
}
