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
  return { from: nextSerial(issuedTo, activeTo), qty: endingQty, to: activeTo }
}
const serialNumber = (value) => Number(String(value || '').replace(/\D/g, ''))
const isAfterDate = (left, right) => {
  if (!left || !right) return false
  return new Date(`${left}T00:00:00`) > new Date(`${right}T00:00:00`)
}
const release = {
  receipt_no_from: '0498051',
  receipt_no_to: '0498100',
  ending_balance_from: '0498062',
  ending_balance_to: '0498100',
  released_at: '2026-07-09',
}
const line = { formType: 'AF 51', receiptFrom: '0498062', receiptTo: '0498100' }
const form = { collectionDate: '2026-07-10' }
const issuedFrom = serialNumber(line.receiptFrom)
const issuedTo = serialNumber(line.receiptTo || line.receiptFrom)
const releasedFrom = release?.receipt_no_from || release?.beginning_balance_from || ''
const releasedTo = release?.receipt_no_to || release?.beginning_balance_to || ''
const endingFrom = release?.ending_balance_from || ''
const endingTo = release?.ending_balance_to || ''
const endingStart = serialNumber(endingFrom)
const endingEnd = serialNumber(endingTo)
const untouchedRelease = Boolean(release && endingFrom && endingTo && endingStart === serialNumber(releasedFrom) && endingEnd === serialNumber(releasedTo))
const issuedFallsWithinEndingBalance = Boolean(release && endingStart && endingEnd && issuedFrom >= endingStart && issuedTo <= endingEnd)
const releaseIsBeforeCollection = isAfterDate(form.collectionDate, release?.released_at)
const hasCarryForwardBalance = Boolean(release && endingFrom && endingTo && !untouchedRelease && (issuedFallsWithinEndingBalance || releaseIsBeforeCollection))
const beginningFrom = release ? (hasCarryForwardBalance ? endingFrom : '') : (line.beginningFrom || '')
const beginningTo = release ? (hasCarryForwardBalance ? endingTo : '') : (line.beginningTo || '')
const beginningQty = beginningFrom && beginningTo ? countReceiptRange(beginningFrom, beginningTo) : (release ? '' : (line.beginningQty || ''))
const receiptAccountFrom = release && !hasCarryForwardBalance ? releasedFrom : (release ? '' : (line.receiptAccountFrom || ''))
const receiptAccountTo = release && !hasCarryForwardBalance ? releasedTo : (release ? '' : (line.receiptAccountTo || ''))
const receiptAccountQty = receiptAccountFrom && receiptAccountTo ? countReceiptRange(receiptAccountFrom, receiptAccountTo) : (line.receiptAccountQty || '')
const ending = calculateEndingBalance({ ...line, beginningFrom, beginningQty, beginningTo, receiptAccountFrom, receiptAccountQty, receiptAccountTo })
console.log(JSON.stringify({ beginningQty, beginningFrom, beginningTo, receiptAccountQty, receiptAccountFrom, receiptAccountTo, issuedQty: countReceiptRange(line.receiptFrom, line.receiptTo), ending }, null, 2))
