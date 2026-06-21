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
  LinearProgress,
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
import { Eye, Pencil, Printer, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import axiosInstance from '../../../axiosinstance/axiosInstance'
import { formatMoney } from '../utils/generalFundFormat'

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

function DetailLine({ label, value }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
      <Typography color="text.secondary" fontSize={12} fontWeight={800} textTransform="uppercase">
        {label}
      </Typography>
      <Typography color="#132238" fontWeight={700}>
        {value || '-'}
      </Typography>
    </Paper>
  )
}

function DialogHeader({ onClose, subtitle, title }) {
  return (
    <DialogTitle
      sx={{
        background: 'linear-gradient(135deg, #0f2747, #2f4f7f)',
        color: '#ffffff',
        px: 3,
        py: 2,
      }}
    >
      <Box alignItems="center" display="flex" justifyContent="space-between">
        <Box>
          <Typography fontWeight={800} variant="h6">{title}</Typography>
          <Typography fontSize={13} sx={{ opacity: 0.86 }}>{subtitle}</Typography>
        </Box>
        <Button onClick={onClose} sx={{ color: '#ffffff', minWidth: 40 }}>
          <X size={20} />
        </Button>
      </Box>
    </DialogTitle>
  )
}

function PaymentDescriptionCell({ detail }) {
  const description = detail.child_description || detail.raw_description || detail.description || 'General Fund payment'

  return (
    <Typography color="#132238" fontSize={14} fontWeight={800}>
      {description}
    </Typography>
  )
}

