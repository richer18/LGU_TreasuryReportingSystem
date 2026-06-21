const safeText = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const formatDate = (dateValue) => {
  if (!dateValue) return ''

  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return safeText(dateValue)

  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const formatAmount = (value) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]

const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const wordsUnderThousand = (number) => {
  const hundred = Math.floor(number / 100)
  const rest = number % 100
  const parts = []

  if (hundred) parts.push(`${ones[hundred]} Hundred`)
  if (rest >= 20) {
    const ten = Math.floor(rest / 10)
    const one = rest % 10
    parts.push(one ? `${tens[ten]} ${ones[one]}` : tens[ten])
  } else if (rest) {
    parts.push(ones[rest])
  }

  return parts.join(' ')
}

const amountInWords = (value) => {
  const amount = Number(value || 0)
  const pesos = Math.floor(amount)
  const centavos = Math.round((amount - pesos) * 100)

  if (!pesos && !centavos) return 'Zero Pesos Only'

  const scales = [
    [1000000000, 'Billion'],
    [1000000, 'Million'],
    [1000, 'Thousand'],
    [1, ''],
  ]

  let remaining = pesos
  const parts = []

  scales.forEach(([scale, label]) => {
    const chunk = Math.floor(remaining / scale)
    if (!chunk) return

    parts.push(`${wordsUnderThousand(chunk)}${label ? ` ${label}` : ''}`)
    remaining %= scale
  })

  const pesoWords = `${parts.join(' ')} Peso${pesos === 1 ? '' : 's'}`
  const centavoWords = centavos ? ` and ${centavos}/100` : ''

  return `${pesoWords}${centavoWords} Only`
}

const detailDescription = (detail) =>
  detail.child_description ||
  detail.raw_description ||
  detail.description ||
  detail.source_name ||
  'General Fund payment'

const buildRows = (row, details) => {
  const sourceRows = details.length
    ? details
    : [
        {
          amount: row.total_amount,
          raw_description: 'General Fund payment',
          source_code: '',
        },
      ]

  return Array.from({ length: 8 }, (_, index) => {
    const detail = sourceRows[index]
    const isTotalRow = index === 7

    if (isTotalRow) {
      return `
        <tr class="total-row">
          <td class="total-label">TOTAL</td>
          <td></td>
          <td><span class="peso">&#8369;</span><span class="amount-text">${formatAmount(row.total_amount)}</span></td>
        </tr>
      `
    }

    return `
      <tr>
        <td>${detail ? safeText(detailDescription(detail)) : ''}</td>
        <td>${detail ? safeText(detail.source_code || detail.account_code || '') : ''}</td>
        <td>${detail ? `<span class="amount-text">${formatAmount(detail.amount)}</span>` : ''}</td>
      </tr>
    `
  }).join('')
}

