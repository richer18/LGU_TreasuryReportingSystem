import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
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
  Tooltip,
  Typography,
} from '@mui/material'
import {
  BookOpen,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Download,
  Plus,
  RefreshCcw,
  Save,
  Ticket,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import { formatMoney } from '../GeneralFund/utils/generalFundFormat'

const todayValue = () => new Date().toISOString().slice(0, 10)
const yearStart = () => `${new Date().getFullYear()}-01-01`
const yearEnd = () => `${new Date().getFullYear()}-12-31`

const headerSx = {
  backgroundColor: '#f8fafc',
  color: '#475467',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const cellSx = {
  color: '#132238',
  fontSize: 14,
}

const moneySx = {
  ...cellSx,
  fontWeight: 900,
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

const panelSx = {
  border: '1px solid var(--color-border)',
  borderRadius: 3,
  boxShadow: '0 10px 26px rgba(15,39,71,0.08)',
}

const buttonSx = {
  borderRadius: 2,
  fontWeight: 900,
  minHeight: 40,
  textTransform: 'none',
}

const emptyBookForm = {
  amount_released: '',
  assigned_to_name: '',
  cash_ticket_type_id: '',
  collector_signature: '',
  date_issued: todayValue(),
  date_returned: '',
  quantity: '',
  remarks: '',
  serial_no: '',
  status: 'issued',
}

const emptyCollectionForm = {
  amount: '',
  cash_ticket_type_id: '',
  collection_date: todayValue(),
  collector_name: '',
  quantity: '',
  rd_no: '',
  remarks: '',
  remittance_date: '',
  serial_no: '',
  status: 'posted',
  ticket_type_name: '',
  unit_value: '',
}

const countSerialRange = (from, to) => {
  const start = Number(String(from || '').replace(/\D/g, ''))
  const end = Number(String(to || from || '').replace(/\D/g, ''))
  if (!start || !end || end < start) return 0
  return end - start + 1
}

const displaySerial = (row) => {
  if (!row?.serial_from && !row?.serial_to) return '-'
  if (!row?.serial_to || row.serial_from === row.serial_to) return row.serial_from || row.serial_to
  return `${row.serial_from} to ${row.serial_to}`
}

const cashTicketRcdName = (collector) => {
  const clean = String(collector || '').trim().replace(/\s*-\s*CASH\s*TICKET$/i, '')
  return clean ? `${clean.toUpperCase()} - CASH TICKET` : 'CASH TICKET'
}

const statusColor = (status) => {
  if (['active', 'posted', 'available', 'issued', 'fully_remitted'].includes(status)) return 'success'
  if (['partially_used', 'returned', 'partial'].includes(status)) return 'primary'
  if (['open'].includes(status)) return 'warning'
  if (['voided', 'cancelled', 'inactive'].includes(status)) return 'error'
  return 'default'
}

function StatusChip({ value }) {
  return (
    <Chip
      color={statusColor(value)}
      label={value || '-'}
      size="small"
      sx={{ fontWeight: 800, textTransform: 'capitalize' }}
      variant="outlined"
    />
  )
}

function Field({ children, icon, label }) {
  return (
    <label className="treasury-field">
      <span>{icon}{label}</span>
      {children}
    </label>
  )
}

export function CashTicketsPage({ user }) {
  const [activeTab, setActiveTab] = useState('collections')
  const [dateFrom, setDateFrom] = useState(yearStart())
  const [dateTo, setDateTo] = useState(yearEnd())
  const [overview, setOverview] = useState(null)
  const [collections, setCollections] = useState([])
  const [books, setBooks] = useState([])
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [collectionDialogOpen, setCollectionDialogOpen] = useState(false)
  const [bookDialogOpen, setBookDialogOpen] = useState(false)
  const [collectionForm, setCollectionForm] = useState(emptyCollectionForm)
  const [bookForm, setBookForm] = useState(emptyBookForm)
  const importInputRef = useRef(null)

  const loadCashTickets = async () => {
    setLoading(true)
    setError('')

    try {
      const [overviewResponse, collectionsResponse, booksResponse, typesResponse] = await Promise.all([
        axiosInstance.get('/cash-tickets', { params: { date_from: dateFrom, date_to: dateTo } }),
        axiosInstance.get('/cash-tickets/collections', { params: { date_from: dateFrom, date_to: dateTo, limit: 100 } }),
        axiosInstance.get('/cash-tickets/books', { params: { limit: 100 } }),
        axiosInstance.get('/cash-tickets/types'),
      ])

      setOverview(overviewResponse.data.data)
      setCollections(collectionsResponse.data.data?.data || [])
      setBooks(booksResponse.data.data?.data || [])
      setTypes(typesResponse.data.data || [])
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.response?.data?.error ||
          requestError.message ||
          'Unable to load Cash Tickets.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true
    setLoading(true)

    Promise.all([
      axiosInstance.get('/cash-tickets', { params: { date_from: dateFrom, date_to: dateTo } }),
      axiosInstance.get('/cash-tickets/collections', { params: { date_from: dateFrom, date_to: dateTo, limit: 100 } }),
      axiosInstance.get('/cash-tickets/books', { params: { limit: 100 } }),
      axiosInstance.get('/cash-tickets/types'),
    ])
      .then(([overviewResponse, collectionsResponse, booksResponse, typesResponse]) => {
        if (!isActive) return
        setOverview(overviewResponse.data.data)
        setCollections(collectionsResponse.data.data?.data || [])
        setBooks(booksResponse.data.data?.data || [])
        setTypes(typesResponse.data.data || [])
      })
      .catch((requestError) => {
        if (!isActive) return
        setError(
          requestError.response?.data?.message ||
            requestError.response?.data?.error ||
            requestError.message ||
            'Unable to load Cash Tickets.',
        )
      })
      .finally(() => {
        if (!isActive) return
        setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [dateFrom, dateTo])

  const typeOptions = useMemo(() => types.filter((type) => type.status !== 'inactive'), [types])

  const collectionPreview = useMemo(() => {
    const selectedType = typeOptions.find((type) => String(type.id) === String(collectionForm.cash_ticket_type_id))
    const quantity = Number(collectionForm.quantity || (collectionForm.serial_no ? 1 : 0))
    const unitValue = Number(collectionForm.unit_value || selectedType?.unit_value || 0)
    const amount = Number(collectionForm.amount || quantity * unitValue)
    return { amount, quantity, selectedType, unitValue }
  }, [collectionForm, typeOptions])

  const saveBook = async () => {
    setSaving('book')
    setError('')
    setMessage('')

    try {
      await axiosInstance.post('/cash-tickets/books', {
        ...bookForm,
        cash_ticket_type_id: bookForm.cash_ticket_type_id || null,
        amount_released: Number(bookForm.amount_released || 0),
        quantity: Number(bookForm.quantity || (bookForm.serial_no ? 1 : 0)),
      })
      setMessage('Cash ticket given to collector saved.')
      setBookDialogOpen(false)
      setBookForm(emptyBookForm)
      await loadCashTickets()
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to save cash ticket given to collector.')
    } finally {
      setSaving('')
    }
  }

  const downloadTemplate = async () => {
    setError('')
    setMessage('')

    try {
      const response = await axiosInstance.get('/cash-tickets/template', {
        responseType: 'blob',
      })
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'CASH_TICKET_IMPORT_TEMPLATE.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to download template.')
    }
  }

  const importExcel = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setSaving('import')
    setError('')
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await axiosInstance.post('/cash-tickets/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const result = response.data?.data || {}
      const collectionCount = result.collections_inserted ?? result.inserted ?? 0
      const givenCount = result.books_inserted ?? 0
      setMessage(
        `Imported ${collectionCount} collection row(s) and ${givenCount} given-to-collector row(s). Skipped duplicates: ${result.skipped_duplicates || 0}.`,
      )
      await loadCashTickets()
    } catch (requestError) {
      const result = requestError.response?.data?.data
      const firstIssue = result?.errors?.[0]?.message ? ` Row ${result.errors[0].row}: ${result.errors[0].message}` : ''
      setError(
        requestError.response?.data?.message ||
          `Import completed with issues.${firstIssue}` ||
          requestError.message ||
          'Unable to import Cash Ticket Excel file.',
      )
      await loadCashTickets()
    } finally {
      setSaving('')
    }
  }

  const saveCollection = async () => {
    setSaving('collection')
    setError('')
    setMessage('')

    try {
      await axiosInstance.post('/cash-tickets/collections', {
        ...collectionForm,
        cash_ticket_type_id: collectionForm.cash_ticket_type_id || null,
        quantity: collectionPreview.quantity,
        unit_value: collectionPreview.unitValue,
        amount: collectionPreview.amount,
        ticket_type_name: collectionPreview.selectedType?.name || collectionForm.ticket_type_name,
      })
      setMessage('Cash ticket collection saved.')
      setCollectionDialogOpen(false)
      setCollectionForm(emptyCollectionForm)
      await loadCashTickets()
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to save collection.')
    } finally {
      setSaving('')
    }
  }

  const openCollectionDialog = () => {
    setCollectionForm({
      ...emptyCollectionForm,
      collector_name: user?.name || '',
    })
    setCollectionDialogOpen(true)
  }

  const summary = overview?.summary || {}
  const reconciliation = overview?.reconciliation || {}
  const monitoring = overview?.monitoring || { rows: [], summary: {} }

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Paper sx={{ ...panelSx, p: 3 }}>
        <Box sx={{ alignItems: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="overline" sx={{ color: 'var(--color-primary)', fontWeight: 900 }}>
              Accountable Form and Market Operations
            </Typography>
            <Typography variant="h4" sx={{ color: 'var(--color-text-strong)', fontWeight: 950, lineHeight: 1.1 }}>
              Cash Tickets
            </Typography>
            <Typography sx={{ color: 'var(--color-muted)', fontWeight: 700, mt: 0.5 }}>
              Encode ticket collections, manage ticket books, and reconcile against report-of-collection totals.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <input
              accept=".xlsx"
              hidden
              onChange={importExcel}
              ref={importInputRef}
              type="file"
            />
            <Button onClick={downloadTemplate} startIcon={<Download size={16} />} sx={buttonSx} variant="outlined">
              Download Template
            </Button>
            <Button
              disabled={saving === 'import'}
              onClick={() => importInputRef.current?.click()}
              startIcon={saving === 'import' ? <CircularProgress color="inherit" size={16} /> : <Upload size={16} />}
              sx={buttonSx}
              variant="outlined"
            >
              Import Excel
            </Button>
            <Button onClick={loadCashTickets} startIcon={<RefreshCcw size={16} />} sx={buttonSx} variant="outlined">
              Refresh
            </Button>
            <Button onClick={openCollectionDialog} startIcon={<Plus size={16} />} sx={buttonSx} variant="contained">
              New Collection
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ ...panelSx, p: 2.5 }}>
        <Box sx={{ alignItems: 'end', display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Field icon={<CalendarDays size={14} aria-hidden="true" />} label="Date From">
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </Field>
          <Field icon={<CalendarDays size={14} aria-hidden="true" />} label="Date To">
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </Field>
        </Box>
      </Paper>

      {loading && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
        {[
          { label: 'Total Collections', value: formatMoney(summary.total_amount || 0), icon: <CircleDollarSign /> },
          { label: 'Collection Entries', value: summary.collection_count || 0, icon: <ClipboardList /> },
          { label: 'Released Amount', value: formatMoney(summary.total_released || monitoring.summary?.total_released || 0), icon: <Ticket /> },
          { label: 'Outstanding Balance', value: formatMoney(summary.outstanding_balance || monitoring.summary?.balance || 0), icon: <BookOpen /> },
        ].map((card) => (
          <Paper key={card.label} sx={{ ...panelSx, p: 2.5 }}>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5 }}>
              <Box sx={{ alignItems: 'center', bgcolor: 'var(--color-primary-soft)', borderRadius: 2, color: 'var(--color-primary)', display: 'flex', height: 42, justifyContent: 'center', width: 42 }}>
                {card.icon}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ color: 'var(--color-text-strong)', fontWeight: 950 }}>
                  {card.value}
                </Typography>
                <Typography sx={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 800 }}>
                  {card.label}
                </Typography>
              </Box>
            </Box>
          </Paper>
        ))}
      </Box>

      <Paper sx={{ ...panelSx }}>
        <Tabs
          onChange={(_, value) => setActiveTab(value)}
          sx={{ borderBottom: '1px solid var(--color-border)', px: 2 }}
          value={activeTab}
        >
          <Tab label="Collections" value="collections" />
          <Tab label="Given to Collector" value="books" />
          <Tab label="Monitoring" value="monitoring" />
          <Tab label="Reconciliation" value="reconciliation" />
        </Tabs>

        {activeTab === 'collections' && (
          <Box sx={{ p: 2.5 }}>
            <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ color: 'var(--color-text-strong)', fontWeight: 900 }}>
                Cash Ticket Collections
              </Typography>
              <Button onClick={openCollectionDialog} startIcon={<Plus size={16} />} sx={buttonSx} variant="contained">
                Add Collection
              </Button>
            </Box>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 980 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={headerSx}>Date</TableCell>
                    <TableCell sx={headerSx}>RD No.</TableCell>
                    <TableCell sx={headerSx}>Collector</TableCell>
                    <TableCell sx={headerSx}>RCD Name</TableCell>
                    <TableCell sx={headerSx}>Ticket Type</TableCell>
                    <TableCell sx={headerSx}>Serial No.</TableCell>
                    <TableCell align="right" sx={headerSx}>Qty</TableCell>
                    <TableCell align="right" sx={headerSx}>Amount</TableCell>
                    <TableCell sx={headerSx}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {collections.map((row) => (
                    <TableRow hover key={row.id}>
                      <TableCell sx={cellSx}>{row.collection_date || '-'}</TableCell>
                      <TableCell sx={{ ...cellSx, fontWeight: 800 }}>{row.rd_no || '-'}</TableCell>
                      <TableCell sx={cellSx}>{row.collector_name || '-'}</TableCell>
                      <TableCell sx={{ ...cellSx, fontWeight: 800 }}>{cashTicketRcdName(row.collector_name)}</TableCell>
                      <TableCell sx={cellSx}>{row.type?.name || row.ticket_type_name || '-'}</TableCell>
                      <TableCell sx={cellSx}>{displaySerial(row)}</TableCell>
                      <TableCell align="right" sx={cellSx}>{row.quantity || 0}</TableCell>
                      <TableCell sx={moneySx}>{formatMoney(row.amount || 0)}</TableCell>
                      <TableCell sx={cellSx}><StatusChip value={row.status} /></TableCell>
                    </TableRow>
                  ))}
                  {!collections.length && (
                    <TableRow>
                      <TableCell align="center" colSpan={9} sx={{ color: 'var(--color-muted)', py: 4 }}>
                        No cash ticket collections found for this date range.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {activeTab === 'books' && (
          <Box sx={{ p: 2.5 }}>
            <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ color: 'var(--color-text-strong)', fontWeight: 900 }}>Cash Tickets Given to Collector</Typography>
              <Button onClick={() => setBookDialogOpen(true)} startIcon={<Plus size={16} />} sx={buttonSx} variant="contained">
                Add Given Ticket
              </Button>
            </Box>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 980 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={headerSx}>Date Given</TableCell>
                    <TableCell sx={headerSx}>Serial No.</TableCell>
                    <TableCell align="right" sx={headerSx}>Qty</TableCell>
                    <TableCell align="right" sx={headerSx}>Amount Released</TableCell>
                    <TableCell sx={headerSx}>Collector</TableCell>
                    <TableCell sx={headerSx}>Signature</TableCell>
                    <TableCell sx={headerSx}>Status</TableCell>
                    <TableCell sx={headerSx}>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {books.map((row) => (
                    <TableRow hover key={row.id}>
                      <TableCell sx={cellSx}>{row.date_issued || '-'}</TableCell>
                      <TableCell sx={cellSx}>{displaySerial(row)}</TableCell>
                      <TableCell align="right" sx={cellSx}>{row.quantity || 0}</TableCell>
                      <TableCell sx={moneySx}>{formatMoney(row.amount_released || 0)}</TableCell>
                      <TableCell sx={cellSx}>{row.assigned_to_name || '-'}</TableCell>
                      <TableCell sx={cellSx}>{row.collector_signature || '-'}</TableCell>
                      <TableCell sx={cellSx}><StatusChip value={row.status} /></TableCell>
                      <TableCell sx={cellSx}>{row.remarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {!books.length && (
                    <TableRow>
                      <TableCell align="center" colSpan={8} sx={{ color: 'var(--color-muted)', py: 4 }}>
                        No cash tickets given to collectors yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {activeTab === 'monitoring' && (
          <Box sx={{ p: 2.5 }}>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, mb: 2 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography sx={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 800 }}>Released</Typography>
                <Typography variant="h6" sx={{ fontWeight: 950 }}>{formatMoney(monitoring.summary?.total_released || 0)}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography sx={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 800 }}>Remitted</Typography>
                <Typography variant="h6" sx={{ fontWeight: 950 }}>{formatMoney(monitoring.summary?.total_remitted || 0)}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography sx={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 800 }}>Balance</Typography>
                <Typography variant="h6" sx={{ fontWeight: 950 }}>{formatMoney(monitoring.summary?.balance || 0)}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography sx={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 800 }}>Open / Partial</Typography>
                <Typography variant="h6" sx={{ fontWeight: 950 }}>{monitoring.summary?.open_count || 0}</Typography>
              </Paper>
            </Box>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 1280 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={headerSx}>Date</TableCell>
                    <TableCell sx={headerSx}>Serial No.</TableCell>
                    <TableCell sx={headerSx}>Collector</TableCell>
                    <TableCell sx={headerSx}>RCD Name</TableCell>
                    <TableCell align="right" sx={headerSx}>Released</TableCell>
                    <TableCell align="right" sx={headerSx}>Remitted</TableCell>
                    <TableCell align="right" sx={headerSx}>Balance</TableCell>
                    <TableCell sx={headerSx}>Last Release</TableCell>
                    <TableCell sx={headerSx}>Last Remitted</TableCell>
                    <TableCell sx={headerSx}>Last RD No.</TableCell>
                    <TableCell sx={headerSx}>Status</TableCell>
                    <TableCell align="right" sx={headerSx}>Days</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(monitoring.rows || []).map((row) => (
                    <TableRow hover key={`${row.serial_no}-${row.collector}-${row.date_last_release}`}>
                      <TableCell sx={cellSx}>{row.date || '-'}</TableCell>
                      <TableCell sx={cellSx}>{row.serial_no || '-'}</TableCell>
                      <TableCell sx={cellSx}>{row.collector || '-'}</TableCell>
                      <TableCell sx={{ ...cellSx, fontWeight: 800 }}>{row.rcd_collector_name || cashTicketRcdName(row.collector)}</TableCell>
                      <TableCell sx={moneySx}>{formatMoney(row.amount_released || 0)}</TableCell>
                      <TableCell sx={moneySx}>{formatMoney(row.amount_remitted || 0)}</TableCell>
                      <TableCell sx={moneySx}>{formatMoney(row.balance || 0)}</TableCell>
                      <TableCell sx={cellSx}>{row.date_last_release || '-'}</TableCell>
                      <TableCell sx={cellSx}>{row.date_last_remitted || '-'}</TableCell>
                      <TableCell sx={cellSx}>{row.last_rd_no || '-'}</TableCell>
                      <TableCell sx={cellSx}><StatusChip value={row.status} /></TableCell>
                      <TableCell align="right" sx={cellSx}>{row.days_outstanding ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                  {!(monitoring.rows || []).length && (
                    <TableRow>
                      <TableCell align="center" colSpan={12} sx={{ color: 'var(--color-muted)', py: 4 }}>
                        No cash ticket monitoring rows yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {activeTab === 'reconciliation' && (
          <Box sx={{ display: 'grid', gap: 2, p: 2.5 }}>
            {!reconciliation.has_report_basis && (
              <Alert severity="info">
                No Report of Collection basis rows are saved yet. You can already encode Cash Ticket collections; report-row import can be added next from the Excel source.
              </Alert>
            )}
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography sx={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 800 }}>Cash Ticket Total</Typography>
                <Typography variant="h5" sx={{ fontWeight: 950 }}>{formatMoney(reconciliation.cash_ticket_total || 0)}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography sx={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 800 }}>Report of Collection Total</Typography>
                <Typography variant="h5" sx={{ fontWeight: 950 }}>{formatMoney(reconciliation.report_total || 0)}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography sx={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 800 }}>Difference</Typography>
                <Typography variant="h5" sx={{ color: Math.abs(Number(reconciliation.difference || 0)) <= 0.01 ? 'var(--color-success-dark)' : 'var(--color-danger-dark)', fontWeight: 950 }}>
                  {formatMoney(reconciliation.difference || 0)}
                </Typography>
              </Paper>
            </Box>
          </Box>
        )}
      </Paper>

      <Dialog fullWidth maxWidth="md" onClose={() => !saving && setCollectionDialogOpen(false)} open={collectionDialogOpen}>
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>New Cash Ticket Collection</Typography>
            <Typography variant="body2" sx={{ color: 'var(--color-muted)' }}>Save daily cash ticket collection from ticket sales.</Typography>
          </Box>
          <Tooltip title="Close">
            <IconButton disabled={Boolean(saving)} onClick={() => setCollectionDialogOpen(false)}><X size={18} /></IconButton>
          </Tooltip>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, pt: 1 }}>
            <TextField InputLabelProps={{ shrink: true }} label="Collection Date" onChange={(event) => setCollectionForm((current) => ({ ...current, collection_date: event.target.value }))} required type="date" value={collectionForm.collection_date} />
            <TextField label="RD No." onChange={(event) => setCollectionForm((current) => ({ ...current, rd_no: event.target.value }))} value={collectionForm.rd_no} />
            <TextField label="Collector" onChange={(event) => setCollectionForm((current) => ({ ...current, collector_name: event.target.value }))} value={collectionForm.collector_name} />
            <TextField label="Ticket Type" onChange={(event) => setCollectionForm((current) => ({ ...current, cash_ticket_type_id: event.target.value }))} select value={collectionForm.cash_ticket_type_id}>
              <MenuItem value="">Manual / uncategorized</MenuItem>
              {typeOptions.map((type) => (
                <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Manual Type Name" onChange={(event) => setCollectionForm((current) => ({ ...current, ticket_type_name: event.target.value }))} value={collectionForm.ticket_type_name} />
            <TextField InputLabelProps={{ shrink: true }} label="Remittance Date" onChange={(event) => setCollectionForm((current) => ({ ...current, remittance_date: event.target.value }))} slotProps={{ inputLabel: { shrink: true } }} type="date" value={collectionForm.remittance_date} />
            <TextField label="Serial No." onChange={(event) => setCollectionForm((current) => ({ ...current, serial_no: event.target.value }))} value={collectionForm.serial_no} />
            <TextField label="Quantity" onChange={(event) => setCollectionForm((current) => ({ ...current, quantity: event.target.value }))} type="number" value={collectionForm.quantity || collectionPreview.quantity || ''} />
            <TextField label="Unit Value" onChange={(event) => setCollectionForm((current) => ({ ...current, unit_value: event.target.value }))} type="number" value={collectionForm.unit_value || collectionPreview.unitValue || ''} />
            <TextField label="Amount" onChange={(event) => setCollectionForm((current) => ({ ...current, amount: event.target.value }))} type="number" value={collectionForm.amount || collectionPreview.amount || ''} />
            <TextField label="Status" onChange={(event) => setCollectionForm((current) => ({ ...current, status: event.target.value }))} select value={collectionForm.status}>
              <MenuItem value="posted">Posted</MenuItem>
              <MenuItem value="voided">Voided</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </TextField>
            <TextField label="Remarks" multiline onChange={(event) => setCollectionForm((current) => ({ ...current, remarks: event.target.value }))} sx={{ gridColumn: { xs: 'span 1', md: 'span 3' } }} value={collectionForm.remarks} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button disabled={Boolean(saving)} onClick={() => setCollectionDialogOpen(false)}>Cancel</Button>
          <Button disabled={Boolean(saving)} onClick={saveCollection} startIcon={saving === 'collection' ? <CircularProgress color="inherit" size={16} /> : <Save size={16} />} sx={buttonSx} variant="contained">
            Save Collection
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="md" onClose={() => !saving && setBookDialogOpen(false)} open={bookDialogOpen}>
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Cash Ticket Given to Collector</Typography>
          <IconButton disabled={Boolean(saving)} onClick={() => setBookDialogOpen(false)}><X size={18} /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, pt: 1 }}>
            <TextField label="Collector" onChange={(event) => setBookForm((current) => ({ ...current, assigned_to_name: event.target.value }))} value={bookForm.assigned_to_name} />
            <TextField label="Serial No." onChange={(event) => setBookForm((current) => ({ ...current, serial_no: event.target.value }))} required value={bookForm.serial_no} />
            <TextField label="Quantity" onChange={(event) => setBookForm((current) => ({ ...current, quantity: event.target.value }))} type="number" value={bookForm.quantity || (bookForm.serial_no ? 1 : '')} />
            <TextField label="Amount Released" onChange={(event) => setBookForm((current) => ({ ...current, amount_released: event.target.value }))} type="number" value={bookForm.amount_released} />
            <TextField label="Signature" onChange={(event) => setBookForm((current) => ({ ...current, collector_signature: event.target.value }))} value={bookForm.collector_signature} />
            <TextField InputLabelProps={{ shrink: true }} label="Date Given" onChange={(event) => setBookForm((current) => ({ ...current, date_issued: event.target.value }))} type="date" value={bookForm.date_issued} />
            <TextField InputLabelProps={{ shrink: true }} label="Date Returned" onChange={(event) => setBookForm((current) => ({ ...current, date_returned: event.target.value }))} type="date" value={bookForm.date_returned} />
            <TextField label="Status" onChange={(event) => setBookForm((current) => ({ ...current, status: event.target.value }))} select value={bookForm.status}>
              {['available', 'issued', 'partially_used', 'used', 'returned', 'voided', 'inactive'].map((status) => (
                <MenuItem key={status} value={status}>{status}</MenuItem>
              ))}
            </TextField>
            <TextField label="Remarks" multiline onChange={(event) => setBookForm((current) => ({ ...current, remarks: event.target.value }))} sx={{ gridColumn: { xs: 'span 1', md: 'span 3' } }} value={bookForm.remarks} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button disabled={Boolean(saving)} onClick={() => setBookDialogOpen(false)}>Cancel</Button>
          <Button disabled={Boolean(saving)} onClick={saveBook} startIcon={saving === 'book' ? <CircularProgress color="inherit" size={16} /> : <Save size={16} />} sx={buttonSx} variant="contained">
            Save Given Ticket
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}
