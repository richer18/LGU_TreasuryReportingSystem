import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Checkbox,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Paper,
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
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PaidIcon from '@mui/icons-material/Paid'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SaveIcon from '@mui/icons-material/Save'
import SearchIcon from '@mui/icons-material/Search'
import axiosInstance from '../../axiosinstance/axiosInstance'

const uiColors = {
  navy: 'var(--color-text-strong)',
  navyHover: 'var(--color-primary-dark)',
  teal: 'var(--color-primary)',
  tealHover: 'var(--color-primary-dark)',
  amber: 'var(--color-warning)',
  steel: 'var(--color-muted)',
  sky: 'var(--color-secondary)',
  cardBorder: 'var(--color-border)',
  pageBg: 'var(--color-bg)',
}

const todayValue = () => new Date().toISOString().slice(0, 10)

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

const nextSerial = (value, reference = value) => {
  const numeric = Number(String(value || '').replace(/\D/g, ''))
  if (!numeric) return ''
  return String(numeric + 1).padStart(String(reference || value).length, '0')
}

const calculateEndingBalance = (line) => {
  const beginningQty = Number(line.beginningQty || 0)
  const receiptQty = Number(line.receiptAccountQty || 0)
  const issuedQty = countReceiptRange(line.receiptFrom, line.receiptTo)
  const endingQty = Math.max(beginningQty + receiptQty - issuedQty, 0)

  if (!endingQty) return { from: '-', qty: '0', to: '-' }

  const activeFrom = line.receiptAccountFrom || line.beginningFrom
  const activeTo = line.receiptAccountTo || line.beginningTo
  const issuedTo = line.receiptTo || line.receiptFrom

  if (!activeFrom || !activeTo || !issuedTo) return { from: '-', qty: endingQty, to: '-' }

  const endingFrom = nextSerial(issuedTo, activeTo)
  return {
    from: endingFrom,
    qty: endingQty,
    to: activeTo,
  }
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}[char]))

const emptyLine = () => ({
  id: crypto.randomUUID(),
  formType: 'AF 51',
  receiptFrom: '',
  receiptTo: '',
  collectorAmount: 0,
  beginningFrom: '',
  beginningQty: '',
  beginningTo: '',
  fdbAmount: 0,
  receiptAccountFrom: '',
  receiptAccountQty: '',
  receiptAccountTo: '',
  validated: false,
  validationStatus: 'Not validated',
})

const months = [
  { label: 'January', value: '1' },
  { label: 'February', value: '2' },
  { label: 'March', value: '3' },
  { label: 'April', value: '4' },
  { label: 'May', value: '5' },
  { label: 'June', value: '6' },
  { label: 'July', value: '7' },
  { label: 'August', value: '8' },
  { label: 'September', value: '9' },
  { label: 'October', value: '10' },
  { label: 'November', value: '11' },
  { label: 'December', value: '12' },
]

const years = ['2024', '2025', '2026', '2027', '2028'].map((year) => ({ label: year, value: year }))
const collectorOptions = [
  { label: 'FLORA MY D. FERRER', value: 'FLORA MY' },
  { label: 'AGNES B. ELLO', value: 'AGNES' },
  { label: 'RICARDO T. ENOPIA', value: 'RICARDO' },
  { label: 'ANGELIQUE IRIS A. RAFALES', value: 'IRIS' },
  { label: 'EMILY E. CREDO', value: 'EMILY' },
]
const formTypeOptions = ['AF 51', 'Comm Tax.', 'AF 56', 'RPT', 'RPT SEF']
const templateOptions = [
  { value: '100_GF', label: '100_GF' },
  { value: '200_SEF', label: '200_SEF' },
]

const collectorFullName = (value) => collectorOptions.find((collector) => collector.value === value)?.label || value || 'RCD'