export const buildGeneralFundReceiptHtml = (row, details = []) => {
  const date = formatDate(row.collection_date)
  const rowsHtml = buildRows(row, details)
  const words = amountInWords(row.total_amount)

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Official Receipt ${safeText(row.receipt_no || '')}</title>
  <style>
    @page {
      size: 3.8in 8.27in;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    body {
      background: #fff;
      color: #000;
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 0;
    }

    .receipt {
      background: #fff;
      border: 2px solid #000;
      height: 8.27in;
      margin: 0 auto;
      overflow: hidden;
      width: 3.8in;
    }

    .header {
      align-items: start;
      border-bottom: 2px solid #000;
      display: grid;
      grid-template-columns: 0.7in 1fr 0.7in;
      height: 1.08in;
      padding: 0.05in 0.08in 0;
      text-align: center;
    }

    .seal {
      align-items: center;
      border: 2px solid #000;
      border-radius: 50%;
      display: flex;
      font-size: 0.065in;
      font-weight: 700;
      height: 0.58in;
      justify-content: center;
      line-height: 1.1;
      margin: 0.13in auto 0;
      text-align: center;
      width: 0.58in;
    }

    .left-seal {
      border-radius: 0.08in;
      font-size: 0.23in;
    }

    h1 {
      font-family: "Times New Roman", serif;
      font-size: 0.19in;
      line-height: 1;
      margin: 0;
    }

    .small {
      font-size: 0.13in;
      line-height: 1.05;
      margin-top: 0.02in;
    }

    .province {
      font-size: 0.15in;
      font-weight: 800;
      line-height: 1.1;
    }

    .office {
      font-size: 0.13in;
      line-height: 1.1;
      margin-top: 0.03in;
    }

    .city-line {
      border-top: 1px solid #000;
      font-size: 0.1in;
      margin: 0.17in auto 0;
      padding-top: 0.01in;
      width: 1.65in;
    }

    .top-info,
    .date-row {
      border-bottom: 2px solid #000;
      display: grid;
      grid-template-columns: 1.82in 1fr;
    }

    .top-info {
      height: 0.48in;
    }

    .form-no,
    .date-cell {
      border-right: 2px solid #000;
    }

    .form-no {
      font-size: 0.13in;
      line-height: 1.18;
      padding: 0.07in 0.14in;
    }

    .original {
      font-family: "Times New Roman", serif;
      font-size: 0.18in;
      font-weight: 800;
      padding-top: 0.07in;
      text-align: center;
    }

    .date-row {
      height: 0.44in;
    }

    .date-cell,
    .receipt-no,
    .agency-cell,
    .fund-cell,
    .payor-row {
      font-size: 0.12in;
      padding: 0.04in 0.08in;
    }

    .field-value {
      display: block;
      font-size: 0.11in;
      font-weight: 800;
      margin-top: 0.04in;
      text-align: center;
    }

    .agency-row {
      border-bottom: 2px solid #000;
      display: grid;
      grid-template-columns: 1fr 0.88in;
      height: 0.43in;
    }

    .agency-cell {
      border-right: 2px solid #000;
    }

    .payor-row {
      border-bottom: 2px solid #000;
      height: 0.39in;
    }

    .payor-row .field-value {
      display: inline-block;
      margin-left: 0.14in;
      margin-top: 0;
      max-width: 2.85in;
      overflow: hidden;
      text-align: left;
      text-overflow: ellipsis;
      vertical-align: baseline;
      white-space: nowrap;
    }

    table {
      border-collapse: collapse;
      table-layout: fixed;
      width: 100%;
    }

    .collection-table th,
    .collection-table td {
      border-bottom: 2px solid #000;
      border-right: 2px solid #000;
    }

    .collection-table th:last-child,
    .collection-table td:last-child {
      border-right: 0;
    }

    .collection-table th {
      font-size: 0.12in;
      font-weight: 500;
      height: 0.45in;
      line-height: 1.08;
      text-align: center;
      vertical-align: middle;
    }

    .collection-table td {
      font-size: 0.095in;
      height: 0.26in;
      overflow: hidden;
      padding: 0.02in 0.06in;
      text-overflow: ellipsis;
      vertical-align: middle;
      white-space: nowrap;
    }

    .nature {
      width: 1.82in;
    }

    .code {
      width: 0.82in;
    }

    .amount-text {
      float: right;
      font-weight: 700;
    }

    .peso {
      font-family: "Times New Roman", serif;
      font-size: 0.17in;
    }

    .total-row td {
      font-size: 0.11in;
      font-weight: 800;
      height: 0.27in;
    }

    .total-label {
      font-size: 0.17in !important;
      padding-left: 0.25in !important;
    }

    .amount-words {
      border-bottom: 2px solid #000;
      height: 0.55in;
    }

    .amount-words-label {
      border-bottom: 2px solid #000;
      font-size: 0.12in;
      height: 0.22in;
      padding: 0.025in 0.08in;
    }

    .words-value {
      font-family: "Times New Roman", serif;
      font-size: 0.1in;
      font-weight: 700;
      padding: 0.05in 0.08in;
      text-align: center;
    }

    .payment-row {
      border-bottom: 2px solid #000;
      display: grid;
      grid-template-columns: 1.16in 1fr;
      height: 0.73in;
    }

    .payment-options {
      border-right: 2px solid #000;
      font-size: 0.13in;
      line-height: 1.5;
      padding: 0.05in 0.1in;
    }

    .check-line {
      align-items: center;
      display: flex;
      gap: 0.06in;
      height: 0.19in;
    }

    .box {
      border: 2px solid #000;
      display: inline-block;
      height: 0.16in;
      width: 0.16in;
    }

    .bank-table th,
    .bank-table td {
      border-bottom: 2px solid #000;
      border-right: 2px solid #000;
      font-size: 0.09in;
      font-weight: 500;
      text-align: center;
    }

    .bank-table th:last-child,
    .bank-table td:last-child {
      border-right: 0;
    }

    .bank-table tr:last-child td {
      border-bottom: 0;
    }

    .received {
      border-bottom: 2px solid #000;
      font-family: "Times New Roman", serif;
      font-size: 0.15in;
      height: 0.86in;
      padding: 0.04in 0.09in;
      position: relative;
    }

    .signature {
      border-top: 2px solid #000;
      bottom: 0.09in;
      font-size: 0.15in;
      font-weight: 800;
      padding-top: 0.02in;
      position: absolute;
      right: 0;
      text-align: center;
      width: 2.18in;
    }

    .note {
      display: grid;
      font-size: 0.11in;
      grid-template-columns: 0.48in 1fr;
      line-height: 1.15;
      padding: 0.06in 0.12in;
    }

    @media print {
      .receipt {
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="seal left-seal">*</div>
      <div>
        <h1>OFFICIAL RECEIPT</h1>
        <div class="small">Republic of the Philippines</div>
        <div class="province">PROV. OF ORIENTAL NEGROS</div>
        <div class="office">OFFICE OF THE TREASURER</div>
        <div class="city-line">City/Municipality</div>
      </div>
      <div class="seal">PROVINCE<br>OF ORIENTAL<br>NEGROS</div>
    </div>

    <div class="top-info">
      <div class="form-no">Accountable Form No. 51<br>(Revised January 1992)</div>
      <div class="original">ORIGINAL</div>
    </div>

    <div class="date-row">
      <div class="date-cell">DATE <span class="field-value">${safeText(date)}</span></div>
      <div class="receipt-no">OR NO. <span class="field-value">${safeText(row.receipt_no || '')}</span></div>
    </div>

    <div class="agency-row">
      <div class="agency-cell">Agency <span class="field-value">Office of the Treasurer</span></div>
      <div class="fund-cell">Fund <span class="field-value">General Fund</span></div>
    </div>

    <div class="payor-row">Payor <span class="field-value">${safeText(row.taxpayer || '')}</span></div>

    <table class="collection-table">
      <thead>
        <tr>
          <th class="nature">NATURE OF<br>COLLECTION</th>
          <th class="code">ACCOUNT<br>CODE</th>
          <th>AMOUNT</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div class="amount-words">
      <div class="amount-words-label">AMOUNT IN WORDS</div>
      <div class="words-value">${safeText(words)}</div>
    </div>

    <div class="payment-row">
      <div class="payment-options">
        <div class="check-line"><span class="box"></span> Cash</div>
        <div class="check-line"><span class="box"></span> Check</div>
        <div class="check-line"><span class="box"></span> Money Order</div>
      </div>
      <table class="bank-table">
        <tr>
          <th>Drawee<br>Bank</th>
          <th>Number</th>
          <th>Date</th>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      </table>
    </div>

    <div class="received">
      Received the amount stated above.
      <div class="signature">${safeText(row.collector || 'Collecting Officer')}</div>
    </div>

    <div class="note">
      <strong>NOTE:</strong>
      <div>Write the number and date of this receipt on the back of<br>check or money order received.</div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      window.focus();
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>
`
}
