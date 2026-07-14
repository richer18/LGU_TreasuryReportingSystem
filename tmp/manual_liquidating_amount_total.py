from pathlib import Path
root = Path(r"\\MAIN-SERVER\LGU_TreasuryReportingSystem_$")
front = root / "frontend/src/pages/Rcd/RcdPage.jsx"
runner = root / "runner/rcd_access_store.py"
text = front.read_text(encoding="utf-8")

helper = """
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
    const rawOfficer = batch?.collector || batch?.remitted_by || batch?.remitted_to_aco_by || batch?.received_by || batch?.received_by_aco || ''
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
text = text.replace(helper, "\n", 1)

auto_effect = """
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
text = text.replace(auto_effect, "\n", 1)

marker = """  const totals = useMemo(() => {
    const collectorTotal = collectionLines.reduce((sum, line) => sum + Number(line.collectorAmount || 0), 0)
    const fdbTotal = collectionLines.reduce((sum, line) => sum + Number(line.fdbAmount || 0), 0)
    const receiptCount = collectionLines.reduce((sum, line) => sum + countReceiptRange(line.receiptFrom, line.receiptTo), 0)
    return { collectorTotal, fdbTotal, receiptCount, difference: collectorTotal - fdbTotal }
  }, [collectionLines])
"""
replacement = marker + """
  const liquidatingTotal = useMemo(
    () => liquidatingRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [liquidatingRows],
  )
"""
if marker not in text:
    raise SystemExit('totals marker not found')
text = text.replace(marker, replacement, 1)

text = text.replace("Report No. and Amount auto-fill from the selected collection date; manual entries are still allowed.", "Report No. and Amount are manual fields for the collector RCD template.", 1)
text = text.replace("""                <TextField
                  helperText={row.autoFilled ? 'Auto-filled from collection date' : ' '}
                  label="Report No."
                  onChange={(event) => updateLiquidatingRow(row.id, 'reportNo', event.target.value)}
                  value={row.reportNo || ''}
                />
                <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                  <TextField InputProps={{ readOnly: true }} label="Amount" sx={{ flex: 1 }} value={formatPeso(row.amount || totals.collectorTotal)} />
""", """                <TextField
                  label="Report No."
                  onChange={(event) => updateLiquidatingRow(row.id, 'reportNo', event.target.value)}
                  value={row.reportNo || ''}
                />
                <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
                  <TextField
                    label="Amount"
                    onChange={(event) => updateLiquidatingRow(row.id, 'amount', event.target.value.replace(/[^0-9.]/g, '').replace(/(\\..*)\\./g, '$1'))}
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                    sx={{ flex: 1 }}
                    value={row.amount || ''}
                  />
""", 1)
text = text.replace('''              <TextField InputProps={{ readOnly: true }} label="Amount" value={formatPeso(totals.collectorTotal)} />''', '''              <TextField InputProps={{ readOnly: true }} label="Amount" value={formatPeso(liquidatingTotal)} />''', 1)
front.write_text(text, encoding="utf-8")

rtext = runner.read_text(encoding="utf-8")
rtext = rtext.replace("""    for offset, item in enumerate(liquidating_rows[:3]):
        row = liquidating_row + offset
        amount_value = item.get("amount") or liquidating_amount or batch.get("total")
        sheet[f"A{row}"] = item.get("officerName") or item.get("name") or ""
        sheet[f"G{row}"] = item.get("reportNo") or item.get("report_no") or ""
        sheet[f"J{row}"] = money(amount_value)
        sheet[f"J{row}"].number_format = "#,##0.00"

    deposit_bank = form.get("depositOtherBank") if form.get("depositBank") == "Other Bank" else form.get("depositBank")
    if liquidating_rows or form.get("depositBank"):
        sheet[f"A{deposit_row}"] = deposit_bank or ""
        sheet[f"G{deposit_row}"] = form.get("depositReference") or ""
        sheet[f"J{deposit_row}"] = money(batch.get("total"))
        sheet[f"J{deposit_row}"].number_format = "#,##0.00"
""", """    liquidating_total = 0.0
    for offset, item in enumerate(liquidating_rows[:3]):
        row = liquidating_row + offset
        amount_value = money(item.get("amount"))
        liquidating_total += amount_value
        sheet[f"A{row}"] = item.get("officerName") or item.get("name") or ""
        sheet[f"G{row}"] = item.get("reportNo") or item.get("report_no") or ""
        sheet[f"J{row}"] = amount_value
        sheet[f"J{row}"].number_format = "#,##0.00"

    deposit_bank = form.get("depositOtherBank") if form.get("depositBank") == "Other Bank" else form.get("depositBank")
    if liquidating_rows or form.get("depositBank"):
        sheet[f"A{deposit_row}"] = deposit_bank or ""
        sheet[f"G{deposit_row}"] = form.get("depositReference") or ""
        sheet[f"J{deposit_row}"] = liquidating_total
        sheet[f"J{deposit_row}"].number_format = "#,##0.00"
""", 1)
runner.write_text(rtext, encoding="utf-8")
print('updated')
