import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
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
import { Eye, Pencil, ReceiptText, Search, X } from 'lucide-react'
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
  whiteSpace: 'nowrap',
}

const amountCellSx = {
  ...tableCellSx,
  fontWeight: 900,
  textAlign: 'right',
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

const receiptStatusOptions = [
  { value: 'Paid', label: 'Paid / Not Cancelled' },
  { value: 'Cancelled', label: 'Cancelled' },
  { value: 'Void', label: 'Void' },
]

const collectorDefaults = [
  { label: 'FLORA MY', value: 'flora' },
  { label: 'IRIS', value: 'angelique' },
  { label: 'AGNES', value: 'agnes' },
  { label: 'RICARDO', value: 'ricardo' },
  { label: 'EMILY E. CREDO', value: 'emily' },
  { label: 'AMABELLA', value: 'amabella' },
  { label: 'GTZ', value: 'gtz' },
]

const collectorOptionKey = (value) => String(value || '').trim().toLowerCase()

const collectorOptionLabel = (value) => {
  const clean = String(value || '').trim()
  return clean ? clean.toUpperCase() : ''
}

const statusColor = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'paid') return 'success'
  if (normalized === 'void') return 'error'
  if (normalized === 'cancelled') return 'warning'
  return 'default'
}

function DialogHeader({ onClose, subtitle, title }) {
  return (
    <DialogTitle
      sx={{
        background: 'linear-gradient(135deg, #0f172a, #1e3a5f)',
        color: '#ffffff',
        position: 'relative',
        pr: 7,
        px: 3,
        py: 2,
      }}
    >
      <Box>
        <Typography fontWeight={900} variant="h6">{title}</Typography>
        <Typography fontSize={13} sx={{ opacity: 0.84 }}>{subtitle}</Typography>
      </Box>
      <IconButton
        aria-label="Close dialog"
        onClick={onClose}
        size="small"
        sx={{
          bgcolor: 'rgba(255,255,255,0.12)',
          color: '#ffffff',
          position: 'absolute',
          right: 18,
          top: 18,
          '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
        }}
      >
        <X size={18} />
      </IconButton>
    </DialogTitle>
  )
}
function DetailBox({ label, value }) {
  return (
    <Paper sx={{ borderRadius: 2, p: 1.5 }} variant="outlined">
      <Typography color="text.secondary" fontSize={12} fontWeight={900} textTransform="uppercase">
        {label}
      </Typography>
      <Typography color="#132238" fontWeight={800}>
        {value || '-'}
      </Typography>
    </Paper>
  )
}

