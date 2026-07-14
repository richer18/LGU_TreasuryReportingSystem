from pathlib import Path

root = Path(r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$")
front = root / "frontend/src/pages/Rcd/RcdPage.jsx"
back = root / "backend/app/Services/RcdMysqlStoreService.php"

text = front.read_text(encoding="utf-8")
text = text.replace("""const emptyLiquidatingOfficerLine = () => ({
  id: makeClientId(),
  officerName: '',
  otherOfficerName: '',
  reportNo: '',
  amount: '',
})""", """const emptyLiquidatingOfficerLine = () => ({
  id: makeClientId(),
  officerName: '',
  otherOfficerName: '',
  reportNo: '',
  amount: '',
  autoFilled: false,
  sourceBatchKey: '',
  sourceDate: '',
})""")

old = """  const filteredAccountabilityRows = useMemo(() => {
    const term = accountabilitySearch.trim().toLowerCase()
    if (!term) return accountabilityRows

    return accountabilityRows.filter((row) => [
      row.released_at,
      row.returned_at,
      row.form_type,
      row.serial_no,
      row.collector_full_name,
      row.collector,
      row.receipt_no_from,
      row.receipt_no_to,
      row.receipt_count,
      row.released_by,
      row.signed_by,
      row.ending_balance,
      row.status,
      row.remarks,
    ].join(' ').toLowerCase().includes(term))
  }, [accountabilityRows, accountabilitySearch])
"""
new = old + """
  const cashierValueForName = (name) => {
    const normalized = String(name || '').trim().toLowerCase()
    if (!normalized) return ''
    const match = cashierOptions.find((cashier) => String(cashier.value || '').toLowerCase() === normalized || String(cashier.label || '').toLowerCase() === normalized)
    return match?.value || 'Others'
  }

  const rcdNoForLiquidatingBatch = (batch) => {
    const gf = cleanReportNo(batch?.gf_rcd_no || '')
    const sef = cleanReportNo(batch?.sef_rcd_no || '')
    const main = cleanReportNo(batch?.id || '')
    if (gf && sef && gf !== sef) return `${gf} / ${sef}`
    return gf || sef || main
  }

  const amountForLiquidatingBatch = (batch) => Number(batch?.amount_received || batch?.amount_remitted || batch?.total || 0)

  const liquidatingRowFromBatch = (batch) => {
    const rawOfficer = batch?.received_by_aco || batch?.received_by || batch?.remitted_by || batch?.remitted_to_aco_by || batch?.collector || ''
    const officerName = collectorFullName(rawOfficer)
    const selectedOfficer = cashierValueForName(officerName)
    return {
      ...emptyLiquidatingOfficerLine(),
      officerName: selectedOfficer,
      otherOfficerName: selectedOfficer === 'Others' ? officerName : '',
      reportNo: rcdNoForLiquidatingBatch(batch),
      amount: amountForLiquidatingBatch(batch),
      autoFilled: true,
      sourceBatchKey: batch?.action_key || batch?.id || `__dbid:${batch?.db_id || ''}`,
      sourceDate: batch?.date || '',
    }
  }
"""
if old not in text:
    raise SystemExit('filteredAccountabilityRows block not found or already changed')
text = text.replace(old, new, 1)

text = text.replace("""  const addLiquidatingRow = () => setLiquidatingRows((current) => [...current, emptyLiquidatingOfficerLine()])
  const updateLiquidatingRow = (id, field, value) => {
    setLiquidatingRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }
""", """  const addLiquidatingRow = () => setLiquidatingRows((current) => [...current, emptyLiquidatingOfficerLine()])
  const updateLiquidatingRow = (id, field, value) => {
    setLiquidatingRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value, autoFilled: false, sourceBatchKey: '', sourceDate: '' } : row)))
  }
""")

text = text.replace("""      const liquidatingPayload = liquidatingRows
        .filter((row) => Object.entries(row).some(([key, value]) => key !== 'id' && String(value || '').trim() !== ''))
        .map(({ id, ...row }) => ({
          ...row,
          officerName: row.officerName === 'Others' ? row.otherOfficerName : row.officerName,
        }))
""", """      const liquidatingPayload = liquidatingRows
        .filter((row) => ['officerName', 'otherOfficerName', 'reportNo', 'amount'].some((key) => String(row[key] || '').trim() !== ''))
        .map(({ id, autoFilled, sourceBatchKey, sourceDate, ...row }) => ({
          ...row,
          officerName: row.officerName === 'Others' ? row.otherOfficerName : row.officerName,
        }))
""")

text = text.replace("""          <Typography variant=\"body2\" sx={{ color: uiColors.steel }}>Manual fields for the collector RCD template.</Typography>
""", """          <Typography variant=\"body2\" sx={{ color: uiColors.steel }}>Report No. and Amount auto-fill from the selected collection date; manual entries are still allowed.</Typography>
""")

text = text.replace("""                <TextField label=\"Report No.\" onChange={(event) => updateLiquidatingRow(row.id, 'reportNo', event.target.value)} value={row.reportNo || ''} />
                <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                  <TextField InputProps={{ readOnly: true }} label=\"Amount\" sx={{ flex: 1 }} value={formatPeso(row.amount || totals.collectorTotal)} />
""", """                <TextField
                  helperText={row.autoFilled ? 'Auto-filled from collection date' : ' '}
                  label=\"Report No.\"
                  onChange={(event) => updateLiquidatingRow(row.id, 'reportNo', event.target.value)}
                  value={row.reportNo || ''}
                />
                <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                  <TextField InputProps={{ readOnly: true }} label=\"Amount\" sx={{ flex: 1 }} value={formatPeso(row.amount || totals.collectorTotal)} />
""")

load_effect = """  useEffect(() => {
    loadAccessStatus()
    if (!accountableCustodianView) {
      loadRcdBatches().catch((error) => setAccessError(error.response?.data?.error || error.message || 'Unable to load RCD batches.'))
    }
    loadAccountableForms().catch((error) => setAccessError(error.response?.data?.error || error.message || 'Unable to load accountable forms.'))
  }, [accountableCustodianView])
"""
auto_effect = load_effect + """
  useEffect(() => {
    if (!acoCollectorWorkflow || !form.collectionDate) return

    const matchingBatches = batches.filter((batch) => {
      const batchKey = batch?.action_key || batch?.id || `__dbid:${batch?.db_id || ''}`
      const hasReportNo = cleanReportNo(rcdNoForLiquidatingBatch(batch)) !== ''
      return batch?.date === form.collectionDate && hasReportNo && (!editingReportNo || batchKey !== editingReportNo)
    })

    if (!matchingBatches.length) {
      setLiquidatingRows((current) => (current.some((row) => row.autoFilled) ? [emptyLiquidatingOfficerLine()] : current))
      return
    }

    setLiquidatingRows((current) => {
      const hasManualRows = current.some((row) => !row.autoFilled && ['officerName', 'otherOfficerName', 'reportNo', 'amount'].some((key) => String(row[key] || '').trim() !== ''))
      if (hasManualRows) return current

      const nextRows = matchingBatches.map(liquidatingRowFromBatch)
      const currentSignature = current.map((row) => `${row.sourceBatchKey || ''}|${row.reportNo || ''}|${Number(row.amount || 0)}`).join(';')
      const nextSignature = nextRows.map((row) => `${row.sourceBatchKey || ''}|${row.reportNo || ''}|${Number(row.amount || 0)}`).join(';')
      return currentSignature === nextSignature ? current : nextRows
    })
  }, [acoCollectorWorkflow, batches, editingReportNo, form.collectionDate])
"""
if load_effect not in text:
    raise SystemExit('load useEffect block not found')
text = text.replace(load_effect, auto_effect, 1)
front.write_text(text, encoding="utf-8")

btext = back.read_text(encoding="utf-8")
oldb = """            'amount_received' => $this->money($row->total_received ?? 0),
            'variance_amount' => $this->money($row->variance_amount ?? 0),
            'stage' => $row->status,
"""
newb = """            'amount_received' => $this->money($row->total_received ?? 0),
            'variance_amount' => $this->money($row->variance_amount ?? 0),
            'remitted_by' => $row->remitted_by ?? '',
            'remitted_to_aco_by' => $row->remitted_to_aco_by ?? '',
            'received_by' => $row->received_by ?? '',
            'received_by_aco' => $row->received_by_aco ?? '',
            'stage' => $row->status,
"""
if oldb not in btext:
    raise SystemExit('backend summary block not found or already changed')
btext = btext.replace(oldb, newb, 1)
back.write_text(btext, encoding="utf-8")
print('updated')
