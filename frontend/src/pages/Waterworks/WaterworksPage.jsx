import { useEffect, useMemo, useState } from 'react'
import {
  Autocomplete,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import {
  ClipboardList,
  Droplets,
  Download,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  TicketCheck,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'

import axiosInstance from '../../axiosinstance/axiosInstance'
import { formatMoney } from '../GeneralFund/utils/generalFundFormat'

const todayValue = () => new Date().toISOString().slice(0, 10)
const monthStart = () => todayValue().slice(0, 8) + '01'

const cashierOptions = [
  { value: '', label: 'Select cashier' },
  { value: 'flora', label: 'FLORA MY D. FERRER' },
  { value: 'iris', label: 'ANGELIQUE IRIS A. RAFALES' },
  { value: 'ricardo', label: 'RICARDO T. ENOPIA' },
  { value: 'agnes', label: 'AGNES B. ELLO' },
  { value: 'amabella', label: 'AMABELLA S. RAMOS' },
  { value: 'emily', label: 'EMILY E. CREDO' },
]

const colors = {
  blue: '#0f5af2',
  navy: '#0f172a',
  slate: '#64748b',
  border: '#dbe3ef',
  soft: '#f6f8fc',
  green: '#15803d',
  teal: '#0f766e',
  amber: '#b45309',
  red: '#b91c1c',
  panel: '#ffffff',
  wash: '#eef6ff',
}

const emptyEntry = {
  date: todayValue(),
  account_number: '',
  taxpayer_name: '',
  receipt_no: '',
  cashier: '',
  local_tin: '',
  payment_id: '',
}

const emptyAccount = {
  permittee_name: '',
  account_number: '',
  meter_number: '',
  connection_type: '',
  address: '',
  local_tin: '',
}

const emptyTicket = {
  taxpayer_name: '',
  local_tin: '',
  account_number: '',
  meter_number: '',
  concern_type: 'Billing',
  priority: 'Normal',
  assigned_to: '',
  description: '',
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#fff',
    borderRadius: '10px',
  },
  '& .MuiInputLabel-root': {
    color: colors.slate,
    fontSize: 13,
    fontWeight: 800,
  },
}

function KpiCard({ icon: Icon, label, value, tone = colors.blue }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${colors.border}`,
        borderRadius: 3,
        minHeight: 128,
        p: 2.2,
        background: `linear-gradient(135deg, ${tone}, ${tone}dd)`,
        color: '#fff',
        boxShadow: '0 14px 30px rgba(15, 23, 42, 0.12)',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        '&:hover': {
          borderColor: `${tone}66`,
          boxShadow: '0 18px 38px rgba(15,23,42,0.18)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Stack spacing={1.1}>
        <Box sx={{ alignItems: 'center', bgcolor: 'rgba(255,255,255,0.18)', borderRadius: 2, color: '#fff', display: 'inline-flex', height: 38, justifyContent: 'center', width: 38 }}>
          <Icon size={21} />
        </Box>
        <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: 950, textTransform: 'uppercase' }}>
          {label}
        </Typography>
        <Typography sx={{ color: '#fff', fontSize: 27, fontWeight: 950, lineHeight: 1.05 }}>
          {value}
        </Typography>
      </Stack>
    </Paper>
  )
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function WaterworksPage({ user }) {
  const [activeTab, setActiveTab] = useState('payments')
  const [payments, setPayments] = useState([])
  const [tickets, setTickets] = useState([])
  const [summary, setSummary] = useState({})
  const [meta, setMeta] = useState({})
  const [filters, setFilters] = useState({
    date_from: monthStart(),
    date_to: todayValue(),
    search: '',
    per_page: 10,
    page: 1,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [entryOpen, setEntryOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [waterCardOpen, setWaterCardOpen] = useState(false)
  const [entryForm, setEntryForm] = useState(emptyEntry)
  const [accountForm, setAccountForm] = useState(emptyAccount)
  const [ticketForm, setTicketForm] = useState(emptyTicket)
  const [receiptResults, setReceiptResults] = useState([])
  const [taxpayerOptions, setTaxpayerOptions] = useState([])
  const [taxpayerLoading, setTaxpayerLoading] = useState(false)
  const [selectedWaterCardOption, setSelectedWaterCardOption] = useState(null)
  const [taxpayerHistory, setTaxpayerHistory] = useState({ payments: [], account: null })
  const [selectedWaterCardSubject, setSelectedWaterCardSubject] = useState(null)
  const [menuAnchor, setMenuAnchor] = useState(null)
  const [menuRow, setMenuRow] = useState(null)

  const requestError = (err, fallback) =>
    err.response?.data?.message ||
    err.response?.data?.error ||
    Object.values(err.response?.data?.errors || {})?.flat()?.[0] ||
    err.message ||
    fallback

  const loadPayments = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await axiosInstance.get('/waterworks/payments', { params: filters })
      setPayments(response.data?.data || [])
      setSummary(response.data?.summary || {})
      setMeta(response.data?.meta || {})
    } catch (err) {
      setError(requestError(err, 'Unable to load waterworks payments.'))
    } finally {
      setLoading(false)
    }
  }

  const loadTickets = async () => {
    try {
      const response = await axiosInstance.get('/waterworks/tickets')
      setTickets(response.data?.data || [])
    } catch (err) {
      setError(requestError(err, 'Unable to load waterworks tickets.'))
    }
  }

  useEffect(() => {
    loadPayments()
    loadTickets()
  }, [])

  const filteredTickets = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    return tickets.filter((ticket) => {
      if (!search) return true
      return [
        ticket.ticket_no,
        ticket.taxpayer_name,
        ticket.account_number,
        ticket.meter_number,
        ticket.concern_type,
        ticket.status,
      ].join(' ').toLowerCase().includes(search)
    })
  }, [filters.search, tickets])

  const waterCardPayments = taxpayerHistory.payments || []
  const waterCardTotal = useMemo(() => waterCardPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0), [waterCardPayments])
  const waterCardReceiptCount = useMemo(() => new Set(waterCardPayments.map((row) => row.receiptNo || row.paymentId).filter(Boolean)).size, [waterCardPayments])

  const openEntry = () => {
    setEntryForm({
      ...emptyEntry,
      date: todayValue(),
      cashier: String(user?.role || '').toLowerCase() === 'cashier' ? (user?.username || user?.name || '') : '',
    })
    setReceiptResults([])
    setEntryOpen(true)
  }

  const searchReceipts = async () => {
    if (!entryForm.receipt_no && !entryForm.taxpayer_name) return
    try {
      const response = await axiosInstance.get('/waterworks/receipts', {
        params: { search: entryForm.receipt_no || entryForm.taxpayer_name },
      })
      setReceiptResults(response.data || [])
    } catch (err) {
      setError(requestError(err, 'Unable to search waterworks receipts.'))
    }
  }

  const selectReceipt = (row) => {
    setEntryForm((current) => ({
      ...current,
      payment_id: row.paymentId || '',
      receipt_no: row.receiptNo || current.receipt_no,
      taxpayer_name: row.taxpayer || current.taxpayer_name,
      local_tin: row.localTin || current.local_tin,
      date: String(row.paymentDate || current.date).slice(0, 10),
      cashier: row.collector || row.cashier || current.cashier,
    }))
  }

  const saveEntry = async () => {
    setSaving(true)
    setError('')
    try {
      await axiosInstance.post('/waterworks/new-entry', entryForm)
      setEntryOpen(false)
      setMessage('Waterworks entry saved successfully.')
      await loadPayments()
    } catch (err) {
      setError(requestError(err, 'Unable to save waterworks entry.'))
    } finally {
      setSaving(false)
    }
  }

  const saveAccount = async () => {
    setSaving(true)
    setError('')
    try {
      await axiosInstance.post('/waterworks/card-account', accountForm)
      setAccountOpen(false)
      setMessage('Waterworks account saved successfully.')
    } catch (err) {
      setError(requestError(err, 'Unable to save waterworks account.'))
    } finally {
      setSaving(false)
    }
  }

  const saveTicket = async () => {
    setSaving(true)
    setError('')
    try {
      await axiosInstance.post('/waterworks/tickets', ticketForm)
      setTicketOpen(false)
      setTicketForm(emptyTicket)
      setMessage('Waterworks service ticket saved successfully.')
      await loadTickets()
    } catch (err) {
      setError(requestError(err, 'Unable to save waterworks ticket.'))
    } finally {
      setSaving(false)
    }
  }

  const updateTicketStatus = async (ticket, status) => {
    try {
      await axiosInstance.put(`/waterworks/tickets/${ticket.id}`, { status })
      setMessage('Ticket status updated.')
      await loadTickets()
    } catch (err) {
      setError(requestError(err, 'Unable to update ticket status.'))
    }
  }

  const openDetails = async (row) => {
    setMenuAnchor(null)
    setMenuRow(null)
    setSelectedWaterCardSubject(row)
    setDetailsOpen(true)
    setTaxpayerHistory({ payments: [], account: null })

    try {
      const response = await axiosInstance.get('/waterworks/taxpayer-payments', {
        params: { taxpayer: row.taxpayer, local_tin: row.localTin },
      })
      setTaxpayerHistory(response.data || { payments: [], account: null })
    } catch (err) {
      setError(requestError(err, 'Unable to load taxpayer waterworks details.'))
    }
  }

  const deleteLocalLink = async (row) => {
    if (!window.confirm('Delete this local waterworks payment link?')) return
    try {
      await axiosInstance.delete(`/waterworks/payment-edit/${row.paymentId}`)
      setMenuAnchor(null)
      setMenuRow(null)
      setMessage('Local waterworks link deleted.')
      await loadPayments()
    } catch (err) {
      setError(requestError(err, 'Unable to delete waterworks link.'))
    }
  }

  const exportPayments = () => {
    const params = new URLSearchParams(filters).toString()
    window.open(`${axiosInstance.defaults.baseURL}/waterworks/payments/export?${params}`, '_blank')
  }

  const loadWaterCardTaxpayers = async () => {
    setTaxpayerLoading(true)
    try {
      const response = await axiosInstance.get('/waterworks/taxpayers', {
        params: {
          date_from: '2000-01-01',
          date_to: todayValue(),
          limit: 5000,
        },
      })
      setTaxpayerOptions(response.data || [])
    } catch (err) {
      setError(requestError(err, 'Unable to load water card taxpayers.'))
    } finally {
      setTaxpayerLoading(false)
    }
  }

  const openWaterCardFromToolbar = () => {
    setError('')
    setSelectedWaterCardOption(null)
    setWaterCardOpen(true)
    loadWaterCardTaxpayers()
  }

  const openSelectedWaterCard = () => {
    if (!selectedWaterCardOption) {
      setError('Please select a taxpayer to open the Water Card.')
      return
    }
    setWaterCardOpen(false)
    openDetails({ taxpayer: selectedWaterCardOption.taxpayer, localTin: selectedWaterCardOption.localTin })
  }

  const clearFilters = () => {
    setFilters({
      date_from: monthStart(),
      date_to: todayValue(),
      search: '',
      per_page: 10,
      page: 1,
    })
  }

  return (
    <Box sx={{ display: 'grid', gap: 2.25, width: '100%' }}>
      <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
        <Box sx={{ color: colors.navy, px: { xs: 2.5, md: 4 }, py: { xs: 3, md: 4 }, textAlign: 'center' }}>
          <Stack alignItems="center" spacing={1.2}>
            <Typography sx={{ color: colors.blue, fontSize: 12, fontWeight: 950, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              Treasury Utility Monitoring
            </Typography>
            <Typography sx={{ fontSize: { xs: 30, md: 42 }, fontWeight: 950, lineHeight: 1 }}>
              Waterworks Department
            </Typography>
            <Typography sx={{ color: colors.slate, maxWidth: 760 }}>
              Manage billing, accounts, entries, ticket workflows, and recorded water payments.
            </Typography>
            <Stack direction="row" flexWrap="wrap" justifyContent="center" gap={1} sx={{ pt: 0.5 }}>
              <Chip label="Connected" size="small" sx={{ bgcolor: '#dcfce7', color: '#14532d', fontWeight: 900 }} />
              <Chip label="Firebird .FDB Read Only" size="small" sx={{ bgcolor: '#e0f2fe', color: '#075985', fontWeight: 900 }} />
            </Stack>
          </Stack>
        </Box>
        <Stack direction="row" flexWrap="wrap" justifyContent="center" sx={{ bgcolor: '#f8fafc', borderTop: `1px solid ${colors.border}`, columnGap: 1.8, p: 2, rowGap: 1.2 }}>
          <Button startIcon={<Plus size={16} />} onClick={openEntry} variant="contained">New Entry</Button>
          <Button startIcon={<Droplets size={16} />} onClick={() => setAccountOpen(true)} variant="outlined">Water Account</Button>
          <Button startIcon={<TicketCheck size={16} />} onClick={() => setTicketOpen(true)} variant="outlined">Service Ticket</Button>
          <Button startIcon={<RefreshCcw size={16} />} onClick={loadPayments} variant="outlined">{loading ? 'Refreshing...' : 'Refresh'}</Button>
          <Button startIcon={<Download size={16} />} onClick={exportPayments} variant="outlined">Export</Button>
          <Button
            startIcon={<ReceiptText size={16} />}
            onClick={openWaterCardFromToolbar}
            variant="contained"
            sx={{
              bgcolor: colors.amber,
              boxShadow: '0 8px 18px rgba(180, 83, 9, 0.22)',
              '&:hover': { bgcolor: '#92400e' },
            }}
          >
            Water Card
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError('')}
          action={<Button color="inherit" size="small" onClick={loadPayments}>Retry</Button>}
          sx={{ border: '1px solid #fecaca', borderRadius: 2 }}
        >
          <strong>Unable to load Waterworks records.</strong> {error}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' } }}>
        <KpiCard icon={Droplets} label="Total Collections" value={formatMoney(summary.totalCollections || 0)} />
        <KpiCard icon={ReceiptText} label="Receipts" value={summary.receipts || 0} tone={colors.green} />
        <KpiCard icon={ClipboardList} label="Payment Lines" value={summary.allPayments || 0} tone={colors.amber} />
        <KpiCard icon={Wrench} label="Meter Payments" value={summary.meterPayments || 0} tone="#0891b2" />
        <KpiCard icon={TicketCheck} label="Open Tickets" value={summary.tickets || 0} tone={colors.red} />
      </Box>

      <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ bgcolor: '#fff', borderBottom: `1px solid ${colors.border}`, px: 2 }}>
          <Tab value="payments" label="Payments" />
          <Tab value="tickets" label="Service Tickets" />
          <Tab value="reports" label="Reports" />
        </Tabs>

        <Box sx={{ bgcolor: '#f8fbff', p: 2 }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '180px 180px minmax(360px, 1fr) auto auto' } }}>
            <TextField label="Date From" size="small" type="date" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} />
            <TextField label="Date To" size="small" type="date" value={filters.date_to} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} />
            <TextField label="Search Waterworks" size="small" placeholder="Taxpayer, receipt no., collector, TIN, or water fee type" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} InputProps={{ startAdornment: <Search size={16} /> }} sx={fieldSx} />
            <Button onClick={loadPayments} variant="contained">Apply Filters</Button>
            <Button onClick={clearFilters} variant="outlined">Clear</Button>
          </Box>
        </Box>
      </Paper>

      {activeTab === 'payments' && (
        <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
          <Box sx={{ p: 2.2 }}>
            <Typography sx={{ fontSize: 22, fontWeight: 950 }}>Waterworks Payment Records</Typography>
            <Typography sx={{ color: colors.slate, fontSize: 13 }}>{meta.total || 0} receipt record(s)</Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: colors.soft }}>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Receipt No.</TableCell>
                  <TableCell>Taxpayer</TableCell>
                  <TableCell>Collector</TableCell>
                  <TableCell>Local TIN</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ color: colors.slate, py: 5 }}>
                      No waterworks payments found.
                    </TableCell>
                  </TableRow>
                )}
                {payments.map((row) => (
                  <TableRow hover key={row.paymentId || row.id}>
                    <TableCell>{formatDate(row.paymentDate)}</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>{row.receiptNo}</TableCell>
                    <TableCell>{row.taxpayer}</TableCell>
                    <TableCell>{row.collector}</TableCell>
                    <TableCell>{row.localTin || '-'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 950 }}>{formatMoney(row.amount || 0)}</TableCell>
                    <TableCell align="center">
                      <IconButton onClick={(event) => { setMenuAnchor(event.currentTarget); setMenuRow(row) }}>
                        <MoreVertical size={18} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {activeTab === 'tickets' && (
        <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
          <Box sx={{ p: 2.2 }}>
            <Typography sx={{ fontSize: 22, fontWeight: 950 }}>Waterworks Service Tickets</Typography>
            <Typography sx={{ color: colors.slate, fontSize: 13 }}>{filteredTickets.length} ticket(s)</Typography>
          </Box>
          <TableContainer>
            <Table>
              <TableHead sx={{ backgroundColor: colors.soft }}>
                <TableRow>
                  <TableCell>Ticket No.</TableCell>
                  <TableCell>Taxpayer</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell>Concern</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTickets.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ color: colors.slate, py: 5 }}>No service tickets found.</TableCell></TableRow>
                )}
                {filteredTickets.map((ticket) => (
                  <TableRow hover key={ticket.id}>
                    <TableCell sx={{ fontWeight: 900 }}>{ticket.ticket_no}</TableCell>
                    <TableCell>{ticket.taxpayer_name}</TableCell>
                    <TableCell>{ticket.account_number || '-'}</TableCell>
                    <TableCell>{ticket.concern_type}</TableCell>
                    <TableCell>{ticket.priority}</TableCell>
                    <TableCell><Chip label={ticket.status} color={ticket.status === 'Resolved' ? 'success' : 'warning'} size="small" /></TableCell>
                    <TableCell align="center">
                      <Button size="small" onClick={() => updateTicketStatus(ticket, ticket.status === 'Resolved' ? 'Open' : 'Resolved')}>
                        {ticket.status === 'Resolved' ? 'Reopen' : 'Resolve'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {activeTab === 'reports' && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
          <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 950 }}>Daily Collection Report</Typography>
            <Typography sx={{ color: colors.slate, mt: 0.5 }}>Use the date filters above, then export the payment table for daily submission.</Typography>
          </Paper>
          <Paper elevation={0} sx={{ border: `1px solid ${colors.border}`, borderRadius: 3, p: 2.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 950 }}>Billing Summary</Typography>
            <Typography sx={{ color: colors.slate, mt: 0.5 }}>Water source breakdown is available through the Waterworks payments endpoint.</Typography>
          </Paper>
        </Box>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => { setMenuAnchor(null); setMenuRow(null) }}>
        <MenuItem onClick={() => openDetails(menuRow)}><Eye size={16} />&nbsp;View Water Card</MenuItem>
        <MenuItem onClick={() => deleteLocalLink(menuRow)} sx={{ color: colors.red }}><Trash2 size={16} />&nbsp;Delete Local Link</MenuItem>
      </Menu>

      <Dialog open={entryOpen} onClose={() => setEntryOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          New Waterworks Entry
          <IconButton onClick={() => setEntryOpen(false)}><X size={18} /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, pt: 1 }}>
          <TextField label="Date" type="date" value={entryForm.date} onChange={(e) => setEntryForm((c) => ({ ...c, date: e.target.value }))} InputLabelProps={{ shrink: true }} sx={fieldSx} />
          <TextField select label="Cashier" value={entryForm.cashier} onChange={(e) => setEntryForm((c) => ({ ...c, cashier: e.target.value }))} sx={fieldSx}>
            {cashierOptions.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
          </TextField>
          <TextField label="Receipt No." value={entryForm.receipt_no} onChange={(e) => setEntryForm((c) => ({ ...c, receipt_no: e.target.value }))} sx={fieldSx} />
          <Button startIcon={<Search size={16} />} onClick={searchReceipts} variant="outlined">Search Receipt</Button>
          <TextField label="Taxpayer Name" value={entryForm.taxpayer_name} onChange={(e) => setEntryForm((c) => ({ ...c, taxpayer_name: e.target.value }))} sx={fieldSx} />
          <TextField label="Local TIN" value={entryForm.local_tin} onChange={(e) => setEntryForm((c) => ({ ...c, local_tin: e.target.value }))} sx={fieldSx} />
          <TextField label="Account Number" value={entryForm.account_number} onChange={(e) => setEntryForm((c) => ({ ...c, account_number: e.target.value }))} sx={fieldSx} />
          <Box sx={{ gridColumn: '1 / -1' }}>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Receipt</TableCell><TableCell>Taxpayer</TableCell><TableCell align="right">Amount</TableCell><TableCell /></TableRow></TableHead>
                <TableBody>
                  {receiptResults.map((row) => (
                    <TableRow key={row.paymentId} hover>
                      <TableCell>{formatDate(row.paymentDate)}</TableCell>
                      <TableCell>{row.receiptNo}</TableCell>
                      <TableCell>{row.taxpayer}</TableCell>
                      <TableCell align="right">{formatMoney(row.amount || 0)}</TableCell>
                      <TableCell align="right"><Button onClick={() => selectReceipt(row)} size="small">Use</Button></TableCell>
                    </TableRow>
                  ))}
                  {receiptResults.length === 0 && <TableRow><TableCell colSpan={5} align="center">Search receipt to load matching water payments.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEntryOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={saveEntry} variant="contained">{saving ? 'Saving...' : 'Save Entry'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={accountOpen} onClose={() => setAccountOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Water Account</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <TextField label="Permittee Name" value={accountForm.permittee_name} onChange={(e) => setAccountForm((c) => ({ ...c, permittee_name: e.target.value }))} sx={fieldSx} />
          <TextField label="Account Number" value={accountForm.account_number} onChange={(e) => setAccountForm((c) => ({ ...c, account_number: e.target.value }))} sx={fieldSx} />
          <TextField label="Meter Number" value={accountForm.meter_number} onChange={(e) => setAccountForm((c) => ({ ...c, meter_number: e.target.value }))} sx={fieldSx} />
          <TextField label="Connection Type" value={accountForm.connection_type} onChange={(e) => setAccountForm((c) => ({ ...c, connection_type: e.target.value }))} sx={fieldSx} />
          <TextField label="Address" value={accountForm.address} onChange={(e) => setAccountForm((c) => ({ ...c, address: e.target.value }))} sx={fieldSx} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAccountOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={saveAccount} variant="contained">{saving ? 'Saving...' : 'Save Account'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={ticketOpen} onClose={() => setTicketOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New Service Ticket</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <TextField label="Taxpayer Name" value={ticketForm.taxpayer_name} onChange={(e) => setTicketForm((c) => ({ ...c, taxpayer_name: e.target.value }))} sx={fieldSx} />
          <TextField label="Account Number" value={ticketForm.account_number} onChange={(e) => setTicketForm((c) => ({ ...c, account_number: e.target.value }))} sx={fieldSx} />
          <TextField label="Meter Number" value={ticketForm.meter_number} onChange={(e) => setTicketForm((c) => ({ ...c, meter_number: e.target.value }))} sx={fieldSx} />
          <TextField select label="Concern" value={ticketForm.concern_type} onChange={(e) => setTicketForm((c) => ({ ...c, concern_type: e.target.value }))} sx={fieldSx}>
            {['Billing', 'Meter Reading', 'Leakage', 'Disconnection', 'Reconnection', 'Other'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
          <TextField select label="Priority" value={ticketForm.priority} onChange={(e) => setTicketForm((c) => ({ ...c, priority: e.target.value }))} sx={fieldSx}>
            {['Low', 'Normal', 'High', 'Urgent'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
          <TextField label="Assigned To" value={ticketForm.assigned_to} onChange={(e) => setTicketForm((c) => ({ ...c, assigned_to: e.target.value }))} sx={fieldSx} />
          <TextField label="Description" multiline minRows={3} value={ticketForm.description} onChange={(e) => setTicketForm((c) => ({ ...c, description: e.target.value }))} sx={fieldSx} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTicketOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={saveTicket} variant="contained">{saving ? 'Saving...' : 'Save Ticket'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={waterCardOpen} onClose={() => setWaterCardOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          Select Tax Payer
          <Button startIcon={<X size={16} />} onClick={() => setWaterCardOpen(false)}>Close</Button>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Autocomplete
            options={taxpayerOptions}
            loading={taxpayerLoading}
            value={selectedWaterCardOption}
            onChange={(_, value) => setSelectedWaterCardOption(value)}
            getOptionLabel={(option) => option?.localTin ? `${option.taxpayer} - ${option.localTin}` : option?.taxpayer || ''}
            isOptionEqualToValue={(option, value) => (option.localTin || option.taxpayer) === (value.localTin || value.taxpayer)}
            noOptionsText={taxpayerLoading ? 'Loading taxpayers...' : 'No matching taxpayer found'}
            renderInput={(params) => <TextField {...params} placeholder="Search taxpayer or Local TIN" helperText="Choose a taxpayer to open the Water Card." sx={fieldSx} />}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={`${option.localTin || option.taxpayer}-${option.paymentId || ''}`} sx={{ display: 'grid' }}>
                <Typography sx={{ fontWeight: 900 }}>{option.taxpayer || '-'}</Typography>
                <Typography sx={{ color: colors.slate, fontSize: 12 }}>Local TIN: {option.localTin || '-'}</Typography>
              </Box>
            )}
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${colors.border}`, p: 2 }}>
          <Button onClick={() => setWaterCardOpen(false)}>Cancel</Button>
          <Button disabled={!selectedWaterCardOption || taxpayerLoading} onClick={openSelectedWaterCard} variant="contained" sx={{ bgcolor: colors.amber, '&:hover': { bgcolor: '#92400e' } }}>
            Open Water Card
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          {selectedWaterCardSubject?.taxpayer ? `Water Payments - ${selectedWaterCardSubject.taxpayer}` : 'Water Card Details'}
          <Button startIcon={<X size={16} />} onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ bgcolor: '#f4e7c8', border: '1px solid #b99b54', p: { xs: 1.5, md: 2.5 }, overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 950, textAlign: { xs: 'left', md: 'center' }, textTransform: 'uppercase' }}>Zamboanguita Waterworks Department</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 950, textAlign: { xs: 'left', md: 'center' }, textTransform: 'uppercase' }}>Statement of Account</Typography>
                <Box sx={{ display: 'grid', gap: 1, mt: 2 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 1 }}><Typography>Permittee:</Typography><Typography sx={{ borderBottom: '1px solid #111827', fontWeight: 900 }}>{selectedWaterCardSubject?.taxpayer || taxpayerHistory.account?.fullName || '-'}</Typography></Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 1 }}><Typography>Address:</Typography><Typography sx={{ borderBottom: '1px solid #111827', fontWeight: 700 }}>{taxpayerHistory.account?.address || '-'}</Typography></Box>
                </Box>
              </Box>
              <Box sx={{ display: 'grid', alignContent: 'start', gap: 1 }}>
                {[
                  ['Account No.', taxpayerHistory.account?.accountNumber || '-'],
                  ['Meter No.', taxpayerHistory.account?.waterMeter || '-'],
                  ['Connection', taxpayerHistory.account?.waterConnectionType || '-'],
                  ['Local TIN', selectedWaterCardSubject?.localTin || taxpayerHistory.account?.localTin || '-'],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 1 }}><Typography>{label}</Typography><Typography sx={{ borderBottom: '1px solid #111827', fontWeight: 900 }}>{value}</Typography></Box>
                ))}
              </Box>
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: 'transparent', borderColor: '#9a7a35' }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>Month</TableCell><TableCell align="center">Used</TableCell><TableCell align="right">Amount</TableCell><TableCell align="center">Surcharge</TableCell><TableCell align="center">Interest</TableCell><TableCell align="right">Total Due</TableCell><TableCell>Date Paid</TableCell><TableCell>O.R. Number</TableCell><TableCell align="center">Action</TableCell></TableRow></TableHead>
                <TableBody>
                  {waterCardPayments.length === 0 && <TableRow><TableCell colSpan={9} align="center">No water payments found for this taxpayer.</TableCell></TableRow>}
                  {waterCardPayments.map((row) => (
                    <TableRow key={`${row.paymentId}-${row.paymentDetailId || row.id}`}>
                      <TableCell>{row.paymentDate ? new Intl.DateTimeFormat('en-PH', { month: 'short', year: 'numeric' }).format(new Date(`${String(row.paymentDate).slice(0, 10)}T00:00:00`)) : '-'}</TableCell>
                      <TableCell align="center">-</TableCell>
                      <TableCell align="right">{formatMoney(row.amount || 0)}</TableCell>
                      <TableCell align="center">-</TableCell>
                      <TableCell align="center">-</TableCell>
                      <TableCell align="right">{formatMoney(row.amount || 0)}</TableCell>
                      <TableCell>{formatDate(row.paymentDate)}</TableCell>
                      <TableCell>{row.receiptNo || '-'}</TableCell>
                      <TableCell align="center"><Button size="small" variant="outlined">Action</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, mt: 1.5 }}>
              <Box sx={{ border: '1px solid #9a7a35', p: 1.3 }}><Typography sx={{ fontSize: 13, fontWeight: 950 }}>Receipts</Typography><Typography sx={{ fontSize: 18, fontWeight: 950 }}>{waterCardReceiptCount}</Typography></Box>
              <Box sx={{ border: '1px solid #9a7a35', p: 1.3 }}><Typography sx={{ fontSize: 13, fontWeight: 950 }}>Collector</Typography><Typography sx={{ fontSize: 18, fontWeight: 950 }}>{waterCardPayments[0]?.collector || '-'}</Typography></Box>
              <Box sx={{ border: '1px solid #9a7a35', p: 1.3 }}><Typography sx={{ fontSize: 13, fontWeight: 950 }}>Total Water Payments</Typography><Typography sx={{ fontSize: 18, fontWeight: 950 }}>{formatMoney(waterCardTotal)}</Typography></Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setDetailsOpen(false)} variant="contained" sx={{ bgcolor: '#075985', '&:hover': { bgcolor: '#0c4a6e' } }}>Close</Button></DialogActions>
      </Dialog>

      <Snackbar open={Boolean(message)} autoHideDuration={3500} onClose={() => setMessage('')}>
        <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>
      </Snackbar>
    </Box>
  )
}