export function SearchReceiptPage({ user }) {
  const [receiptNo, setReceiptNo] = useState('')
  const [rows, setRows] = useState([])
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [detail, setDetail] = useState(null)
  const [activeDialog, setActiveDialog] = useState('')
  const [editForm, setEditForm] = useState({ assigned_collector: '', receipt_no: '', collection_status: 'Paid' })
  const [collectorRows, setCollectorRows] = useState([])
  const [status, setStatus] = useState('idle')
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const visibleRows = useMemo(
    () => rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [page, rows, rowsPerPage],
  )

  const collectorOptions = useMemo(() => {
    const options = new Map()

    collectorDefaults.forEach((option) => options.set(collectorOptionKey(option.value), option))
    collectorRows.forEach((row) => {
      const value = String(row.collector || row.cashier || row.value || '').trim()
      if (!value) return

      const key = collectorOptionKey(value)
      if (options.has(key)) return

      options.set(key, {
        label: collectorOptionLabel(value),
        value,
      })
    })

    if (editForm.assigned_collector) {
      const currentValue = String(editForm.assigned_collector).trim()
      const currentKey = collectorOptionKey(currentValue)
      if (currentValue && !options.has(currentKey)) {
        options.set(currentKey, {
          label: collectorOptionLabel(currentValue),
          value: currentValue,
        })
      }
    }

    return Array.from(options.values())
  }, [collectorRows, editForm.assigned_collector])

  useEffect(() => {
    let isMounted = true

    axiosInstance.get('/general-fund/collectors', { params: { limit: 200 } })
      .then((response) => {
        if (isMounted) setCollectorRows(response.data.data || [])
      })
      .catch(() => {
        if (isMounted) setCollectorRows([])
      })

    return () => {
      isMounted = false
    }
  }, [])

  const canEditReceipts = user?.permissions?.includes('search_receipts.edit')
  const canManageReceiptStatus = String(user?.role || '').toLowerCase() === 'admin'

  const searchReceipts = async (event) => {
    event.preventDefault()
    const searchText = receiptNo.trim()

    if (!searchText) return

    setStatus('loading')
    setError('')
    setRows([])
    setPage(0)

    try {
      const response = await axiosInstance.get('/search-receipts', {
        params: {
          receipt_no: searchText,
          limit: 25,
        },
      })

      setRows(response.data.data || [])
      setStatus('success')
    } catch (requestError) {
      setStatus('error')
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          requestError.message ||
          'Unable to search receipt.',
      )
    }
  }

  const loadDetail = async (row, dialog) => {
    setSelectedReceipt(row)
    setDetail(null)
    setError('')
    setSaveMessage('')
    setActiveDialog(dialog)
    setDetailLoading(true)
    setEditForm({
      assigned_collector: row.assigned_collector || '',
      receipt_no: row.receipt_no || '',
      collection_status: row.collection_status || 'Paid',
    })

    try {
      const response = await axiosInstance.get(`/search-receipts/${encodeURIComponent(row.payment_id)}`)
      setDetail(response.data.data)
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load receipt details.',
      )
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDialog = () => {
    setActiveDialog('')
    setSelectedReceipt(null)
    setDetail(null)
    setSaveMessage('')
  }

  const saveReceiptUpdate = async () => {
    if (!selectedReceipt) return

    setSaving(true)
    setError('')
    setSaveMessage('')

    try {
      const payload = {
        assigned_collector: editForm.assigned_collector,
        receipt_no: editForm.receipt_no,
      }

      if (canManageReceiptStatus) {
        payload.collection_status = editForm.collection_status
      }

      const response = await axiosInstance.patch(`/search-receipts/${encodeURIComponent(selectedReceipt.payment_id)}`, payload)
      const data = response.data.data

      if (data?.updated) {
        setSaveMessage('Receipt updated successfully.')
        setRows((current) =>
          current.map((row) =>
            row.payment_id === selectedReceipt.payment_id
              ? { ...row, assigned_collector: editForm.assigned_collector, receipt_no: editForm.receipt_no, collection_status: canManageReceiptStatus ? (data.collection_status || editForm.collection_status || row.collection_status) : row.collection_status }
              : row,
          ),
        )
      } else {
        setSaveMessage(data?.message || 'Receipt update was not applied.')
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          requestError.message ||
          'Unable to update receipt.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-stack search-receipt-page">
      <section className="general-fund-hero">
        <div>
          <p className="eyebrow">Receipt Maintenance</p>
          <h2>Search Receipt</h2>
        </div>
      </section>

      <section className="toolbar-panel search-receipt-search-panel">
        <form className="search-receipt-form" onSubmit={searchReceipts}>
          <label className="treasury-field">
            <span><ReceiptText size={14} aria-hidden="true" /> OR No.</span>
            <input
              autoComplete="off"
              onChange={(event) => setReceiptNo(event.target.value)}
              placeholder="Search OR receipt number"
              value={receiptNo}
            />
          </label>
          <button className="primary-button" disabled={status === 'loading' || !receiptNo.trim()} type="submit">
            <Search size={16} aria-hidden="true" />
            Search Receipt
          </button>
        </form>
      </section>

      {status === 'loading' && <LinearProgress />}

      {error && (
        <section className="inline-alert">
          {error}
        </section>
      )}

      <Paper className="reports-table search-receipt-table" variant="outlined">
        <div className="table-toolbar">
          <div>
            <strong><span className="toolbar-live-dot" />Receipt Results</strong>
            <span>{rows.length} receipt records loaded</span>
          </div>
        </div>
        <TableContainer sx={{ maxHeight: 620 }}>
          <Table stickyHeader size="small" sx={{ minWidth: 1120 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderSx}>Date</TableCell>
                <TableCell sx={tableHeaderSx}>OR Receipt</TableCell>
                <TableCell sx={tableHeaderSx}>Taxpayer</TableCell>
                <TableCell sx={tableHeaderSx}>Assigned Collector</TableCell>
                <TableCell sx={tableHeaderSx}>Status</TableCell>
                <TableCell align="right" sx={tableHeaderSx}>Total</TableCell>
                <TableCell sx={tableHeaderSx}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow hover key={row.payment_id}>
                  <TableCell sx={tableCellSx}>{formatDate(row.collection_date)}</TableCell>
                  <TableCell sx={{ ...tableCellSx, fontWeight: 900 }}>{row.receipt_no || '-'}</TableCell>
                  <TableCell sx={{ ...tableCellSx, minWidth: 260 }}>{row.taxpayer || '-'}</TableCell>
                  <TableCell sx={tableCellSx}>{row.assigned_collector || '-'}</TableCell>
                  <TableCell sx={tableCellSx}>
                    <Chip
                      color={statusColor(row.collection_status)}
                      label={row.collection_status || 'Paid'}
                      size="small"
                      sx={{ fontWeight: 900 }}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={amountCellSx}>{formatMoney(row.total_amount)}</TableCell>
                  <TableCell sx={tableCellSx}>
                    <Box display="flex" gap={1}>
                      <Button
                        onClick={() => loadDetail(row, 'view')}
                        size="small"
                        startIcon={<Eye size={15} />}
                        sx={{ borderRadius: 2, fontWeight: 800 }}
                        variant="outlined"
                      >
                        View
                      </Button>
                      {canEditReceipts && (
                        <Button
                          color="warning"
                          onClick={() => loadDetail(row, 'update')}
                          size="small"
                          startIcon={<Pencil size={15} />}
                          sx={{ borderRadius: 2, fontWeight: 800 }}
                          variant="outlined"
                        >
                          Update
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {!visibleRows.length && (
                <TableRow>
                  <TableCell align="center" colSpan={7} sx={{ color: '#667085', py: 3 }}>
                    Search an OR number to load receipt records.
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
          rowsPerPageOptions={[10, 25, 50]}
        />
      </Paper>

      <Dialog
        fullWidth
        maxWidth={false}
        onClose={closeDialog}
        open={activeDialog === 'view'}
        PaperProps={{ sx: { borderRadius: 3, maxWidth: 920, overflow: 'hidden', width: 'calc(100vw - 32px)' } }}
      >
        <DialogHeader onClose={closeDialog} subtitle="Official receipt details" title="View Receipt" />
        <DialogContent sx={{ backgroundColor: '#f4f7fb', p: 2.5 }}>
          {detailLoading && <LinearProgress />}
          {detail && (
            <Box display="grid" gap={1.5}>
              <Paper sx={{ borderRadius: 2, p: 2 }} variant="outlined">
                <Typography color="#132238" fontWeight={900} variant="h6">{detail.taxpayer || '-'}</Typography>
                <Typography color="text.secondary" fontSize={13}>
                  OR {detail.receipt_no || '-'} | {formatDate(detail.collection_date)}
                </Typography>
              </Paper>
              <Box display="grid" gap={1} gridTemplateColumns="repeat(auto-fit, minmax(170px, 1fr))">
                <DetailBox label="Assigned Collector" value={detail.assigned_collector} />
                <DetailBox label="Receipt Type" value={detail.receipt_type} />
                <DetailBox label="Pay Group" value={detail.paygroup} />
                <DetailBox label="Status" value={detail.collection_status} />
                <DetailBox label="Total" value={formatMoney(detail.total_amount)} />
              </Box>
              <Divider />
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={tableHeaderSx}>Description</TableCell>
                      <TableCell sx={tableHeaderSx}>Fund</TableCell>
                      <TableCell align="right" sx={tableHeaderSx}>Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(detail.details || []).map((item) => (
                      <TableRow key={item.paymentdetail_id}>
                        <TableCell sx={{ ...tableCellSx, whiteSpace: 'normal' }}>
                          {item.child_description || item.source_description || item.source_code || '-'}
                        </TableCell>
                        <TableCell sx={tableCellSx}>{item.fund_type || '-'}</TableCell>
                        <TableCell sx={amountCellSx}>{formatMoney(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#f4f7fb', px: 2.5, pb: 2.5 }}>
          <Button onClick={closeDialog} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="md"
        onClose={closeDialog}
        open={activeDialog === 'update'}
        PaperProps={{ sx: { borderRadius: 3, maxWidth: 860, overflow: 'hidden', width: '100%' } }}
      >
        <DialogHeader onClose={closeDialog} subtitle="Restricted fields only" title="Update Receipt" />
        <DialogContent sx={{ backgroundColor: '#f4f7fb', p: 3 }}>
          {detailLoading && <LinearProgress />}
          {selectedReceipt && (
            <Box display="grid" gap={2.25}>
              <Alert severity="info" sx={{ alignItems: 'center', borderRadius: 2 }}>
                Only restricted receipt maintenance fields are exposed in this form. Status changes are admin-only.
              </Alert>
              {saveMessage && <Alert severity={saveMessage.includes('disabled') ? 'warning' : 'success'} sx={{ borderRadius: 2 }}>{saveMessage}</Alert>}
              {error && <Alert severity="warning" sx={{ borderRadius: 2 }}>{error}</Alert>}
              <Box
                sx={{
                  bgcolor: '#ffffff',
                  border: '1px solid #d8e2f0',
                  borderRadius: 2.5,
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: canManageReceiptStatus ? '1.5fr 1fr' : '1.5fr 1fr',
                    md: canManageReceiptStatus ? 'minmax(320px, 1.7fr) minmax(190px, 1fr) minmax(190px, 0.9fr)' : 'minmax(320px, 1.6fr) minmax(190px, 1fr)',
                  },
                  p: 2.5,
                }}
              >
                <TextField
                  fullWidth
                  label="Assigned Collector"
                  sx={{ gridColumn: { xs: '1', sm: canManageReceiptStatus ? 'span 2' : 'auto', md: 'auto' } }}
                  onChange={(event) => setEditForm((current) => ({ ...current, assigned_collector: event.target.value }))}
                  select
                  size="small"
                  value={editForm.assigned_collector}
                >
                  <MenuItem value="">Select collector</MenuItem>
                  {collectorOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  label="OR Receipt No."
                  onChange={(event) => setEditForm((current) => ({ ...current, receipt_no: event.target.value }))}
                  size="small"
                  value={editForm.receipt_no}
                />
                {canManageReceiptStatus && (
                  <TextField
                    fullWidth
                    label="Receipt Status"
                    onChange={(event) => setEditForm((current) => ({ ...current, collection_status: event.target.value }))}
                    select
                    size="small"
                    value={editForm.collection_status}
                  >
                    {receiptStatusOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#ffffff', borderTop: '1px solid #d8e2f0', gap: 1, px: 3, py: 2 }}>
          <Button onClick={closeDialog} variant="outlined">Close</Button>
          <Button disabled={saving} onClick={saveReceiptUpdate} variant="contained">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}