const readBlobError = async (error) => {
  const data = error.response?.data
  if (!(data instanceof Blob)) {
    return error.response?.data?.message || error.response?.data?.error || error.message
  }

  try {
    const text = await data.text()
    const payload = JSON.parse(text)
    return payload.message || payload.error || text || error.message
  } catch {
    return error.message
  }
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

export function GeneralFundCollectionsTable({ collections }) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selectedRow, setSelectedRow] = useState(null)
  const [activeDialog, setActiveDialog] = useState('')
  const [detailRows, setDetailRows] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [printingPaymentId, setPrintingPaymentId] = useState(null)

  const visibleRows = useMemo(
    () => collections.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [collections, page, rowsPerPage],
  )

  const loadPaymentDetails = async (row) => {
    if (!row?.payment_id) return

    setDetailRows([])
    setDetailError('')
    setDetailLoading(true)

    try {
      const response = await axiosInstance.get(
        `/general-fund/payment-details/${encodeURIComponent(row.payment_id)}`,
        {
          params: {
            date_from: row.collection_date,
            date_to: row.collection_date,
            receipt_no: row.receipt_no,
            taxpayer: row.taxpayer,
            collector: row.collector,
          },
        },
      )

      if (!response.data?.ok) {
        throw new Error(response.data?.error || 'Unable to load payment details.')
      }

      setDetailRows(Array.isArray(response.data.data) ? response.data.data : [])
    } catch (error) {
      setDetailError(error.response?.data?.message || error.message || 'Unable to load payment details.')
    } finally {
      setDetailLoading(false)
    }
  }

  const printReceipt = async (row) => {
    const printWindow = window.open('', '_blank', 'width=460,height=900')
    if (!printWindow) {
      setDetailError('Unable to open receipt print window. Please allow pop-ups for this site.')
      return
    }

    printWindow.document.write('<p style="font-family: Arial, sans-serif; padding: 16px;">Preparing receipt PDF...</p>')
    printWindow.document.close()
    setPrintingPaymentId(row.payment_id)

    try {
      const response = await axiosInstance.get(
        `/general-fund/receipt-pdf/${encodeURIComponent(row.payment_id)}`,
        {
          params: {
            collection_date: row.collection_date,
            receipt_no: row.receipt_no,
            taxpayer: row.taxpayer,
            collector: row.collector,
            total_amount: row.total_amount,
          },
          responseType: 'blob',
        },
      )
      const pdfUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      printWindow.location.href = pdfUrl
    } catch (error) {
      const message = (await readBlobError(error)) || 'Unable to generate receipt PDF.'
      printWindow.document.open()
      printWindow.document.write(`<p style="font-family: Arial, sans-serif; padding: 16px;">${escapeHtml(message)}</p>`)
      printWindow.document.close()
      setDetailError(message)
    } finally {
      setPrintingPaymentId(null)
    }
  }

  const openDialog = (dialog, row) => {
    setSelectedRow(row)
    setActiveDialog(dialog)
    loadPaymentDetails(row)
  }

  const closeDialog = () => {
    setActiveDialog('')
    setSelectedRow(null)
    setDetailRows([])
    setDetailError('')
  }

  return (
    <Paper className="reports-table general-fund-table" variant="outlined">
      <div className="table-toolbar">
        <div>
          <strong><span className="toolbar-live-dot" />General Fund Collections</strong>
          <span>{collections.length} receipts loaded from the active filter period</span>
        </div>
      </div>

      <TableContainer sx={{ maxHeight: 620 }}>
        <Table stickyHeader size="small" sx={{ minWidth: 980 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={tableHeaderSx}>Date</TableCell>
              <TableCell sx={tableHeaderSx}>Taxpayer</TableCell>
              <TableCell sx={tableHeaderSx}>Receipt</TableCell>
              <TableCell sx={tableHeaderSx}>Collector</TableCell>
              <TableCell align="right" sx={tableHeaderSx}>Total</TableCell>
              <TableCell sx={tableHeaderSx}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow hover key={row.payment_id}>
                <TableCell sx={tableCellSx}>{formatDate(row.collection_date)}</TableCell>
                <TableCell sx={{ ...tableCellSx, minWidth: 260 }}>{row.taxpayer || '-'}</TableCell>
                <TableCell sx={{ ...tableCellSx, fontWeight: 900 }}>{row.receipt_no || '-'}</TableCell>
                <TableCell sx={tableCellSx}>{row.collector || '-'}</TableCell>
                <TableCell sx={amountCellSx}>{formatMoney(row.total_amount)}</TableCell>
                <TableCell sx={tableCellSx}>
                  <Box display="flex" gap={1}>
                    <Button
                      onClick={() => openDialog('view', row)}
                      size="small"
                      startIcon={<Eye size={15} />}
                      sx={{ borderRadius: 2, fontWeight: 800 }}
                      variant="outlined"
                    >
                      View
                    </Button>
                    <Button
                      color="warning"
                      onClick={() => openDialog('update', row)}
                      size="small"
                      startIcon={<Pencil size={15} />}
                      sx={{ borderRadius: 2, fontWeight: 800 }}
                      variant="outlined"
                    >
                      Update
                    </Button>
                    <Button
                      color="success"
                      disabled={printingPaymentId === row.payment_id}
                      onClick={() => printReceipt(row)}
                      size="small"
                      startIcon={<Printer size={15} />}
                      sx={{ borderRadius: 2, fontWeight: 800 }}
                      variant="outlined"
                    >
                      Print
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {!collections.length && (
              <TableRow>
                <TableCell align="center" colSpan={6} sx={{ color: '#667085', py: 3 }}>
                  No General Fund collections found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={collections.length}
        onPageChange={(_, nextPage) => setPage(nextPage)}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value))
          setPage(0)
        }}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 25, 50]}
      />

      <Dialog
        fullWidth
        maxWidth={false}
        onClose={closeDialog}
        open={activeDialog === 'view'}
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxWidth: '820px',
            overflow: 'hidden',
            width: 'calc(100vw - 32px)',
          },
        }}
      >
        <DialogHeader onClose={closeDialog} subtitle="Payment details breakdown" title="General Fund View" />
        <DialogContent sx={{ backgroundColor: '#f4f7fb', p: 2.5 }}>
          {selectedRow && (
            <Box display="grid" gap={1.5}>
              <Paper sx={{ borderRadius: 2, p: 2 }} variant="outlined">
                <Box alignItems="center" display="flex" flexWrap="wrap" gap={1.5} justifyContent="space-between">
                  <Box>
                    <Typography color="#132238" fontWeight={900} variant="h6">
                      {selectedRow.taxpayer || 'Unnamed taxpayer'}
                    </Typography>
                    <Typography color="text.secondary" fontSize={13}>
                      Receipt {selectedRow.receipt_no || '-'} | {formatDate(selectedRow.collection_date)}
                    </Typography>
                  </Box>
                  <Chip color="success" label={formatMoney(selectedRow.total_amount)} sx={{ fontWeight: 900 }} />
                </Box>
              </Paper>

              <Box display="grid" gap={1} gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))">
                <DetailLine label="Date" value={formatDate(selectedRow.collection_date)} />
                <DetailLine label="Receipt" value={selectedRow.receipt_no} />
                <DetailLine label="RCD Number" value={selectedRow.rcd_number} />
              </Box>

              {detailLoading && <LinearProgress />}
              {detailError && <Alert severity="warning">{detailError}</Alert>}

              <Paper sx={{ borderRadius: 2, overflow: 'hidden' }} variant="outlined">
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={tableHeaderSx}>Description</TableCell>
                        <TableCell align="right" sx={tableHeaderSx}>Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailRows.map((detail) => (
                        <TableRow hover key={detail.paymentdetail_id}>
                          <TableCell sx={{ ...tableCellSx, whiteSpace: 'normal' }}>
                            <PaymentDescriptionCell detail={detail} />
                          </TableCell>
                          <TableCell sx={amountCellSx}>{formatMoney(detail.amount)}</TableCell>
                        </TableRow>
                      ))}
                      {!detailLoading && !detailRows.length && (
                        <TableRow hover>
                          <TableCell sx={{ ...tableCellSx, whiteSpace: 'normal' }}>Payment details not found.</TableCell>
                          <TableCell sx={amountCellSx}>{formatMoney(selectedRow.total_amount)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#f4f7fb', px: 2.5, pb: 2.5 }}>
          <Button onClick={closeDialog} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        fullWidth
        maxWidth={false}
        onClose={closeDialog}
        open={activeDialog === 'update'}
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxWidth: '980px',
            overflow: 'hidden',
            width: '86vw',
          },
        }}
      >
        <DialogHeader onClose={closeDialog} subtitle="Prepared edit layout for future posting workflow" title="Update General Fund Payment" />
        <DialogContent sx={{ backgroundColor: '#f4f7fb', p: 3 }}>
          {selectedRow && (
            <Box display="grid" gap={2} pt={1}>
              <Paper sx={{ borderRadius: 2, p: 2 }} variant="outlined">
                <Typography color="#132238" fontWeight={900}>Payment Header</Typography>
                <Typography color="text.secondary" fontSize={13}>
                  Firebird updates are disabled until the official posting workflow is approved.
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Box display="grid" gap={2} gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))">
                  <TextField disabled label="Date" size="small" value={formatDate(selectedRow.collection_date)} />
                  <TextField disabled label="Taxpayer" size="small" value={selectedRow.taxpayer || ''} />
                  <TextField disabled label="Receipt No." size="small" value={selectedRow.receipt_no || ''} />
                  <TextField disabled label="Collector" size="small" value={selectedRow.collector || ''} />
                  <TextField disabled label="Total" size="small" value={formatMoney(selectedRow.total_amount)} />
                </Box>
              </Paper>

              {detailLoading && <LinearProgress />}
              {detailError && <Alert severity="warning">{detailError}</Alert>}

              <Paper sx={{ borderRadius: 2, overflow: 'hidden' }} variant="outlined">
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={tableHeaderSx}>Source / Description</TableCell>
                        <TableCell align="right" sx={tableHeaderSx}>Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detailRows.map((detail) => (
                        <TableRow key={detail.paymentdetail_id}>
                          <TableCell sx={{ ...tableCellSx, whiteSpace: 'normal' }}>
                            <PaymentDescriptionCell detail={detail} />
                          </TableCell>
                          <TableCell sx={amountCellSx}>{formatMoney(detail.amount)}</TableCell>
                        </TableRow>
                      ))}
                      {!detailLoading && !detailRows.length && (
                        <TableRow>
                          <TableCell sx={tableCellSx}>Payment details not found.</TableCell>
                          <TableCell sx={amountCellSx}>{formatMoney(selectedRow.total_amount)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#f4f7fb', px: 3, pb: 3 }}>
          <Button disabled variant="contained">Save Changes</Button>
          <Button onClick={closeDialog} variant="outlined">Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