const safeFileName = (value) => String(value || 'RCD').trim().replace(/[^A-Za-z0-9-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')

const formTypeLabel = (value) => value === 'Community Tax Certificate' ? 'Comm Tax.' : value

const toolbarButtonSx = (bg = uiColors.navy, hover = uiColors.navyHover) => ({
  backgroundColor: bg,
  borderRadius: 2,
  boxShadow: '0 4px 10px rgba(15,39,71,0.14)',
  color: '#fff',
  fontWeight: 800,
  minHeight: 42,
  textTransform: 'none',
  '&:hover': { backgroundColor: hover },
})

const secondaryToolbarButtonSx = (accent = uiColors.navy) => ({
  borderColor: `${accent}33`,
  borderRadius: 2,
  color: accent,
  fontWeight: 800,
  minHeight: 42,
  textTransform: 'none',
  '&:hover': { backgroundColor: `${accent}12`, borderColor: accent },
})

const metricCardSx = {
  border: `1px solid ${uiColors.cardBorder}`,
  borderRadius: 3,
  boxShadow: '0 10px 26px rgba(15,39,71,0.08)',
  cursor: 'pointer',
  minHeight: 126,
  overflow: 'hidden',
  transition: 'all 0.2s ease',
  '&:hover': {
    boxShadow: '0 16px 34px rgba(15,39,71,0.13)',
    transform: 'translateY(-2px)',
  },
}

const statusMeta = {
  Draft: { bg: 'var(--color-warning-soft)', color: 'var(--color-warning-dark)' },
  'For Remittance': { bg: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
  'Ready for Remittance': { bg: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
  Remitted: { bg: 'var(--color-success-soft)', color: 'var(--color-success-dark)' },
  Saved: { bg: 'var(--color-secondary-soft)', color: 'var(--color-primary)' },
  Printed: { bg: 'var(--color-secondary-soft)', color: 'var(--color-primary)' },
  Voided: { bg: 'var(--color-danger-soft)', color: 'var(--color-danger-dark)' },
  Cancelled: { bg: 'var(--color-danger-soft)', color: 'var(--color-danger-dark)' },
  'For Review': { bg: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
  Approved: { bg: 'var(--color-secondary-soft)', color: 'var(--color-primary)' },
  Deposited: { bg: 'var(--color-success-soft)', color: 'var(--color-success-dark)' },
  Issued: { bg: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
}

const canRemitStatus = (status) => ['Saved', 'For Remittance', 'Ready for Remittance'].includes(status)
const canReceiveStatus = (status) => status === 'Remitted to ACO'
const canDeleteStatus = (status) => !['Saved', 'Printed', 'Remitted'].includes(status)
const canDeleteDraftStatus = (status) => status === 'Draft'
const isCollectorRole = (role) => String(role || '').toLowerCase().includes('collector')
const isAcoRole = (role) => {
  const value = String(role || '').toLowerCase()
  return value.includes('aco') || value.includes('accountable') || value.includes('admin')
}
const defaultRemitForm = () => ({
  amountRemitted: 0,
  cashAmount: 0,
  checkAmount: 0,
  referenceNo: '',
  receivedBy: '',
  remittanceDate: `${todayValue()}T${new Date().toTimeString().slice(0, 5)}`,
  remarks: '',
})

function StatusChip({ value }) {
  const meta = statusMeta[value] || { bg: 'rgba(75,93,115,0.12)', color: uiColors.steel }
  return <Chip label={value || '-'} size="small" sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 800 }} />
}

export function RcdPage({ user }) {
  const [activeSection, setActiveSection] = useState('overview')
  const [accessStatus, setAccessStatus] = useState(null)
  const [accessError, setAccessError] = useState('')
  const [loadingAccess, setLoadingAccess] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(months.find((month) => month.value === String(new Date().getMonth() + 1)))
  const [selectedYear, setSelectedYear] = useState(years.find((year) => year.value === String(new Date().getFullYear())) || years[2])
  const [search, setSearch] = useState('')
  const [entryDialogOpen, setEntryDialogOpen] = useState(false)
  const [generateMessage, setGenerateMessage] = useState('')
  const [generatingOr, setGeneratingOr] = useState(false)
  const [batches, setBatches] = useState([])
  const [savingAction, setSavingAction] = useState('')
  const savingRef = useRef(false)
  const [editingReportNo, setEditingReportNo] = useState('')
  const [remitDialogOpen, setRemitDialogOpen] = useState(false)
  const [remitBatch, setRemitBatch] = useState(null)
  const [remitForm, setRemitForm] = useState(defaultRemitForm())
  const [remitMessage, setRemitMessage] = useState('')
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false)
  const [receiveBatch, setReceiveBatch] = useState(null)
  const [receiveForm, setReceiveForm] = useState({ amountReceived: 0, receivedByAco: user?.name || '', receivedAt: `${todayValue()}T${new Date().toTimeString().slice(0, 5)}`, remarks: '', confirmed: false })
  const [receiveMessage, setReceiveMessage] = useState('')
  const [auditDialogOpen, setAuditDialogOpen] = useState(false)
  const [auditRows, setAuditRows] = useState([])
  const [auditTitle, setAuditTitle] = useState('')
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null)
  const [actionMenuRow, setActionMenuRow] = useState(null)
  const [accountabilityRows, setAccountabilityRows] = useState([])
  const [accountabilityMessage, setAccountabilityMessage] = useState('')
  const [savingAccountability, setSavingAccountability] = useState(false)
  const [accountabilityForm, setAccountabilityForm] = useState({
    collector: 'IRIS',
    collectorSignedBy: '',
    formType: 'AF 51',
    receiptFrom: '',
    receiptTo: '',
    releasedAt: todayValue(),
    releasedBy: user?.name || '',
    remarks: '',
    serialNo: '',
  })
  const [form, setForm] = useState({
    template: '100_GF + 200_SEF',
    collector: 'IRIS',
    collectionDate: todayValue(),
    reportNo: '',
    cashierRemittedAt: '',
    collectorBankRemittedAt: '',
    bankName: '',
    bankReference: '',
  })
  const [collectionLines, setCollectionLines] = useState([emptyLine()])

  const totals = useMemo(() => {
    const collectorTotal = collectionLines.reduce((sum, line) => sum + Number(line.collectorAmount || 0), 0)
    const fdbTotal = collectionLines.reduce((sum, line) => sum + Number(line.fdbAmount || 0), 0)
    const receiptCount = collectionLines.reduce((sum, line) => sum + countReceiptRange(line.receiptFrom, line.receiptTo), 0)
    return { collectorTotal, fdbTotal, receiptCount, difference: collectorTotal - fdbTotal }
  }, [collectionLines])

  const accountabilityReceiptCount = useMemo(
    () => countReceiptRange(accountabilityForm.receiptFrom, accountabilityForm.receiptTo || accountabilityForm.receiptFrom),
    [accountabilityForm.receiptFrom, accountabilityForm.receiptTo],
  )

  const remitVariance = useMemo(
    () => Number(remitForm.amountRemitted || 0) - Number(remitBatch?.total || 0),
    [remitForm.amountRemitted, remitBatch],
  )
  const receiveVariance = useMemo(
    () => Number(receiveForm.amountReceived || 0) - Number(receiveBatch?.total || 0),
    [receiveForm.amountReceived, receiveBatch],
  )
  const currentRole = user?.role || 'Admin'
  const collectorView = isCollectorRole(currentRole)
  const acoView = isAcoRole(currentRole)
  const adminView = String(currentRole || '').toLowerCase().includes('admin')
  const collectorActionView = collectorView || adminView

  const summary = useMemo(() => batches.reduce((acc, batch) => {
    acc.total += Number(batch.total || 0)
    if (batch.stage === 'Draft') acc.draft += 1
    if (batch.stage === 'Printed' || batch.stage === 'Saved') acc.saved += 1
    return acc
  }, { total: 0, draft: 0, saved: 0 }), [batches])

  const filteredBatches = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return batches
    return batches.filter((batch) => [batch.id, batch.collector, batch.fund, batch.forms, batch.stage].join(' ').toLowerCase().includes(term))
  }, [batches, search])

  const updateLine = (id, field, value) => {
    setCollectionLines((current) => current.map((line) => (line.id === id ? { ...line, [field]: value } : line)))
  }

  const addCollectionLine = () => setCollectionLines((current) => [...current, emptyLine()])

  const validateCollectorLines = async () => {
    const linesToValidate = collectionLines
      .filter((line) => line.formType && line.receiptFrom && line.collectorAmount !== '')
      .map((line) => ({
        id: line.id,
        collector_amount: Number(line.collectorAmount || 0),
        form_type: line.formType,
        receipt_from: line.receiptFrom,
        receipt_to: line.receiptTo || line.receiptFrom,
      }))

    if (linesToValidate.length === 0) {
      setGenerateMessage('Please enter at least one OR line with Type/Form No., OR From, OR To, and Collector Amount.')
      return
    }

    setGeneratingOr(true)
    setGenerateMessage('')

    try {
      const response = await axiosInstance.post('/rcd/generate-or', {
        collector: form.collector,
        collection_date: form.collectionDate,
        fund: '100_GF',
        lines: linesToValidate,
      })
      const payload = response.data?.data || response.data

      if (!payload?.ok) {
        throw new Error(payload?.error || 'Firebird did not validate the RCD OR lines.')
      }

      const rows = (payload.rows || []).map((row) => ({
        id: row.id || crypto.randomUUID(),
        formType: formTypeLabel(row.form_type || 'UNSPECIFIED'),
        receiptFrom: row.receipt_from || '',
        receiptTo: row.receipt_to || '',
        collectorAmount: Number(row.collector_amount || 0),
        fdbAmount: Number(row.fdb_amount || 0),
        fdbReceiptCount: Number(row.fdb_receipt_count || 0),
        paymentIds: row.payment_ids || [],
        validated: true,
        validationStatus: row.validation_status || 'Validated',
      }))

      setCollectionLines(rows.length ? rows : [emptyLine()])
      const hasProblem = rows.some((row) => !['Paid', 'Void', 'Cancelled'].includes(row.validationStatus))
      if (rows.length === 0) {
        setGenerateMessage(`No matching OR records found in Firebird .FDB for ${form.collector} on ${form.collectionDate}.`)
      } else if (hasProblem) {
        setGenerateMessage('Validation completed. Please review lines with mismatch or not found status.')
      } else {
        setGenerateMessage(`Validated ${rows.length} collector-entered line(s) against Firebird .FDB.`)
      }
    } catch (error) {
      setGenerateMessage(error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to validate Firebird OR records.')
    } finally {
      setGeneratingOr(false)
    }
  }

  const removeCollectionLine = (id) => setCollectionLines((current) => current.filter((line) => line.id !== id))
  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const linePayload = (line) => {
    const ending = calculateEndingBalance(line)
    return {
      ...line,
      endingFrom: ending.from === '-' ? '' : ending.from,
      endingQty: ending.qty === '-' ? '' : String(ending.qty),
      endingTo: ending.to === '-' ? '' : ending.to,
    }
  }

  const rcdPayload = (status) => ({
    form: { ...form, template: '100_GF + 200_SEF' },
    report_no: (form.reportNo || '').trim(),
    status,
    lines: collectionLines.filter((line) => line.formType && line.receiptFrom).map(linePayload),
  })

  const printRcdData = (rcd) => {
    const lines = rcd?.lines || []
    const collectionRows = lines.map((line) => `
      <tr>
        <td>${escapeHtml(formTypeLabel(line.formType))}</td>
        <td>${escapeHtml(line.receiptFrom)}</td>
        <td>${escapeHtml(line.receiptTo)}</td>
        <td class="right">${Number(line.collectorAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('')
    const accountabilityRows = lines.map((line) => `
      <tr>
        <td>${escapeHtml(formTypeLabel(line.formType))}</td>
        <td>${escapeHtml(line.beginningQty || 0)}: ${escapeHtml(line.beginningFrom)} - ${escapeHtml(line.beginningTo)}</td>
        <td>${escapeHtml(line.receiptAccountQty || 0)}: ${escapeHtml(line.receiptAccountFrom)} - ${escapeHtml(line.receiptAccountTo)}</td>
        <td>${countReceiptRange(line.receiptFrom, line.receiptTo)}: ${escapeHtml(line.receiptFrom)} - ${escapeHtml(line.receiptTo)}</td>
        <td>${escapeHtml(line.endingQty || '')}: ${escapeHtml(line.endingFrom || '')} - ${escapeHtml(line.endingTo || '')}</td>
      </tr>
    `).join('')
    const html = `
      <html>
        <head>
          <title>${escapeHtml(rcd?.id || 'RCD')}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; padding: 24px; }
            h2, h3, p { text-align: center; margin: 3px 0; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 40px; margin: 24px 0; }
            table { border-collapse: collapse; width: 100%; margin-top: 10px; }
            th, td { border: 1px solid #111; font-size: 12px; padding: 6px; }
            th { font-weight: 700; text-align: center; }
            .right { text-align: right; }
            .section { font-weight: 700; margin-top: 18px; }
          </style>
        </head>
        <body>
          <h2>Report of Collections and Deposit</h2>
          <p><u>Municipality of Zamboanguita</u></p>
          <p>LGU</p>
          <div class="meta">
            <div>Fund: <b>${escapeHtml(rcd?.fund)}</b></div>
            <div>Date: <b>${escapeHtml(rcd?.date)}</b></div>
            <div>Name of Accountable Officer: <b>${escapeHtml(rcd?.collector)}</b></div>
            <div>Report No.: <b>${escapeHtml(rcd?.id)}</b></div>
          </div>
          <div class="section">A. COLLECTIONS</div>
          <table>
            <thead><tr><th>Type / Form No.</th><th>OR From</th><th>OR To</th><th>Amount</th></tr></thead>
            <tbody>${collectionRows}<tr><td colspan="3" class="right"><b>PHP</b></td><td class="right"><b>${Number(rcd?.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</b></td></tr></tbody>
          </table>
          <div class="section">C. ACCOUNTABILITY OF ACCOUNTABLE FORMS</div>
          <table>
            <thead><tr><th>Form</th><th>Beginning Balance</th><th>Receipt</th><th>Issued</th><th>Ending Balance</th></tr></thead>
            <tbody>${accountabilityRows}</tbody>
          </table>
          <script>window.onload = () => window.print()</script>
        </body>
      </html>
    `
    const printWindow = window.open('', '_blank', 'width=1000,height=720')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
    }
  }

  const resetEntryForm = () => {
    setForm((current) => ({
      ...current,
      template: '100_GF + 200_SEF',
      collector: 'IRIS',
      collectionDate: todayValue(),
      reportNo: '',
      cashierRemittedAt: '',
      collectorBankRemittedAt: '',
      bankName: '',
      bankReference: '',
    }))
    setEditingReportNo('')
    setCollectionLines([emptyLine()])
    setGenerateMessage('')
  }

  const openNewEntry = () => {
    resetEntryForm()
    setEntryDialogOpen(true)
  }

  const saveRcdEntry = async (status) => {
    if (savingRef.current) return

    const usableLines = collectionLines.filter((line) => line.formType && line.receiptFrom)
    if (usableLines.length === 0) {
      setGenerateMessage('Please add at least one OR line before saving or printing.')
      return
    }

    savingRef.current = true
    setSavingAction(status)
    try {
      const payload = rcdPayload(status)
      const reportNo = editingReportNo || form.reportNo
      const response = editingReportNo
        ? await axiosInstance.patch(`/rcd/batches/${encodeURIComponent(reportNo)}`, payload)
        : await axiosInstance.post('/rcd/batches', payload)
      const saved = response.data?.data
      await loadRcdBatches()
      if (status === 'Printed') {
        await downloadRcd(saved)
      }
      setSavingAction('')
      setEntryDialogOpen(false)
      resetEntryForm()
    } catch (error) {
      setGenerateMessage(error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to save RCD to MySQL.')
      setSavingAction('')
    } finally {
      savingRef.current = false
    }
  }

  const loadRcdBatches = async () => {
    const response = await axiosInstance.get('/rcd/batches')
    setBatches(response.data?.data || [])
  }

  const loadAccountableForms = async () => {
    const response = await axiosInstance.get('/rcd/accountable-forms')
    setAccountabilityRows(response.data?.data || [])
  }

  const updateAccountabilityForm = (field, value) => {
    setAccountabilityForm((current) => ({ ...current, [field]: value }))
  }

  const resetAccountabilityForm = () => {
    setAccountabilityForm((current) => ({
      ...current,
      collector: 'IRIS',
      collectorSignedBy: '',
      formType: 'AF 51',
      receiptFrom: '',
      receiptTo: '',
      releasedAt: todayValue(),
      releasedBy: user?.name || '',
      remarks: '',
      serialNo: '',
    }))
  }

  const saveAccountableFormRelease = async () => {
    if (!accountabilityForm.formType || !accountabilityForm.receiptFrom || !accountabilityForm.collector) {
      setAccountabilityMessage('Please encode Form Type, OR From, OR To, and Collector before saving.')
      return
    }

    if (accountabilityReceiptCount <= 0) {
      setAccountabilityMessage('Invalid OR range. Please check OR From and OR To.')
      return
    }

    setSavingAccountability(true)
    setAccountabilityMessage('')

    try {
      const response = await axiosInstance.post('/rcd/accountable-forms', {
        collector: accountabilityForm.collector,
        collector_signed_by: accountabilityForm.collectorSignedBy,
        created_by: user?.name || '',
        form_type: accountabilityForm.formType,
        receipt_no_from: accountabilityForm.receiptFrom,
        receipt_no_to: accountabilityForm.receiptTo || accountabilityForm.receiptFrom,
        released_at: accountabilityForm.releasedAt,
        released_by: accountabilityForm.releasedBy,
        remarks: accountabilityForm.remarks,
        serial_no: accountabilityForm.serialNo,
        updated_by: user?.name || '',
      })
      setAccountabilityRows(response.data?.data || [])
      setAccountabilityMessage(response.data?.message || 'Accountable form release saved.')
      resetAccountabilityForm()
    } catch (error) {
      setAccountabilityMessage(error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to save accountable form release.')
    } finally {
      setSavingAccountability(false)
    }
  }

  const openUpdateEntry = async (row) => {
    setSavingAction('Loading')
    try {
      const response = await axiosInstance.get(`/rcd/batches/${encodeURIComponent(row.action_key || row.id)}`)
      const rcd = response.data?.data
      setEditingReportNo(rcd.action_key || rcd.id)
      setForm((current) => ({
        ...current,
        ...(rcd.form || {}),
        reportNo: rcd.id,
      }))
      setCollectionLines((rcd.lines || []).map((line) => ({ ...emptyLine(), ...line, id: crypto.randomUUID() })))
      setGenerateMessage('')
      setEntryDialogOpen(true)
    } catch (error) {
      setAccessError(error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to load RCD for update.')
    } finally {
      setSavingAction('')
    }
  }

  const printRcd = async (row) => {
    await downloadRcd(row)
  }

  const downloadRcd = async (row) => {
    const actionKey = row.action_key || row.id
    const fileLabel = `${collectorFullName(row.collector)}_${row.date || form.collectionDate}`
    const response = await axiosInstance.get(`/rcd/batches/${encodeURIComponent(actionKey)}/download`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `${safeFileName(fileLabel)}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    await loadRcdBatches()
  }

  const deleteRcd = async (row) => {
    if (!canDeleteDraftStatus(row.stage)) {
      setAccessError(`Cannot delete an RCD with status "${row.stage}". Use Void/Cancel with reason instead.`)
      return
    }
    const label = row.id && row.id !== '-' ? row.id : `draft RCD #${row.db_id}`
    if (!window.confirm(`Delete ${label}? This will remove the saved RCD batch from MySQL.`)) {
      return
    }

    try {
      await axiosInstance.delete(`/rcd/batches/${encodeURIComponent(row.action_key || row.id)}`)
      await loadRcdBatches()
    } catch (error) {
      setAccessError(error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to delete RCD batch.')
    }
  }

  const openActionMenu = (event, row) => {
    setActionMenuAnchor(event.currentTarget)
    setActionMenuRow(row)
  }

  const closeActionMenu = () => {
    setActionMenuAnchor(null)
    setActionMenuRow(null)
  }

  const runMenuAction = (handler) => {
    const row = actionMenuRow
    closeActionMenu()
    if (row) handler(row)
  }

  const openRemitDialog = async (row) => {
    setSavingAction('Loading')
    setRemitMessage('')
    try {
      const response = await axiosInstance.get(`/rcd/batches/${encodeURIComponent(row.action_key || row.id)}`)
      const batch = response.data?.data
      const total = Number(batch?.total || row.total || 0)
      setRemitBatch(batch || row)
      setRemitForm({
        ...defaultRemitForm(),
        amountRemitted: total,
        cashAmount: total,
        remittedBy: user?.name || collectorFullName(batch?.collector || row.collector),
      })
      setRemitDialogOpen(true)
    } catch (error) {
      setAccessError(error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to load RCD remittance preview.')
    } finally {
      setSavingAction('')
    }
  }

  const openReceiveDialog = async (row) => {
    setSavingAction('Loading')
    setReceiveMessage('')
    try {
      const response = await axiosInstance.get(`/rcd/batches/${encodeURIComponent(row.action_key || row.id)}`)
      const batch = response.data?.data
      const total = Number(batch?.total || row.total || 0)
      setReceiveBatch(batch || row)
      setReceiveForm({
        amountReceived: total,
        receivedByAco: user?.name || '',
        receivedAt: `${todayValue()}T${new Date().toTimeString().slice(0, 5)}`,
        remarks: '',
        confirmed: false,
      })
      setReceiveDialogOpen(true)
    } catch (error) {
      setAccessError(error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to load receive remittance preview.')
    } finally {
      setSavingAction('')
    }
  }

  const submitRemittance = async () => {
    if (!remitBatch) return
    const cashPlusCheck = Number(remitForm.cashAmount || 0) + Number(remitForm.checkAmount || 0)
    if (Number(remitForm.amountRemitted || 0) <= 0) {
      setRemitMessage('Amount remitted must be greater than zero.')
      return
    }
    if (Math.round(cashPlusCheck * 100) !== Math.round(Number(remitForm.amountRemitted || 0) * 100)) {
      setRemitMessage('Cash amount plus check amount must equal amount remitted.')
      return
    }
    if (Math.round(remitVariance * 100) !== 0 && !remitForm.remarks.trim()) {
      setRemitMessage('Variance requires remarks.')
      return
    }
    setSavingAction('Remitting')
    setRemitMessage('')
    try {
      await axiosInstance.post(`/rcd/batches/${encodeURIComponent(remitBatch.action_key || remitBatch.id)}/remit`, {
        amount_remitted: Number(remitForm.amountRemitted || 0),
        cash_amount: Number(remitForm.cashAmount || 0),
        check_amount: Number(remitForm.checkAmount || 0),
        variance_amount: remitVariance,
        reference_no: remitForm.referenceNo,
        received_by: '',
        received_at: remitForm.remittanceDate,
        remittance_remarks: remitForm.remarks,
        remitted_by: remitForm.remittedBy || user?.name || collectorFullName(remitBatch.collector),
      })
      await loadRcdBatches()
      setRemitDialogOpen(false)
      setRemitBatch(null)
      setRemitForm(defaultRemitForm())
    } catch (error) {
      const errors = error.response?.data?.errors
      setRemitMessage(Array.isArray(errors) ? errors.join(' ') : error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to remit RCD.')
    } finally {
      setSavingAction('')
    }
  }

  const submitReceiveRemittance = async () => {
    if (!receiveBatch) return
    if (Number(receiveForm.amountReceived || 0) <= 0) {
      setReceiveMessage('Amount received must be greater than zero.')
      return
    }
    if (!receiveForm.receivedByAco.trim()) {
      setReceiveMessage('Received by ACO is required.')
      return
    }
    if (!receiveForm.confirmed) {
      setReceiveMessage('Please check the confirmation box before receiving.')
      return
    }
    if (Math.round(receiveVariance * 100) !== 0 && !receiveForm.remarks.trim()) {
      setReceiveMessage('Variance requires remarks.')
      return
    }

    setSavingAction('Receiving')
    setReceiveMessage('')
    try {
      await axiosInstance.post(`/rcd/batches/${encodeURIComponent(receiveBatch.action_key || receiveBatch.id)}/receive`, {
        amount_received: Number(receiveForm.amountReceived || 0),
        variance_amount: receiveVariance,
        received_by_aco: receiveForm.receivedByAco,
        received_by_aco_at: receiveForm.receivedAt,
        remittance_remarks: receiveForm.remarks,
        confirmed: receiveForm.confirmed,
      })
      await loadRcdBatches()
      setReceiveDialogOpen(false)
      setReceiveBatch(null)
    } catch (error) {
      const errors = error.response?.data?.errors
      setReceiveMessage(Array.isArray(errors) ? errors.join(' ') : error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to receive remittance.')
    } finally {
      setSavingAction('')
    }
  }

  const openAuditTrail = async (row) => {
    setSavingAction('Loading')
    try {
      const response = await axiosInstance.get(`/rcd/batches/${encodeURIComponent(row.action_key || row.id)}/audit`)
      setAuditRows(response.data?.data || [])
      setAuditTitle(row.id && row.id !== '-' ? row.id : `RCD #${row.db_id}`)
      setAuditDialogOpen(true)
    } catch (error) {
      setAccessError(error.response?.data?.error || error.response?.data?.message || error.message || 'Unable to load audit trail.')
    } finally {
      setSavingAction('')
    }
  }

  const loadAccessStatus = async () => {
    setLoadingAccess(true)
    setAccessError('')
    try {
      const response = await axiosInstance.get('/rcd/access/status')
      setAccessStatus(response.data?.data || response.data)
    } catch (error) {
      setAccessError(error.response?.data?.message || error.message || 'Unable to check MySQL status.')
      setAccessStatus(null)
    } finally {
      setLoadingAccess(false)
    }
  }

  useEffect(() => {
    loadAccessStatus()
    loadRcdBatches().catch((error) => setAccessError(error.response?.data?.error || error.message || 'Unable to load RCD batches.'))
    loadAccountableForms().catch((error) => setAccessError(error.response?.data?.error || error.message || 'Unable to load accountable forms.'))
  }, [])

  const actionTabs = [
    { key: 'overview', label: 'Overview', icon: <AccountBalanceIcon /> },
    { key: 'entries', label: 'Daily Entries', icon: <ReceiptLongIcon /> },
    // { key: 'generate-rcd', label: 'Generate RCD', icon: <LocalPrintshopIcon /> },
    // { key: 'review-queue', label: 'Review Queue', icon: <FactCheckIcon /> },
    // { key: 'deposit-queue', label: 'Deposit Queue', icon: <PaidIcon /> },
    { key: 'accountability', label: 'Accountable Forms', icon: <Inventory2Icon /> },
  ]

  const renderCollectionRows = () => {
    if (collectionLines.length === 0) {
      return (
        <TableRow>
          <TableCell align="center" colSpan={9} sx={{ color: uiColors.steel, fontWeight: 800, py: 4 }}>
            Enter OR lines, then validate against Firebird .FDB.
          </TableCell>
        </TableRow>
      )
    }

    return collectionLines.map((line) => {
      const receiptCount = countReceiptRange(line.receiptFrom, line.receiptTo)
      const difference = Number(line.collectorAmount || 0) - Number(line.fdbAmount || 0)
      return (
        <TableRow hover key={line.id}>
          <TableCell sx={{ minWidth: 210 }}>
            <TextField fullWidth onChange={(event) => updateLine(line.id, 'formType', event.target.value)} select size="small" value={formTypeLabel(line.formType)}>
              {formTypeOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </TextField>
          </TableCell>
          <TableCell><TextField onChange={(event) => updateLine(line.id, 'receiptFrom', event.target.value.replace(/\D/g, ''))} size="small" sx={{ minWidth: 120 }} value={line.receiptFrom} /></TableCell>
          <TableCell><TextField onChange={(event) => updateLine(line.id, 'receiptTo', event.target.value.replace(/\D/g, ''))} size="small" sx={{ minWidth: 120 }} value={line.receiptTo} /></TableCell>
          <TableCell align="center" sx={{ fontWeight: 800 }}>{receiptCount || '-'}</TableCell>
          <TableCell><TextField onChange={(event) => updateLine(line.id, 'collectorAmount', Number(event.target.value.replace(/[^0-9.]/g, '') || 0))} size="small" value={line.collectorAmount || ''} /></TableCell>
          <TableCell align="right" sx={{ fontWeight: 800 }}>{line.validated ? formatPeso(line.fdbAmount) : 'Validate'}</TableCell>
          <TableCell align="right" sx={{ color: difference === 0 ? 'var(--color-success-dark)' : 'var(--color-danger-dark)', fontWeight: 900 }}>{line.validated ? formatPeso(difference) : '-'}</TableCell>
          <TableCell align="center"><StatusChip value={line.validationStatus} /></TableCell>
          <TableCell align="center"><Button color="error" onClick={() => removeCollectionLine(line.id)} size="small">Remove</Button></TableCell>
        </TableRow>
      )
    })
  }

  const renderAccountableFormsEntry = () => {
    const accountableRows = collectionLines.filter((line) => line.formType && line.receiptFrom)

    return (
      <Paper sx={{ border: `1px solid ${uiColors.cardBorder}`, borderRadius: 4, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: `1px solid ${uiColors.cardBorder}`, p: 2.5 }}>
          <Typography variant="h6" sx={{ color: uiColors.navy, fontWeight: 900 }}>C. Accountability of Accountable Forms</Typography>
          <Typography variant="body2" sx={{ color: uiColors.steel }}>
            First RCD entry has no previous OR balance yet. Encode beginning balance and receipt manually; issued OR is pulled from A. Collections.
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small" sx={{ minWidth: 1120 }}>
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#f7f9fc', color: uiColors.navy, fontWeight: 900, textAlign: 'center', textTransform: 'uppercase' } }}>
                <TableCell rowSpan={2}>Name of Accountable Form</TableCell>
                <TableCell colSpan={3}>Beginning Balance</TableCell>
                <TableCell colSpan={3}>Receipt</TableCell>
                <TableCell colSpan={3}>Issued</TableCell>
                <TableCell colSpan={3}>Ending Balance</TableCell>
              </TableRow>
              <TableRow sx={{ '& th': { bgcolor: '#f7f9fc', color: uiColors.navy, fontWeight: 900, textAlign: 'center', textTransform: 'uppercase' } }}>
                {['Qty', 'From', 'To', 'Qty', 'From', 'To', 'Qty', 'From', 'To', 'Qty', 'From', 'To'].map((label, index) => (
                  <TableCell key={`${label}-${index}`}>{label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {accountableRows.length === 0 ? (
                <TableRow>
                  <TableCell align="center" colSpan={13} sx={{ color: uiColors.steel, fontWeight: 800, py: 4 }}>
                    Add OR lines in A. Collections to preview accountability rows.
                  </TableCell>
                </TableRow>
              ) : accountableRows.map((line) => {
                const issuedQty = countReceiptRange(line.receiptFrom, line.receiptTo)
                const endingBalance = calculateEndingBalance(line)
                return (
                  <TableRow hover key={`accountable-${line.id}`}>
                    <TableCell sx={{ fontWeight: 900 }}>{formTypeLabel(line.formType)}</TableCell>
                    <TableCell align="center"><TextField onChange={(event) => updateLine(line.id, 'beginningQty', event.target.value.replace(/\D/g, ''))} size="small" sx={{ width: 82 }} value={line.beginningQty || ''} /></TableCell>
                    <TableCell align="center"><TextField onChange={(event) => updateLine(line.id, 'beginningFrom', event.target.value.replace(/\D/g, ''))} size="small" sx={{ width: 118 }} value={line.beginningFrom || ''} /></TableCell>
                    <TableCell align="center"><TextField onChange={(event) => updateLine(line.id, 'beginningTo', event.target.value.replace(/\D/g, ''))} size="small" sx={{ width: 118 }} value={line.beginningTo || ''} /></TableCell>
                    <TableCell align="center"><TextField onChange={(event) => updateLine(line.id, 'receiptAccountQty', event.target.value.replace(/\D/g, ''))} size="small" sx={{ width: 82 }} value={line.receiptAccountQty || ''} /></TableCell>
                    <TableCell align="center"><TextField onChange={(event) => updateLine(line.id, 'receiptAccountFrom', event.target.value.replace(/\D/g, ''))} size="small" sx={{ width: 118 }} value={line.receiptAccountFrom || ''} /></TableCell>
                    <TableCell align="center"><TextField onChange={(event) => updateLine(line.id, 'receiptAccountTo', event.target.value.replace(/\D/g, ''))} size="small" sx={{ width: 118 }} value={line.receiptAccountTo || ''} /></TableCell>
                    <TableCell align="center" sx={{ fontWeight: 900 }}>{issuedQty || '-'}</TableCell>
                    <TableCell align="center">{line.receiptFrom || '-'}</TableCell>
                    <TableCell align="center">{line.receiptTo || line.receiptFrom || '-'}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 900 }}>{endingBalance.qty}</TableCell>
                    <TableCell align="center">{endingBalance.from}</TableCell>
                    <TableCell align="center">{endingBalance.to}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    )
  }

  const renderCollectionEntry = () => (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Paper sx={{ border: `1px solid ${uiColors.cardBorder}`, borderRadius: 4, overflow: 'hidden' }}>
        <Box sx={{ alignItems: 'center', background: `linear-gradient(135deg, ${uiColors.navy} 0%, ${uiColors.teal} 100%)`, color: '#fff', display: 'flex', gap: 2, justifyContent: 'space-between', p: 3 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>A. Collections</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>Collector enters sold OR ranges, form type, and amount. System validates against Firebird .FDB.</Typography>
          </Box>
          <Chip label={`${totals.receiptCount} receipts`} sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 900 }} />
        </Box>

        <Box sx={{ display: 'grid', gap: 2.5, p: 3 }}>
          <Box sx={{ alignItems: 'center', display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr auto' } }}>
            <TextField fullWidth label="Report No." onChange={(event) => updateForm('reportNo', event.target.value)} placeholder="Manual RCD no." value={form.reportNo} />
            <TextField fullWidth InputLabelProps={{ shrink: true }} label="Collection Date" onChange={(event) => updateForm('collectionDate', event.target.value)} type="date" value={form.collectionDate} />
            <TextField fullWidth label="Collector" onChange={(event) => updateForm('collector', event.target.value)} select value={form.collector}>
              {collectorOptions.map((collector) => <MenuItem key={collector.value} value={collector.value}>{collector.label}</MenuItem>)}
            </TextField>
            <Button disabled={generatingOr} onClick={validateCollectorLines} startIcon={generatingOr ? <CircularProgress color={'inherit'} size={18} /> : <FactCheckIcon />} sx={toolbarButtonSx(uiColors.teal, uiColors.tealHover)} variant={'contained'}>{generatingOr ? 'Validating' : 'Validate in .FDB'}</Button>
          </Box>

          <Alert severity="info" sx={{ borderRadius: 3 }}>
            Report No. is manual and may be left blank until the remittance receiver assigns it. Download/Print will generate one workbook with both 100_GF and 200_SEF template sheets.
          </Alert>
          {generateMessage && <Alert severity={generateMessage.startsWith('Validated') ? 'success' : generateMessage.startsWith('Validation completed') || generateMessage.startsWith('No matching') || generateMessage.startsWith('Please enter') ? 'warning' : 'error'} sx={{ borderRadius: 3 }}>{generateMessage}</Alert>}

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
            <Table size="small" sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow sx={{ '& th': { bgcolor: '#f7f9fc', color: uiColors.navy, fontWeight: 900, textAlign: 'center', textTransform: 'uppercase' } }}>
                  <TableCell>Type / Form No.</TableCell>
                  <TableCell>OR From</TableCell>
                  <TableCell>OR To</TableCell>
                  <TableCell>Receipts</TableCell>
                  <TableCell>Collector Amount</TableCell>
                  <TableCell>.FDB Amount</TableCell>
                  <TableCell>Difference</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>

                </TableRow>
              </TableHead>
              <TableBody>
                {renderCollectionRows()}
                <TableRow sx={{ '& td': { bgcolor: '#f8fbff', fontWeight: 900 } }}>
                  <TableCell colSpan={3}>PHP Total Collections</TableCell>
                  <TableCell align="center">{totals.receiptCount}</TableCell>
                  <TableCell align="right">{formatPeso(totals.collectorTotal)}</TableCell>
                  <TableCell align="right">{formatPeso(totals.fdbTotal)}</TableCell>
                  <TableCell align="right" sx={{ color: totals.difference === 0 ? 'var(--color-success-dark)' : 'var(--color-danger-dark)' }}>{formatPeso(totals.difference)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'space-between' }}>
            <Button onClick={addCollectionLine} sx={secondaryToolbarButtonSx(uiColors.teal)} variant={'outlined'}>Add OR Line</Button>
          </Box>
        </Box>
      </Paper>

      {renderAccountableFormsEntry()}
    </Box>
  )

  const renderGenerateRcd = () => (
    <Paper sx={{ border: `1px solid ${uiColors.cardBorder}`, borderRadius: 4, p: 3 }}>
      <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ color: uiColors.navy, fontWeight: 900 }}>Generate RCD Preview</Typography>
          <Typography variant="body2" sx={{ color: uiColors.steel }}>Official form structure: A. Collections and C. Accountability of Accountable Forms.</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button startIcon={<LocalPrintshopIcon />} sx={secondaryToolbarButtonSx(uiColors.sky)} variant="outlined">Print</Button>
          <Button sx={toolbarButtonSx(uiColors.navy, uiColors.navyHover)} variant="contained">Download Excel</Button>
        </Box>
      </Box>

      <Box sx={{ bgcolor: '#fff', border: '1px solid #222', color: '#111', fontFamily: 'Arial, sans-serif', mx: 'auto', maxWidth: 980, p: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 900 }}>REPORT OF COLLECTIONS AND DEPOSIT</Typography>
          <Typography sx={{ fontSize: 13, textDecoration: 'underline' }}>Municipality of Zamboanguita</Typography>
          <Typography sx={{ fontSize: 12 }}>LGU</Typography>
        </Box>
        <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: '1fr 220px', mb: 2 }}>
          <Typography sx={{ fontSize: 12 }}>Fund: <strong>{form.template === '100_GF' ? '100 General Fund' : '200 Special Education Fund'}</strong></Typography>
          <Typography sx={{ fontSize: 12 }}>Date: <strong>{form.collectionDate}</strong></Typography>
          <Typography sx={{ fontSize: 12 }}>Name of Accountable Officer: <strong>{form.collector}</strong></Typography>
          <Typography sx={{ fontSize: 12 }}>Report No.: __________</Typography>
        </Box>
        <Typography sx={{ border: '1px solid #222', borderBottom: 0, fontSize: 12, fontWeight: 900, p: 1 }}>A. COLLECTIONS</Typography>
        <Table size="small" sx={{ border: '1px solid #222', '& td, & th': { border: '1px solid #222', fontSize: 12 } }}>
          <TableHead><TableRow><TableCell>Type (Form No.)</TableCell><TableCell align="center">From</TableCell><TableCell align="center">To</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
          <TableBody>
            {collectionLines.length === 0 ? (
              <TableRow><TableCell align="center" colSpan={4}>No collection lines loaded.</TableCell></TableRow>
            ) : collectionLines.map((line) => (
            <TableRow key={line.id}><TableCell>{formTypeLabel(line.formType)}</TableCell><TableCell align="center">{line.receiptFrom}</TableCell><TableCell align="center">{line.receiptTo}</TableCell><TableCell align="right">{Number(line.collectorAmount || 0).toFixed(2)}</TableCell></TableRow>
            ))}
            <TableRow><TableCell align="right" colSpan={3}><strong>PHP</strong></TableCell><TableCell align="right"><strong>{totals.collectorTotal.toFixed(2)}</strong></TableCell></TableRow>
          </TableBody>
        </Table>
        <Typography sx={{ border: '1px solid #222', borderTop: 0, borderBottom: 0, fontSize: 12, fontWeight: 900, p: 1, mt: 2 }}>C. ACCOUNTABILITY OF ACCOUNTABLE FORMS</Typography>
        <Table size="small" sx={{ border: '1px solid #222', '& td, & th': { border: '1px solid #222', fontSize: 11 } }}>
          <TableHead><TableRow><TableCell>Name of Form</TableCell><TableCell>Beg. Balance</TableCell><TableCell>Receipt</TableCell><TableCell>Issued</TableCell><TableCell>Ending Balance</TableCell></TableRow></TableHead>
          <TableBody><TableRow><TableCell align="center" colSpan={5}>No accountability records loaded.</TableCell></TableRow></TableBody>
        </Table>
      </Box>
    </Paper>
  )

  const actionItemsForRow = (row) => {
    const status = row.stage
    const items = [{ label: 'View Details', onClick: () => openUpdateEntry(row) }]

    if (status === 'Voided' || status === 'Cancelled') {
      items.push({ label: 'Audit Trail', onClick: () => openAuditTrail(row) })
      return items
    }

    if (status === 'Draft') {
      if (collectorView || acoView) items.push({ label: 'Edit', onClick: () => openUpdateEntry(row) })
      items.push({ label: 'Validate', onClick: () => openUpdateEntry(row) })
      if (collectorView || acoView) items.push({ label: 'Delete Draft', onClick: () => deleteRcd(row), danger: true })
      return items
    }

    if ((status === 'For Remittance' || status === 'Saved' || status === 'Ready for Remittance') && collectorActionView) {
      items.push({ label: 'Remit to ACO', onClick: () => openRemitDialog(row), accent: true })
      items.push({ label: 'Edit', onClick: () => openUpdateEntry(row) })
      items.push({ label: 'Void / Cancel', onClick: () => setAccessError('Void / Cancel with reason is prepared for the next control step.'), danger: true })
      return items
    }

    if ((status === 'For Remittance' || status === 'Saved' || status === 'Ready for Remittance') && acoView) {
      items.push({ label: 'Print', onClick: () => printRcd(row) })
      items.push({ label: 'Download PDF', onClick: () => downloadRcd(row) })
      items.push({ label: 'Audit Trail', onClick: () => openAuditTrail(row) })
      return items
    }

    if (status === 'Remitted to ACO') {
      if (acoView) items.push({ label: 'Receive Remittance', onClick: () => openReceiveDialog(row), accent: true })
      items.push({ label: 'Print', onClick: () => printRcd(row) })
      items.push({ label: 'Download PDF', onClick: () => downloadRcd(row) })
      items.push({ label: 'Audit Trail', onClick: () => openAuditTrail(row) })
      return items
    }

    if (status === 'Received by ACO' || status === 'Printed' || status === 'Remitted') {
      items.push({ label: status === 'Printed' ? 'Reprint' : 'Print', onClick: () => printRcd(row) })
      items.push({ label: 'Download PDF', onClick: () => downloadRcd(row) })
      items.push({ label: 'Audit Trail', onClick: () => openAuditTrail(row) })
      if (acoView) items.push({ label: 'Void / Cancel with reason', onClick: () => setAccessError('Void / Cancel with reason is prepared for the next control step.'), danger: true })
      return items
    }

    items.push({ label: 'Audit Trail', onClick: () => openAuditTrail(row) })
    return items
  }

  const renderBatchTable = (title, description, rows = filteredBatches) => (
    <TableContainer component={Paper} sx={{ border: `1px solid ${uiColors.cardBorder}`, borderRadius: 4, boxShadow: '0 10px 26px rgba(15,39,71,0.08)' }}>
      <Box sx={{ borderBottom: `1px solid ${uiColors.cardBorder}`, p: 2.5 }}>
        <Typography variant="h6" sx={{ color: uiColors.navy, fontWeight: 900 }}>{title}</Typography>
        <Typography variant="body2" sx={{ color: uiColors.steel }}>{description}</Typography>
      </Box>
      <Table sx={{ minWidth: 1160 }}>
        <TableHead><TableRow sx={{ '& th': { bgcolor: '#f7f9fc', color: uiColors.navy, fontWeight: 900, textTransform: 'uppercase' } }}><TableCell>Report No.</TableCell><TableCell>Date</TableCell><TableCell>Collector</TableCell><TableCell>Fund</TableCell><TableCell>Forms</TableCell><TableCell align="center">Entries</TableCell><TableCell align="center">Receipts</TableCell><TableCell align="right">Total</TableCell><TableCell align="center">Status</TableCell><TableCell align="center" sx={{ minWidth: 360 }}>Action</TableCell></TableRow></TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell align="center" colSpan={10} sx={{ color: uiColors.steel, fontWeight: 800, py: 4 }}>No RCD batches found.</TableCell></TableRow>
          ) : rows.map((row) => (
            <TableRow hover key={row.action_key || row.id || row.db_id}>
              <TableCell sx={{ fontWeight: 900 }}>{row.id}</TableCell>
              <TableCell>{row.date}</TableCell>
              <TableCell>{row.collector}</TableCell>
              <TableCell>{row.fund}</TableCell>
              <TableCell>{row.forms}</TableCell>
              <TableCell align="center">{row.entries}</TableCell>
              <TableCell align="center">{row.receipt_count || 0}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 900 }}>{formatPeso(row.total)}</TableCell>
              <TableCell align="center"><StatusChip value={row.stage} /></TableCell>
              <TableCell align="center">
                <Button endIcon={<MoreVertIcon />} onClick={(event) => openActionMenu(event, row)} size="small" sx={secondaryToolbarButtonSx(uiColors.navy)} variant="outlined">Actions</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )

  const renderAccountability = () => (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Paper sx={{ border: `1px solid ${uiColors.cardBorder}`, borderRadius: 4, p: 3 }}>
        <Box sx={{ alignItems: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ color: uiColors.navy, fontWeight: 900, mb: 0.5 }}>Accountable Forms Tracking</Typography>
            <Typography variant="body2" sx={{ color: uiColors.steel }}>
              Phase 2: encode the Accountable Forms released by the custodian to each collector. These ranges will be used by RCD validation.
            </Typography>
          </Box>
          <Chip label={`${accountabilityRows.length} releases`} sx={{ bgcolor: 'var(--color-primary-soft)', color: uiColors.teal, fontWeight: 900 }} />
        </Box>

        <Alert severity="info" sx={{ borderRadius: 3, mb: 2 }}>
          This records the logbook release only. Firebird remains read-only, and sold OR totals still come from RCD validation.
        </Alert>
        {accountabilityMessage && (
          <Alert severity={accountabilityMessage.toLowerCase().includes('saved') ? 'success' : 'warning'} sx={{ borderRadius: 3, mb: 2 }}>
            {accountabilityMessage}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
          <TextField
            label="Type / Form No."
            onChange={(event) => updateAccountabilityForm('formType', event.target.value)}
            select
            value={accountabilityForm.formType}
          >
            {formTypeOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </TextField>
          <TextField label="Serial / Booklet No." onChange={(event) => updateAccountabilityForm('serialNo', event.target.value)} value={accountabilityForm.serialNo} />
          <TextField label="OR From" onChange={(event) => updateAccountabilityForm('receiptFrom', event.target.value)} value={accountabilityForm.receiptFrom} />
          <TextField label="OR To" onChange={(event) => updateAccountabilityForm('receiptTo', event.target.value)} value={accountabilityForm.receiptTo} />
          <TextField
            label="Collector"
            onChange={(event) => updateAccountabilityForm('collector', event.target.value)}
            select
            value={accountabilityForm.collector}
          >
            {collectorOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
          <TextField InputLabelProps={{ shrink: true }} label="Date Released" onChange={(event) => updateAccountabilityForm('releasedAt', event.target.value)} type="date" value={accountabilityForm.releasedAt} />
          <TextField label="Released By" onChange={(event) => updateAccountabilityForm('releasedBy', event.target.value)} value={accountabilityForm.releasedBy} />
          <TextField label="Collector Signed By" onChange={(event) => updateAccountabilityForm('collectorSignedBy', event.target.value)} value={accountabilityForm.collectorSignedBy} />
        </Box>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr auto auto' }, mt: 2 }}>
          <TextField label="Remarks" onChange={(event) => updateAccountabilityForm('remarks', event.target.value)} value={accountabilityForm.remarks} />
          <Paper variant="outlined" sx={{ alignItems: 'center', borderRadius: 2, display: 'flex', minHeight: 56, px: 2 }}>
            <Typography sx={{ color: uiColors.steel, fontWeight: 800, mr: 1 }}>Receipts:</Typography>
            <Typography sx={{ color: uiColors.navy, fontWeight: 950 }}>{accountabilityReceiptCount}</Typography>
          </Paper>
          <Button
            disabled={savingAccountability}
            onClick={saveAccountableFormRelease}
            startIcon={savingAccountability ? <CircularProgress color="inherit" size={16} /> : <SaveIcon />}
            sx={toolbarButtonSx(uiColors.teal, uiColors.tealHover)}
            variant="contained"
          >
            Save Release
          </Button>
        </Box>
      </Paper>

      <TableContainer component={Paper} sx={{ borderRadius: 4 }}>
        <Table sx={{ minWidth: 1220 }}>
          <TableHead>
            <TableRow sx={{ '& th': { bgcolor: '#f7f9fc', color: uiColors.navy, fontWeight: 900, textTransform: 'uppercase' } }}>
              <TableCell>Released</TableCell>
              <TableCell>Form</TableCell>
              <TableCell>Serial</TableCell>
              <TableCell>Collector</TableCell>
              <TableCell>OR Range</TableCell>
              <TableCell align="center">Receipts</TableCell>
              <TableCell>Released By</TableCell>
              <TableCell>Signed By</TableCell>
              <TableCell>Ending Balance</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Remarks</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accountabilityRows.length === 0 ? (
              <TableRow><TableCell align="center" colSpan={11} sx={{ color: uiColors.steel, fontWeight: 800, py: 4 }}>No accountable form releases saved yet.</TableCell></TableRow>
            ) : accountabilityRows.map((row) => (
              <TableRow hover key={row.id || `${row.form_type}-${row.receipt_no_from}-${row.receipt_no_to}`}>
                <TableCell>{row.released_at || '-'}</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>{row.form_type || '-'}</TableCell>
                <TableCell>{row.serial_no || '-'}</TableCell>
                <TableCell>{row.collector_full_name || row.collector || '-'}</TableCell>
                <TableCell>{row.receipt_no_from || '-'} to {row.receipt_no_to || '-'}</TableCell>
                <TableCell align="center" sx={{ fontWeight: 900 }}>{row.receipt_count || 0}</TableCell>
                <TableCell>{row.released_by || '-'}</TableCell>
                <TableCell>{row.collector_signed_by || '-'}</TableCell>
                <TableCell>{row.ending_balance_from || '-'} to {row.ending_balance_to || '-'}</TableCell>
                <TableCell><StatusChip value={row.status || 'Released'} /></TableCell>
                <TableCell>{row.remarks || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )

  const renderMainSection = () => {
    if (activeSection === 'entries') return renderBatchTable('Daily Entries', 'Saved and draft RCD batches for the selected period.')
    if (activeSection === 'generate-rcd') return renderGenerateRcd()
    if (activeSection === 'accountability') return renderAccountability()
    // Review Queue hidden temporarily while focusing on core RCD validation.
    // Deposit Queue hidden temporarily while focusing on core RCD validation.
    return (
      <Box sx={{ display: 'grid', gap: 3 }}>
        <Alert severity="info" sx={{ borderRadius: 3 }}>
          Collector side is for sold OR ranges and amount only. Accountable Forms custody, release, return, and logbook signatures stay under Accountability.
        </Alert>
        {renderBatchTable('RCD Daily Batches', 'Grouped by collection date and collector. One RCD batch can contain many form lines.')}
      </Box>
    )
  }

  return (
    <Box sx={{ bgcolor: uiColors.pageBg, display: 'grid', gap: 3, minHeight: '100%', p: { xs: 1, md: 0 } }}>
      <Paper sx={{ border: `1px solid ${uiColors.cardBorder}`, borderRadius: 4, boxShadow: '0 10px 26px rgba(15,39,71,0.08)', p: 3 }}>
        <Box sx={{ alignItems: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="overline" sx={{ color: uiColors.teal, fontWeight: 900 }}>Report of Collections and Deposit</Typography>
            <Typography variant="h4" sx={{ color: uiColors.navy, fontWeight: 950, lineHeight: 1.1 }}>RCD Workspace</Typography>
            <Typography sx={{ color: uiColors.steel, fontWeight: 700, mt: 0.5 }}>Old ETMS-style workflow rebuilt for Firebird OR validation and MySQL RCD storage.</Typography>
          </Box>
          <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <Chip color={accessStatus?.exists ? 'success' : 'default'} label={accessStatus?.exists ? 'MySQL Ready' : 'MySQL Not Ready'} sx={{ fontWeight: 900 }} />
            <Button onClick={loadAccessStatus} sx={secondaryToolbarButtonSx(uiColors.sky)} variant="outlined">{loadingAccess ? 'Checking...' : 'Check MySQL'}</Button>
          </Box>
        </Box>
        {accessError && <Alert severity="error" sx={{ mt: 2 }}>{accessError}</Alert>}
      </Paper>

      <Paper sx={{ border: `1px solid ${uiColors.cardBorder}`, borderRadius: 4, p: 2.5 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
          {actionTabs.map((tab) => (
            <Tooltip key={tab.key} title={tab.label}>
              <Button onClick={() => setActiveSection(tab.key)} startIcon={tab.icon} sx={activeSection === tab.key ? toolbarButtonSx(uiColors.navy, uiColors.navyHover) : secondaryToolbarButtonSx(uiColors.navy)} variant={activeSection === tab.key ? 'contained' : 'outlined'}>{tab.label}</Button>
            </Tooltip>
          ))}
          <Box sx={{ flex: 1 }} />
          <Button onClick={openNewEntry} startIcon={<ReceiptLongIcon />} sx={toolbarButtonSx(uiColors.teal, uiColors.tealHover)} variant="contained">New Entry</Button>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' } }}>
        {[
          { label: 'Total RCD Amount', value: formatPeso(summary.total), icon: <AccountBalanceIcon />, accent: uiColors.navy, onClick: () => setActiveSection('overview') },
          { label: 'Draft RCD', value: summary.draft, icon: <ReceiptLongIcon />, accent: uiColors.amber, onClick: () => setActiveSection('entries') },
          { label: 'Saved / Printed', value: summary.saved, icon: <LocalPrintshopIcon />, accent: uiColors.teal, onClick: () => setActiveSection('entries') },
        ].map((item) => (
          <Card key={item.label} onClick={item.onClick} sx={metricCardSx}>
            <Box sx={{ display: 'grid', gap: 1, p: 2.5 }}>
              <Box sx={{ alignItems: 'center', bgcolor: `${item.accent}14`, borderRadius: 2, color: item.accent, display: 'inline-flex', height: 42, justifyContent: 'center', width: 42 }}>{item.icon}</Box>
              <Typography variant="h5" sx={{ color: uiColors.navy, fontWeight: 950 }}>{item.value}</Typography>
              <Typography variant="body2" sx={{ color: uiColors.steel, fontWeight: 800 }}>{item.label}</Typography>
            </Box>
          </Card>
        ))}
      </Box>

      <Paper sx={{ border: `1px solid ${uiColors.cardBorder}`, borderRadius: 4, p: 2.5 }}>
        <Box sx={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Autocomplete onChange={(_, value) => setSelectedMonth(value)} options={months} renderInput={(params) => <TextField {...params} label="Select Month" size="small" />} sx={{ minWidth: 190 }} value={selectedMonth} />
          <Autocomplete onChange={(_, value) => setSelectedYear(value)} options={years} renderInput={(params) => <TextField {...params} label="Select Year" size="small" />} sx={{ minWidth: 160 }} value={selectedYear} />
          <TextField InputProps={{ startAdornment: <SearchIcon sx={{ color: uiColors.steel, mr: 1 }} /> }} label="Search collector / report" onChange={(event) => setSearch(event.target.value)} size="small" sx={{ minWidth: { xs: '100%', md: 300 } }} value={search} />
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" sx={{ color: uiColors.steel, fontWeight: 800 }}>{selectedMonth?.label || 'Month'} {selectedYear?.value || 'Year'}</Typography>
        </Box>
      </Paper>

      {renderMainSection()}

      <Menu anchorEl={actionMenuAnchor} onClose={closeActionMenu} open={Boolean(actionMenuAnchor)}>
        {(actionMenuRow ? actionItemsForRow(actionMenuRow) : []).map((item) => (
          <MenuItem
            key={item.label}
            onClick={() => runMenuAction(item.onClick)}
            sx={{
              color: item.danger ? 'var(--color-danger-dark)' : item.accent ? uiColors.teal : uiColors.navy,
              fontWeight: item.accent || item.danger ? 900 : 700,
              minWidth: 220,
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog fullWidth maxWidth="xl" onClose={() => !savingAction && setEntryDialogOpen(false)} open={entryDialogOpen}>
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ color: uiColors.navy, fontWeight: 900 }}>New RCD Entry</Typography>
            <Typography variant="body2" sx={{ color: uiColors.steel }}>Encode A. Collections, review C. Accountability, then save as draft or print.</Typography>
          </Box>
          <IconButton disabled={Boolean(savingAction)} onClick={() => setEntryDialogOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>{renderCollectionEntry()}</DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button disabled={Boolean(savingAction)} onClick={() => setEntryDialogOpen(false)}>Close</Button>
          <Button disabled={Boolean(savingAction)} onClick={() => saveRcdEntry('Draft')} startIcon={savingAction === 'Draft' ? <CircularProgress size={16} /> : <SaveIcon />} sx={secondaryToolbarButtonSx(uiColors.teal)} variant="outlined">Save as Draft</Button>
          <Button disabled={Boolean(savingAction)} onClick={() => saveRcdEntry('For Remittance')} startIcon={savingAction === 'For Remittance' ? <CircularProgress color="inherit" size={16} /> : <PaidIcon />} sx={toolbarButtonSx(uiColors.navy, uiColors.navyHover)} variant="contained">Save for Remittance</Button>
          <Button disabled={Boolean(savingAction)} onClick={() => saveRcdEntry('Printed')} startIcon={savingAction === 'Printed' ? <CircularProgress color="inherit" size={16} /> : <LocalPrintshopIcon />} sx={toolbarButtonSx(uiColors.teal, uiColors.tealHover)} variant="contained">Print</Button>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="md" onClose={() => !savingAction && setRemitDialogOpen(false)} open={remitDialogOpen}>
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ color: uiColors.navy, fontWeight: 900 }}>Confirm RCD Remittance</Typography>
            <Typography variant="body2" sx={{ color: uiColors.steel }}>Collector officially turns over collections to the Treasurer/Cashier.</Typography>
          </Box>
          <IconButton disabled={Boolean(savingAction)} onClick={() => setRemitDialogOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {remitMessage && <Alert severity="error" sx={{ mb: 2 }}>{remitMessage}</Alert>}
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
              <TextField InputProps={{ readOnly: true }} label="RCD No." value={remitBatch?.id || '-'} />
              <TextField InputProps={{ readOnly: true }} label="Collector name" value={remitBatch?.collector || '-'} />
              <TextField InputProps={{ readOnly: true }} label="Collection date" value={remitBatch?.date || '-'} />
              <TextField InputProps={{ readOnly: true }} label="OR range" value={`${remitBatch?.lines?.[0]?.receiptFrom || '-'} to ${remitBatch?.lines?.[remitBatch?.lines?.length - 1]?.receiptTo || '-'}`} />
              <TextField InputProps={{ readOnly: true }} label="OR count" value={remitBatch?.lines?.reduce((sum, line) => sum + countReceiptRange(line.receiptFrom, line.receiptTo), 0) || remitBatch?.receipt_count || 0} />
              <TextField InputProps={{ readOnly: true }} label="Total collection amount" value={formatPeso(remitBatch?.total)} />
            </Box>

            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
              <TextField label="Amount remitted" onChange={(event) => setRemitForm((current) => ({ ...current, amountRemitted: Number(event.target.value || 0) }))} type="number" value={remitForm.amountRemitted} />
              <TextField label="Remitted by" onChange={(event) => setRemitForm((current) => ({ ...current, remittedBy: event.target.value }))} value={remitForm.remittedBy || ''} />
              <TextField InputLabelProps={{ shrink: true }} label="Remitted date/time" onChange={(event) => setRemitForm((current) => ({ ...current, remittanceDate: event.target.value }))} type="datetime-local" value={remitForm.remittanceDate} />
              <TextField label="Cash amount" onChange={(event) => setRemitForm((current) => ({ ...current, cashAmount: Number(event.target.value || 0) }))} type="number" value={remitForm.cashAmount} />
              <TextField label="Check amount" onChange={(event) => setRemitForm((current) => ({ ...current, checkAmount: Number(event.target.value || 0) }))} type="number" value={remitForm.checkAmount} />
              <TextField label="Reference no." onChange={(event) => setRemitForm((current) => ({ ...current, referenceNo: event.target.value }))} value={remitForm.referenceNo} />
            </Box>

            <Alert severity={Math.round(remitVariance * 100) === 0 ? 'success' : 'warning'} sx={{ borderRadius: 3 }}>
              Variance: <strong>{formatPeso(remitVariance)}</strong>{Math.round(remitVariance * 100) !== 0 ? ' - remarks are required.' : ''}
            </Alert>
            <TextField fullWidth label="Remarks" minRows={3} multiline onChange={(event) => setRemitForm((current) => ({ ...current, remarks: event.target.value }))} value={remitForm.remarks} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button disabled={Boolean(savingAction)} onClick={() => setRemitDialogOpen(false)}>Cancel</Button>
          <Button disabled={Boolean(savingAction)} onClick={submitRemittance} startIcon={savingAction === 'Remitting' ? <CircularProgress color="inherit" size={16} /> : <PaidIcon />} sx={toolbarButtonSx(uiColors.teal, uiColors.tealHover)} variant="contained">Confirm Remit</Button>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="sm" onClose={() => !savingAction && setReceiveDialogOpen(false)} open={receiveDialogOpen}>
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ color: uiColors.navy, fontWeight: 900 }}>Receive Remittance</Typography>
            <Typography variant="body2" sx={{ color: uiColors.steel }}>ACO verifies and receives the collector remittance.</Typography>
          </Box>
          <IconButton disabled={Boolean(savingAction)} onClick={() => setReceiveDialogOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {receiveMessage && <Alert severity="error" sx={{ mb: 2 }}>{receiveMessage}</Alert>}
          <Box sx={{ display: 'grid', gap: 2 }}>
            <TextField InputProps={{ readOnly: true }} label="RCD No." value={receiveBatch?.id || '-'} />
            <TextField InputProps={{ readOnly: true }} label="Collector name" value={receiveBatch?.collector || '-'} />
            <TextField InputProps={{ readOnly: true }} label="Total collection amount" value={formatPeso(receiveBatch?.total)} />
            <TextField label="Amount received" onChange={(event) => setReceiveForm((current) => ({ ...current, amountReceived: Number(event.target.value || 0) }))} type="number" value={receiveForm.amountReceived} />
            <Alert severity={Math.round(receiveVariance * 100) === 0 ? 'success' : 'warning'} sx={{ borderRadius: 3 }}>
              Variance amount: <strong>{formatPeso(receiveVariance)}</strong>{Math.round(receiveVariance * 100) !== 0 ? ' - remarks are required.' : ''}
            </Alert>
            <TextField label="Received by ACO" onChange={(event) => setReceiveForm((current) => ({ ...current, receivedByAco: event.target.value }))} value={receiveForm.receivedByAco} />
            <TextField InputLabelProps={{ shrink: true }} label="Received date/time" onChange={(event) => setReceiveForm((current) => ({ ...current, receivedAt: event.target.value }))} type="datetime-local" value={receiveForm.receivedAt} />
            <TextField fullWidth label="Remarks" minRows={3} multiline onChange={(event) => setReceiveForm((current) => ({ ...current, remarks: event.target.value }))} value={receiveForm.remarks} />
            <FormControlLabel control={<Checkbox checked={receiveForm.confirmed} onChange={(event) => setReceiveForm((current) => ({ ...current, confirmed: event.target.checked }))} />} label="I confirm that the amount received was verified against the RCD collection total." />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button disabled={Boolean(savingAction)} onClick={() => setReceiveDialogOpen(false)}>Cancel</Button>
          <Button disabled={Boolean(savingAction)} onClick={submitReceiveRemittance} startIcon={savingAction === 'Receiving' ? <CircularProgress color="inherit" size={16} /> : <AssignmentTurnedInIcon />} sx={toolbarButtonSx(uiColors.teal, uiColors.tealHover)} variant="contained">Confirm Receive</Button>
        </DialogActions>
      </Dialog>

      <Dialog fullWidth maxWidth="md" onClose={() => setAuditDialogOpen(false)} open={auditDialogOpen}>
        <DialogTitle sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ color: uiColors.navy, fontWeight: 900 }}>Audit Trail</Typography>
            <Typography variant="body2" sx={{ color: uiColors.steel }}>{auditTitle}</Typography>
          </Box>
          <IconButton onClick={() => setAuditDialogOpen(false)}><CloseIcon /></IconButton>
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
                    <TableCell sx={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{typeof row.details === 'string' ? row.details : JSON.stringify(row.details, null, 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions><Button onClick={() => setAuditDialogOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  )
}
