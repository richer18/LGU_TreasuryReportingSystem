import { BookOpen, Calendar, FileSpreadsheet, FileText, Info, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import { getCashierCollectorAssignment } from '../../utils/cashierAssignments'

const UI_REPORT_NUMBERS = new Set([21, 22, 23, 27, 28, 31, 33])
const DOWNLOAD_ONLY_REPORT_NUMBERS = new Set([
  ...Array.from({ length: 20 }, (_, index) => index + 1),
  25,
  26,
  29,
  30,
  32,
  34,
])
const MAIN_REPORT_NUMBERS = new Set([...UI_REPORT_NUMBERS, ...DOWNLOAD_ONLY_REPORT_NUMBERS])
const COLLECTOR_REPORT_NUMBER = 34
const REPORT_COLLECTORS = [
  { value: 'flora', label: 'FLORA MY D. FERRER' },
  { value: 'agnes', label: 'AGNES B. ELLO' },
  { value: 'ricardo', label: 'RICARDO T. ENOPIA' },
  { value: 'angelique', label: 'ANGELIQUE IRIS A. RAFALES' },
  { value: 'emily', label: 'EMILY E. CREDO' },
]

const currentMonth = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const toDateValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getMonthRange = (monthValue) => {
  const [year, month] = monthValue.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)

  return {
    dateFrom: toDateValue(firstDay),
    dateTo: toDateValue(lastDay),
    label: firstDay.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
    monthName: firstDay.toLocaleDateString('en-PH', { month: 'long' }),
    year,
  }
}

const sourceRows = [
  'Manufacturing',
  'Distributor',
  'Retailing',
  'Banks & Other Financial Int.',
  'Other Business Tax',
  'Sand & Gravel',
  'Fines & Penalties',
  "Mayor's Permit",
  'Weights & Measures',
  'Tricycle Permit Fee',
  'Occupation Tax',
  'Cert. of Ownership',
  'Cert. of Transfer',
  'Cockpit Share',
  'Docking and Mooring Fee',
  'Sultadas',
  'Miscellaneous',
  'Registration of Birth',
  'Marriage Fee',
  'Burial Fee',
  'Correction of Entry',
  'Fishing Permit Fee',
  'Sale of Agri. Prod.',
  'Sale of Acct. Forms',
  'Water Fee',
  'Market Stall Fee',
  'Cash Tickets',
  'SlaughterHouse Fee',
  'Rental of Equipment',
  'Doc Stamp Tax',
  'Police Clearance',
  'Secretaries Fees',
  'Med./Lab. Fees',
  'Garbage Fees',
  'Cutting Tree',
  'Com Tax Cert.',
  'Building Permit Fee',
  'Electrical Permit Fee',
  'Zoning Fee',
  'Livestock',
  'Diving Fee',
]

const rptSummaryRows = [
  ['Real Property Tax - Basic/Land', '', '', '', '', '', '', '', '', '', '', ''],
  ['Current Year', '', '', 'result', '', '', 'result', '', '', '', 'result', ''],
  ['Previous Years', '', '', 'result', '', '', 'result', '', '', '', 'result', ''],
  ['Penalties', '', '', 'result', '', '', 'result', '', '', '', 'result', ''],
  ['Real Property Tax - SEF/Land', '', '', '', '', '', '', '', '', '', '', ''],
  ['Current Year', '', '', '', 'result', '', '', 'result', '', '', '', ''],
  ['Previous Years', '', '', '', 'result', '', '', 'result', '', '', '', ''],
  ['Penalties', '', '', '', 'result', '', '', 'result', '', '', '', ''],
  ['Real Property Tax - Basic/Bldg.', '', '', '', '', '', '', '', '', '', '', ''],
  ['Current Year', '', '', 'result', '', '', 'result', '', '', '', 'result', ''],
]

const rptRecordHeaders = [
  'Date',
  'Paid By',
  'Name of Tax Payer',
  'Period Covered',
  'Pin',
  'O.R. No.',
  'TD/Arp. No.',
  'Name of Brgy.',
  'Basic Tax',
  'SEF Tax',
  'Penalty',
  'Total',
]

const abstractGeneralHeaders = [
  'Date',
  'Receipt Number',
  'Names',
  'Manufacturing',
  'Distributor',
  'Retailing',
  'Financial',
  'Other',
  'Sand & Gravel',
  'Fines & Penalties',
  "Mayor's Permit",
  'W. & M.',
  'Tricycle Operators',
  'Occu.',
]

const abstractTrustHeaders = [
  'Date',
  'Receipt Number',
  'Names',
  'Building Fee 80% Local',
  '15% T.F.',
  "5% Nat'l.",
  'Electrical Fee',
  'Zoning Fee',
  'Livestock 80% Local',
  "20% Nat'l",
  'Diving Fee 40% GF',
  '30% Fishers',
  '30% Brgy',
  'Cashier',
]

const fullReportHeaders = ['DATE', 'CTC', 'RPT', 'GF AND TF', 'DUE FROM', 'RCD TOTAL']

const sharingSections = [
  ['BSC LAND', 'CURRENT', 'DISCOUNT', 'PRIOR', 'PENALTY CURRENT', 'PENALTY PRIOR'],
  ['AGRICULTURE', 'RESULT', 'RESULT', 'RESULT', 'RESULT', 'RESULT'],
  ['RESIDENTIAL', 'RESULT', 'RESULT', 'RESULT', 'RESULT', 'RESULT'],
  ['COMMERCIAL', 'RESULT', 'RESULT', 'RESULT', 'RESULT', 'RESULT'],
  ['SPECIAL', 'RESULT', 'RESULT', 'RESULT', 'RESULT', 'RESULT'],
  ['TOTAL', '0.00', '0.00', '0.00', '0.00', '0.00'],
]

const sharingLandRows = [
  ['AGRICULTURE', 11],
  ['RESIDENTIAL', 12],
  ['COMMERCIAL', 13],
  ['SPECIAL', 14],
]

const sharingBuildingRows = [
  ['MACHINERIES', 22],
  ['BLDG-RESIDENTIAL', 23],
  ['BLDG-COMMERCIAL', 24],
  ['BLDG-AGRICULTURE', 25],
  ['BLDG-INDUS/SPECIAL', 26],
]

const provincialRows = [
  ['Land Residential', '40102050-401-01-01', '', '40102050-401-01-01', '', '40102050-402-01-01', '', '40102050-402-01-01', ''],
  ['Land Commercial', '40102050-401-01-02', '', '40102050-401-01-02', '', '40102050-402-01-02', '', '40102050-402-01-02', ''],
  ['Land Industrial', '40102050-401-01-03', '', '40102050-401-01-03', '', '40102050-402-01-03', '', '40102050-402-01-03', ''],
  ['Land Machinery', '40102050-401-01-04', '', '40102050-401-01-04', '', '40102050-402-01-04', '', '40102050-402-01-04', ''],
  ['Land Agricultural', '40102050-401-01-05', '', '40102050-401-01-05', '', '40102050-402-01-05', '', '40102050-402-01-05', ''],
]

const provincialCodingRows = [
  { label: 'Land Residential', code: '40102040-101-01-01', sourceRow: 12 },
  { label: 'Land Commercial', code: '40102040-101-01-02', sourceRow: 13 },
  { label: 'Land Industrial', code: '40102040-101-01-03', sourceRow: 14 },
  { label: 'Land Machinery', code: '40102040-101-01-04', sourceRow: null },
  { label: 'Land Agricultural', code: '40102040-101-01-05', sourceRow: 11 },
  { label: 'Land Recreational', code: '40102040-101-01-06', sourceRow: null },
  { label: 'Land-TIMBER', code: '', sourceRow: null },
  { label: 'Building Residential', code: '40102040-101-02-01', sourceRow: 23 },
  { label: 'Building Commercial', code: '40102040-101-02-02', sourceRow: 24 },
  { label: 'Building Industrial', code: '40102040-101-02-03', sourceRow: 26 },
  { label: 'Building Machinery', code: '40102040-101-02-04', sourceRow: 22 },
  { label: 'Building Agricultural', code: '40102040-101-02-05', sourceRow: 25 },
  { label: 'Building Recreational', code: '40102040-101-02-06', sourceRow: null },
]

const taxOnBusinessRows = [
  ['Manufacturing', '-', '-', '-'],
  ['Distributor', '-', '-', '-'],
  ['Retailing', '-', '-', '-'],
  ['Banks & Other Financial Int.', '-', '-', '-'],
  ['Other Business Tax', '-', '-', '-'],
  ['Fines & Penalties', '-', '-', '-'],
]

const blank = '-'

const formatAmount = (value) => {
  if (value === '' || value === null || value === undefined) return ''

  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return value
  if (Math.abs(numberValue) < 0.005) return blank

  return numberValue.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const downloadErrorMessage = async (error) => {
  const data = error.response?.data

  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text)
      return parsed.error || parsed.message || text
    } catch {
      return error.message || 'Unable to download Excel report.'
    }
  }

  return data?.error || data?.message || error.message || 'Unable to download Excel report.'
}

const apiSummaryRowToTemplateRow = (row) => {
  if (row.section) {
    return [row.source, '', '', '', '', '', '', '', '', '', '', '']
  }

  return [
    row.source,
    formatAmount(row.total_collections),
    formatAmount(row.national),
    formatAmount(row.provincial_general_fund),
    formatAmount(row.provincial_sef),
    formatAmount(row.provincial_total),
    formatAmount(row.municipal_general_fund),
    formatAmount(row.municipal_sef),
    formatAmount(row.municipal_trust_fund),
    formatAmount(row.municipal_total),
    formatAmount(row.barangay_share),
    formatAmount(row.fisheries),
  ]
}

const apiSharingRowToTemplateRow = (row) => [
  row.property_group,
  row.category,
  formatAmount(row.bsc_amount),
  formatAmount(row.provincial_share_35),
  formatAmount(row.municipal_share_40),
  formatAmount(row.barangay_share_25),
]

const apiSharingCellsToMap = (cells = []) => cells.reduce((lookup, cell) => {
  lookup[`${cell.row}:${cell.column}`] = Number(cell.value || 0)
  return lookup
}, {})

const buildProvincialCodingSheet = (cellMap, sheet) => {
  const isGf = sheet === 'GF'
  const columns = isGf
    ? { current: 3, discount: 4, prior: 5, penaltyCurrent: 6, penaltyPrior: 7 }
    : { current: 10, discount: 11, prior: 12, penaltyCurrent: 13, penaltyPrior: 14 }
  const rate = isGf ? 0.35 : 0.50
  const totalLabel = isGf ? 'TOTAL REMITTANCE GF' : 'TOTAL REMITTANCE SEF'
  const valueAt = (row, column) => Number(cellMap?.[`${row}:${column}`] || 0)
  const amountFor = (row, column) => Number(row?.sourceRow ? valueAt(row.sourceRow, column) * rate : 0)
  const currentFor = (row) => Number(row?.sourceRow ? (valueAt(row.sourceRow, columns.current) - valueAt(row.sourceRow, columns.discount)) * rate : 0)
  const rows = provincialCodingRows.map((row) => [
    row.label,
    row.code,
    formatAmount(currentFor(row)),
    row.code,
    formatAmount(amountFor(row, columns.prior)),
    row.code ? row.code.replace('-101-', '-102-') : '',
    formatAmount(amountFor(row, columns.penaltyCurrent)),
    row.code ? row.code.replace('-101-', '-102-') : '',
    formatAmount(amountFor(row, columns.penaltyPrior)),
  ])
  const subtotal = rows.reduce((totals, row) => {
    totals.current += Number(String(row[2] || '').replace(/,/g, '')) || 0
    totals.prior += Number(String(row[4] || '').replace(/,/g, '')) || 0
    totals.penaltyCurrent += Number(String(row[6] || '').replace(/,/g, '')) || 0
    totals.penaltyPrior += Number(String(row[8] || '').replace(/,/g, '')) || 0
    return totals
  }, { current: 0, prior: 0, penaltyCurrent: 0, penaltyPrior: 0 })
  const totalRemittance = subtotal.current + subtotal.prior + subtotal.penaltyCurrent + subtotal.penaltyPrior

  return {
    fundTitle: isGf ? 'GENERAL FUND' : 'SEF',
    headersTop: ['', '', 'CURRENT YEAR', '', 'PRIOR YEAR', '', 'CURRENT YEAR PENALTY', '', 'PRIOR YEAR'],
    rows,
    subtotal: ['SUB TOTAL', '', formatAmount(subtotal.current), '', formatAmount(subtotal.prior), '', formatAmount(subtotal.penaltyCurrent), '', formatAmount(subtotal.penaltyPrior)],
    totalRemittance: [totalLabel, '', '', '', '', '', '', '', formatAmount(totalRemittance)],
  }
}

const apiFullReportRowToTemplateRow = (row) => [
  row.date,
  formatAmount(row.ctc),
  formatAmount(row.rpt),
  formatAmount(row.gf_tf),
  row.due_from || '',
  formatAmount(row.rcd_total),
]

const apiTaxOnBusinessRowToTemplateRow = (row) => [
  row.category,
  formatAmount(row.business_tax),
  formatAmount(row.surcharge),
  formatAmount(row.total),
]

const getTemplateDefinition = (report, period) => {
  const previewRows = report.previewData?.rows?.map(apiSummaryRowToTemplateRow)

  if ([21, 22].includes(report.number)) {
    return {
      kind: 'summary',
      title: 'SUMMARY OF COLLECTIONS',
      subtitle: 'ZAMBOANGUITA, NEGROS ORIENTAL',
      periodText: `Month of ${period.monthName} ${period.year}`,
      headersTop: ['SOURCES OF COLLECTIONS', 'TOTAL COLLECTIONS', 'NATIONAL', 'PROVINCIAL', '', '', 'MUNICIPAL', '', '', '', 'BARANGAY SHARE', 'FISHERIES'],
      headersBottom: ['', '', '', 'GENERAL FUND', 'SPECIAL EDUC. FUND', 'TOTAL', 'GENERAL FUND', 'SPECIAL EDUC. FUND', 'TRUST FUND', 'TOTAL', '', ''],
      rows: previewRows ?? sourceRows.slice(0, report.number === 22 ? 30 : 41).map((source) => [source, blank, '', '', '', '', '', '', '', '', '', '']),
    }
  }

  if (report.number === 23) {
    return {
      kind: 'summary',
      title: 'SUMMARY OF COLLECTIONS',
      subtitle: 'ZAMBOANGUITA, NEGROS ORIENTAL',
      periodText: `Month of ${period.monthName} ${period.year}`,
      headersTop: ['SOURCES OF COLLECTIONS', 'TOTAL COLLECTIONS', 'NATIONAL', 'PROVINCIAL', '', '', 'MUNICIPAL', '', '', '', 'BARANGAY SHARE', 'FISHERIES'],
      headersBottom: ['', '', '', 'GENERAL FUND', 'SPECIAL EDUC. FUND', 'TOTAL', 'GENERAL FUND', 'SPECIAL EDUC. FUND', 'TRUST FUND', 'TOTAL', '', ''],
      rows: previewRows ?? rptSummaryRows,
    }
  }

  if (report.number === 25) {
    return {
      kind: 'record',
      title: 'RECORD OF REAL PROPERTY TAX COLLECTION',
      meta: [['LGU:', 'MUNICIPALITY OF ZAMBOANGUITA'], ['PERIOD:', `${period.dateFrom} to ${period.dateTo}`], ['RPU CLASSIFICATION:', 'ALL CLASSIFICATION']],
      headers: rptRecordHeaders,
      rows: [['1', '', '', '', '', '', '', '', '', '', '', '']],
    }
  }

  if (report.number === 26) {
    return {
      kind: 'record',
      title: 'RECORD OF REAL PROPERTY TAX COLLECTION - ADVANCE PAYMENT REPORT',
      meta: [['LGU:', 'MUNICIPALITY OF ZAMBOANGUITA'], ['PERIOD:', `${period.dateFrom} to ${period.dateTo}`], ['RPU CLASSIFICATION:', 'ALL CLASSIFICATION']],
      headers: ['Date', 'Paid By', 'Taxpayer', 'Period Covered', 'Pin', 'O.R. No.', 'TD/Arp. No.', 'Barangay', 'BSC Gross', 'BSC Discount', 'BSC Total', 'SEF Gross', 'SEF Discount', 'SEF Total'],
      rows: [['1', '', '', '', '', '', '', '', '', '', '', '', '', '']],
    }
  }

  if (report.number === 27) {
    return {
      kind: 'sharing',
      title: 'SUMMARY REPORT SHARING',
      meta: [['MONTH:', period.monthName], ['DAY:', ''], ['YEAR:', period.year]],
      rows: report.previewData?.rows?.map(apiSharingRowToTemplateRow) ?? sharingSections,
      cellMap: apiSharingCellsToMap(report.previewData?.template_cells),
    }
  }

  if (report.number === 28) {
    const cellMap = apiSharingCellsToMap(report.previewData?.template_cells)

    return {
      kind: 'provincial-coding',
      title: 'MONTHLY REPORT ON THE COLLECTION OF REAL PROPERTY TAX',
      subtitle: 'BY PROPERTY CLASSIFICATION',
      municipality: 'Municipality of Zamboanguita',
      periodText: `For the month of ${period.monthName} ${period.year}`,
      sheets: [
        buildProvincialCodingSheet(cellMap, 'GF'),
        buildProvincialCodingSheet(cellMap, 'SEF'),
      ],
    }
  }

  if (report.number === 29) {
    return {
      kind: 'abstract',
      title: 'ABSTRACT OF GENERAL COLLECTIONS',
      subtitle: 'Municipality of Zamboanguita Province Of Negros Oriental',
      periodText: `${period.dateFrom} to ${period.dateTo}`,
      headers: abstractGeneralHeaders,
      rows: [['', '', '', '', '', '', '', '', '', '', '', '', '', '']],
    }
  }

  if (report.number === 30) {
    return {
      kind: 'abstract',
      title: 'ABSTRACT OF TRUST FUNDS',
      subtitle: 'Municipality of Zamboanguita, Province Of Negros Oriental',
      periodText: `${period.dateFrom} to ${period.dateTo}`,
      headers: abstractTrustHeaders,
      rows: [['', '', '', '', '', '', '', '', '', '', '', '', '', '']],
    }
  }

  if (report.number === 31) {
    return {
      kind: 'full',
      title: 'FULL REPORT',
      meta: [['MONTH:', period.monthName], ['YEAR:', period.year]],
      headers: fullReportHeaders,
      rows: report.previewData?.rows?.map(apiFullReportRowToTemplateRow) ?? [['', '', '', '', '', '']],
    }
  }

  if (report.number === 33) {
    return {
      kind: 'tax-business',
      title: 'TAX ON BUSINESS SUMMARY',
      subtitle: 'BPLS Business Tax',
      periodText: `${period.dateFrom} to ${period.dateTo}`,
      headers: ['Category', 'Business Tax', 'Fines & Penalties / Surcharge', 'Total'],
      rows: report.previewData?.rows?.map(apiTaxOnBusinessRowToTemplateRow) ?? taxOnBusinessRows,
    }
  }

  return {
    kind: 'other',
    title: report.name,
    subtitle: 'Other Reports 1 to 20',
    periodText: `${period.dateFrom} to ${period.dateTo}`,
    headers: ['Field', 'Value'],
    rows: [['Status', report.status], ['Group', report.group], ['Template', 'For documentation / future implementation']],
  }
}

const TemplateTable = ({ headers, rows }) => (
  <div className="excel-table-scroll">
    <table className="excel-template-table">
      <thead>
        <tr>{headers.map((header, index) => <th key={`${header}-${index}`}>{header}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>{row.map((value, index) => <td key={`${rowIndex}-${index}`}>{value}</td>)}</tr>
        ))}
      </tbody>
    </table>
  </div>
)

const SummaryTemplate = ({ template }) => (
  <article className="excel-template-sheet excel-summary-template printable-report">
    <header className="excel-template-heading">
      <h1>{template.title}</h1>
      <h2>{template.subtitle}</h2>
      <p>LGU</p>
      <p>{template.periodText}</p>
    </header>
    <div className="excel-table-scroll">
      <table className="excel-template-table summary-collection-table">
        <colgroup>
          <col className="summary-col-source" />
          <col className="summary-col-total" />
          <col className="summary-col-national" />
          <col className="summary-col-provincial-gf" />
          <col className="summary-col-provincial-sef" />
          <col className="summary-col-provincial-total" />
          <col className="summary-col-municipal-gf" />
          <col className="summary-col-municipal-sef" />
          <col className="summary-col-municipal-trust" />
          <col className="summary-col-municipal-total" />
          <col className="summary-col-barangay" />
          <col className="summary-col-fisheries" />
        </colgroup>
        <thead>
          <tr className="summary-header-main">
            <th rowSpan="2">Sources of Collections</th>
            <th rowSpan="2">Total Collections</th>
            <th rowSpan="2">National</th>
            <th colSpan="3">Provincial</th>
            <th colSpan="4">Municipal</th>
            <th rowSpan="2">Barangay Share</th>
            <th rowSpan="2">Fisheries</th>
          </tr>
          <tr className="summary-header-sub">
            <th>General Fund</th>
            <th>Special Educ. Fund</th>
            <th>Total</th>
            <th>General Fund</th>
            <th>Special Educ. Fund</th>
            <th>Trust Fund</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {template.rows.map((row, rowIndex) => (
            <tr className={row[0] === 'TOTAL' ? 'summary-total-row' : row[0]?.startsWith('Real Property Tax') ? 'summary-section-row' : ''} key={rowIndex}>
              {row.map((value, index) => <td key={`${rowIndex}-${index}`}>{value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </article>
)

const RecordTemplate = ({ template }) => (
  <article className="excel-template-sheet printable-report">
    <h1 className="excel-left-title">{template.title}</h1>
    <div className="excel-meta-grid rpt-record-meta">
      {template.meta.map(([label, value]) => (
        <div key={label}><strong>{label}</strong><span>{value}</span></div>
      ))}
    </div>
    <TemplateTable headers={template.headers} rows={template.rows} />
  </article>
)

const sharingValue = (template, row, column) => template.cellMap?.[`${row}:${column}`] || 0

const sumSharingRows = (template, rows, column) => rows.reduce((total, [, row]) => (
  total + Number(sharingValue(template, row, column) || 0)
), 0)

const sharingCollectionRowsFor = (template, rows, columns) => {
  const bodyRows = rows.map(([label, row]) => ({
    label,
    current: sharingValue(template, row, columns.current),
    discount: sharingValue(template, row, columns.discount),
    prior: sharingValue(template, row, columns.prior),
    penaltyCurrent: sharingValue(template, row, columns.penaltyCurrent),
    penaltyPrior: sharingValue(template, row, columns.penaltyPrior),
  }))

  return [
    ...bodyRows,
    {
      label: 'TOTAL',
      total: true,
      current: sumSharingRows(template, rows, columns.current),
      discount: sumSharingRows(template, rows, columns.discount),
      prior: sumSharingRows(template, rows, columns.prior),
      penaltyCurrent: sumSharingRows(template, rows, columns.penaltyCurrent),
      penaltyPrior: sumSharingRows(template, rows, columns.penaltyPrior),
    },
  ]
}

const sharingTotal = (row) => (
  Number(row.current || 0) - Number(row.discount || 0) + Number(row.prior || 0)
  + Number(row.penaltyCurrent || 0) + Number(row.penaltyPrior || 0)
)

const SharingCollectionPanel = ({ columns, title, template }) => {
  const landRows = sharingCollectionRowsFor(template, sharingLandRows, columns)
  const buildingRows = sharingCollectionRowsFor(template, sharingBuildingRows, columns)

  return (
    <section className="sharing-template-panel">
      <h2>{title}</h2>
      <table className="sharing-template-table">
        <colgroup>
          <col className="sharing-col-label" />
          <col className="sharing-col-amount" />
          <col className="sharing-col-amount" />
          <col className="sharing-col-amount" />
          <col className="sharing-col-amount" />
          <col className="sharing-col-amount" />
        </colgroup>
        <tbody>
          <tr className="sharing-section-row">
            <th colSpan="4">LAND</th>
            <th colSpan="2">Penalties</th>
          </tr>
          <tr>
            <th></th>
            <th>Current</th>
            <th>Discount</th>
            <th>Prior</th>
            <th>Current</th>
            <th>Prior</th>
          </tr>
          {landRows.map((row) => (
            <tr className={row.total ? 'sharing-total-row' : ''} key={`${title}-land-${row.label}`}>
              <td>{row.label}</td>
              <td>{formatAmount(row.current)}</td>
              <td>{formatAmount(row.discount)}</td>
              <td>{formatAmount(row.prior)}</td>
              <td>{formatAmount(row.penaltyCurrent)}</td>
              <td>{formatAmount(row.penaltyPrior)}</td>
            </tr>
          ))}
          <tr className="sharing-total-line">
            <td>LAND TOTAL</td>
            <td colSpan="5">{formatAmount(sharingTotal(landRows.at(-1)))}</td>
          </tr>
          <tr className="sharing-spacer-row"><td colSpan="6"></td></tr>
          <tr className="sharing-section-row">
            <th colSpan="4">BUILDING</th>
            <th colSpan="2">Penalties</th>
          </tr>
          <tr>
            <th></th>
            <th>Current</th>
            <th>Discount</th>
            <th>Prior</th>
            <th>Current</th>
            <th>Prior</th>
          </tr>
          {buildingRows.map((row) => (
            <tr className={row.total ? 'sharing-total-row' : ''} key={`${title}-building-${row.label}`}>
              <td>{row.label}</td>
              <td>{formatAmount(row.current)}</td>
              <td>{formatAmount(row.discount)}</td>
              <td>{formatAmount(row.prior)}</td>
              <td>{formatAmount(row.penaltyCurrent)}</td>
              <td>{formatAmount(row.penaltyPrior)}</td>
            </tr>
          ))}
          <tr className="sharing-total-line">
            <td>BUILDING TOTAL</td>
            <td colSpan="5">{formatAmount(sharingTotal(buildingRows.at(-1)))}</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

const SharingSharePanel = ({ columns, groupTitle, shares, template }) => {
  const landTotal = sharingCollectionRowsFor(template, sharingLandRows, columns).at(-1)
  const buildingTotal = sharingCollectionRowsFor(template, sharingBuildingRows, columns).at(-1)
  const rows = [
    ['Current', Number(landTotal.current || 0) - Number(landTotal.discount || 0), Number(buildingTotal.current || 0) - Number(buildingTotal.discount || 0)],
    ['Prior', Number(landTotal.prior || 0), Number(buildingTotal.prior || 0)],
    ['Penalties', Number(landTotal.penaltyCurrent || 0) + Number(landTotal.penaltyPrior || 0), Number(buildingTotal.penaltyCurrent || 0) + Number(buildingTotal.penaltyPrior || 0)],
  ]
  const landGrand = rows.reduce((total, row) => total + row[1], 0)
  const buildingGrand = rows.reduce((total, row) => total + row[2], 0)

  const shareCells = (amount) => shares.map((share) => formatAmount(amount * share.rate))
  const shareTotal = (amount) => shares.reduce((total, share) => total + amount * share.rate, 0)

  return (
    <section className="sharing-template-panel sharing-share-panel">
      <h2>{groupTitle}</h2>
      <table className="sharing-template-table">
        <tbody>
          <tr className="sharing-section-row">
            <th colSpan={2 + shares.length}>LAND SHARING</th>
          </tr>
          <tr>
            <th>Category</th>
            <th>LAND</th>
            {shares.map((share) => <th key={`land-${share.label}`}>{share.label}</th>)}
          </tr>
          {rows.map(([label, landAmount]) => (
            <tr key={`${groupTitle}-land-${label}`}>
              <td>{label}</td>
              <td>{formatAmount(landAmount)}</td>
              {shareCells(landAmount).map((value, index) => <td key={`${label}-${index}`}>{value}</td>)}
            </tr>
          ))}
          <tr className="sharing-total-row">
            <td>TOTAL</td>
            <td>{formatAmount(landGrand)}</td>
            {shareCells(landGrand).map((value, index) => <td key={`land-total-${index}`}>{value}</td>)}
          </tr>
          <tr className="sharing-total-line">
            <td>LAND SHARING TOTAL</td>
            <td colSpan={1 + shares.length}>{formatAmount(shareTotal(landGrand))}</td>
          </tr>
          <tr className="sharing-spacer-row"><td colSpan={2 + shares.length}></td></tr>
          <tr className="sharing-section-row sharing-building-section">
            <th colSpan={2 + shares.length}>BUILDING SHARING</th>
          </tr>
          <tr>
            <th>Category</th>
            <th>BUILDING</th>
            {shares.map((share) => <th key={`building-${share.label}`}>{share.label}</th>)}
          </tr>
          {rows.map(([label, , buildingAmount]) => (
            <tr key={`${groupTitle}-building-${label}`}>
              <td>{label}</td>
              <td>{formatAmount(buildingAmount)}</td>
              {shareCells(buildingAmount).map((value, index) => <td key={`${label}-building-${index}`}>{value}</td>)}
            </tr>
          ))}
          <tr className="sharing-total-row">
            <td>TOTAL</td>
            <td>{formatAmount(buildingGrand)}</td>
            {shareCells(buildingGrand).map((value, index) => <td key={`building-total-${index}`}>{value}</td>)}
          </tr>
          <tr className="sharing-total-line">
            <td>BUILDING SHARING TOTAL</td>
            <td colSpan={1 + shares.length}>{formatAmount(shareTotal(buildingGrand))}</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

const SharingTemplate = ({ template }) => (
  <article className="excel-template-sheet sharing-template-sheet printable-report">
    <h1 className="excel-left-title sharing-report-title">{template.title}</h1>
    <div className="sharing-meta-grid">
      {template.meta.map(([label, value]) => (
        <div key={label}><strong>{label}</strong><span>{value}</span></div>
      ))}
    </div>
    <div className="sharing-report-grid">
      <SharingCollectionPanel
        columns={{ current: 3, discount: 4, prior: 5, penaltyCurrent: 6, penaltyPrior: 7 }}
        template={template}
        title="BSC"
      />
      <SharingCollectionPanel
        columns={{ current: 10, discount: 11, prior: 12, penaltyCurrent: 13, penaltyPrior: 14 }}
        template={template}
        title="SEF"
      />
    </div>
    <div className="sharing-report-grid sharing-lower-grid">
      <SharingSharePanel
        columns={{ current: 3, discount: 4, prior: 5, penaltyCurrent: 6, penaltyPrior: 7 }}
        groupTitle="BSC - SHARING"
        shares={[
          { label: "35% Prov'l Share", rate: 0.35 },
          { label: '40% Mun. Share', rate: 0.40 },
          { label: '25% Brgy. Share', rate: 0.25 },
        ]}
        template={template}
      />
      <SharingSharePanel
        columns={{ current: 10, discount: 11, prior: 12, penaltyCurrent: 13, penaltyPrior: 14 }}
        groupTitle="SEF - SHARING"
        shares={[
          { label: "50% Prov'l Share", rate: 0.50 },
          { label: '50% Mun. Share', rate: 0.50 },
        ]}
        template={template}
      />
    </div>
  </article>
)

const ProvincialTemplate = ({ template }) => (
  <article className="excel-template-sheet printable-report">
    <header className="excel-template-heading">
      <h1>{template.title}</h1>
      <h2>{template.subtitle}</h2>
      <p>{template.municipality}</p>
      <p>{template.periodText}</p>
      <strong>{template.fundTitle}</strong>
    </header>
    <TemplateTable headers={template.headers} rows={template.rows} />
  </article>
)

const ProvincialCodingSheet = ({ sheet, template }) => (
  <section className="provincial-coding-sheet">
    <header className="excel-template-heading">
      <h1>{template.title}</h1>
      <h2>{template.subtitle}</h2>
      <p>{template.municipality}</p>
      <p>{template.periodText}</p>
      <strong>{sheet.fundTitle}</strong>
    </header>
    <div className="excel-table-scroll">
      <table className="provincial-coding-table">
        <thead>
          <tr>
            {sheet.headersTop.map((header, index) => (
              <th key={`${sheet.fundTitle}-header-${index}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, rowIndex) => (
            <tr key={`${sheet.fundTitle}-${rowIndex}`}>
              {row.map((value, index) => <td key={`${sheet.fundTitle}-${rowIndex}-${index}`}>{value}</td>)}
            </tr>
          ))}
          <tr className="provincial-coding-subtotal">
            {sheet.subtotal.map((value, index) => <td key={`${sheet.fundTitle}-subtotal-${index}`}>{value}</td>)}
          </tr>
          <tr className="provincial-coding-remittance">
            {sheet.totalRemittance.map((value, index) => <td key={`${sheet.fundTitle}-remittance-${index}`}>{value}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  </section>
)

const ProvincialCodingTemplate = ({ template }) => (
  <article className="excel-template-sheet provincial-coding-preview printable-report">
    {template.sheets.map((sheet) => (
      <ProvincialCodingSheet key={sheet.fundTitle} sheet={sheet} template={template} />
    ))}
  </article>
)

const AbstractTemplate = ({ template }) => (
  <article className="excel-template-sheet printable-report">
    <header className="excel-template-heading">
      <h1>{template.title}</h1>
      <h2>{template.subtitle}</h2>
      <p><strong>Period Covered:</strong> {template.periodText}</p>
    </header>
    <TemplateTable headers={template.headers} rows={template.rows} />
  </article>
)

const FullTemplate = ({ template }) => (
  <article className="excel-template-sheet printable-report full-report-template">
    <h1>{template.title}</h1>
    <div className="excel-meta-grid compact-meta">
      {template.meta.map(([label, value]) => (
        <div key={label}><strong>{label}</strong><span>{value}</span></div>
      ))}
    </div>
    <TemplateTable headers={template.headers} rows={template.rows} />
  </article>
)

const TaxOnBusinessTemplate = ({ template }) => (
  <article className="excel-template-sheet printable-report">
    <header className="excel-template-heading">
      <h1>{template.title}</h1>
      <h2>{template.subtitle}</h2>
      <p><strong>Period Covered:</strong> {template.periodText}</p>
    </header>
    <TemplateTable headers={template.headers} rows={template.rows} />
  </article>
)

const TemplatePreview = ({ report }) => {
  const template = getTemplateDefinition(report, report.period)

  if (template.kind === 'summary') return <SummaryTemplate template={template} />
  if (template.kind === 'record') return <RecordTemplate template={template} />
  if (template.kind === 'sharing') return <SharingTemplate template={template} />
  if (template.kind === 'provincial') return <ProvincialTemplate template={template} />
  if (template.kind === 'provincial-coding') return <ProvincialCodingTemplate template={template} />
  if (template.kind === 'abstract') return <AbstractTemplate template={template} />
  if (template.kind === 'full') return <FullTemplate template={template} />
  if (template.kind === 'tax-business') return <TaxOnBusinessTemplate template={template} />
  return <AbstractTemplate template={template} />
}

export function ReportsPage({ page, variant = 'reports', user }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [selectedReportNumber, setSelectedReportNumber] = useState('')
  const [selectedCollector, setSelectedCollector] = useState('')
  const [generatedReport, setGeneratedReport] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const range = useMemo(() => getMonthRange(selectedMonth), [selectedMonth])
  const cashierAssignment = getCashierCollectorAssignment(user)
  const collectorOptions = cashierAssignment ? [cashierAssignment] : REPORT_COLLECTORS
  const isCollectionMonitor = variant === 'collectionMonitor'
  const mainReports = page.reports.filter((report) => (
    MAIN_REPORT_NUMBERS.has(report.number) && !(report.number >= 1 && report.number <= 20)
  ))
  const otherReports = page.reports.filter((report) => report.number >= 1 && report.number <= 20)
  const quickReports = isCollectionMonitor ? page.reports : mainReports

  const findReport = (value) => page.reports.find((report) => String(report.number) === value)
  const selectedReport = findReport(selectedReportNumber)
  const requiresCollector = selectedReport?.number === COLLECTOR_REPORT_NUMBER

  useEffect(() => {
    if (cashierAssignment && requiresCollector) {
      setSelectedCollector(cashierAssignment.value)
    }
  }, [cashierAssignment, requiresCollector])

  const downloadReport = async (report, period) => {
    const params = {
      date_from: period.dateFrom,
      date_to: period.dateTo,
    }
    if (report.number === COLLECTOR_REPORT_NUMBER) {
      params.collector = selectedCollector
    }

    const response = await axiosInstance.get(`/generated-reports/${report.number}/download`, {
      params,
      responseType: 'blob',
    })
    const disposition = response.headers['content-disposition'] || ''
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/i)
    const fallbackName = `report-${report.number}-${selectedMonth}.xlsx`
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')

    link.href = url
    link.download = filenameMatch?.[1] || fallbackName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const generateReport = async () => {
    const report = findReport(selectedReportNumber)
    if (!report) return
    const isDownloadOnly = DOWNLOAD_ONLY_REPORT_NUMBERS.has(report.number)

    if (report.number === COLLECTOR_REPORT_NUMBER && !selectedCollector) {
      setGenerationError('Please select a collector for Generate Collection Receipt Per Collector.')
      return
    }

    setIsGenerating(true)
    setGenerationError('')

    try {
      if (isDownloadOnly) {
        await downloadReport(report, range)
        setGeneratedReport(null)
        return
      }

      const response = await axiosInstance.get(`/generated-reports/${report.number}/preview`, {
        params: {
          date_from: range.dateFrom,
          date_to: range.dateTo,
        },
      })

      setGeneratedReport({
        ...report,
        generatedAt: new Date().toLocaleString('en-PH'),
        period: range,
        previewData: response.data,
        selectedMonth,
      })
    } catch (error) {
      const message = isDownloadOnly
        ? await downloadErrorMessage(error)
        : error.response?.data?.error || error.message || 'Unable to generate report preview.'
      setGenerationError(message)

      if (!isDownloadOnly) {
        setGeneratedReport({
          ...report,
          generatedAt: new Date().toLocaleString('en-PH'),
          period: range,
          selectedMonth,
        })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadGeneratedReport = async () => {
    if (!generatedReport) return

    setIsDownloading(true)
    setGenerationError('')

    try {
      await downloadReport(generatedReport, generatedReport.period)
    } catch (error) {
      setGenerationError(await downloadErrorMessage(error))
    } finally {
      setIsDownloading(false)
    }
  }

  const printGeneratedReport = () => {
    window.print()
  }

  return (
    <div className={`page-stack reports-page ${isCollectionMonitor ? 'general-fund-page collection-monitor-page' : ''}`}>
      {isCollectionMonitor && (
        <section className="general-fund-hero">
          <div>
            <p className="eyebrow">Collection Monitor</p>
            <h2>{page.title}</h2>
          </div>
        </section>
      )}

      <section className="toolbar-panel master-report-panel report-generator-panel">
        <div className="report-generator-heading">
          <p className="eyebrow">{isCollectionMonitor ? 'Official Collection Reports' : 'Office of the Municipal Treasurer'}</p>
          <h2>{isCollectionMonitor ? 'Reports' : page.title}</h2>
          <p className="toolbar-description">
            {isCollectionMonitor
              ? page.description
              : 'Generate, preview, export, and print official LGU treasury report templates.'}
          </p>
        </div>

        {isCollectionMonitor && (
          <section className="action-strip collection-monitor-report-strip" aria-label={`${page.title} quick reports`}>
            {quickReports.map((report) => (
              <button
                key={report.number}
                onClick={() => {
                  setSelectedReportNumber(String(report.number))
                  setGeneratedReport(null)
                  setGenerationError('')
                }}
                type="button"
              >
                <FileText size={18} aria-hidden="true" />
                <span>{report.name}</span>
              </button>
            ))}
          </section>
        )}

        <div className="report-generator-controls">
          <label className="month-filter-field">
            <span><Calendar size={14} aria-hidden="true" /> Month and Year</span>
            <input
              aria-label="Month and year"
              onChange={(event) => setSelectedMonth(event.target.value)}
              type="month"
              value={selectedMonth}
            />
          </label>

          <label className="report-select-field">
            <span><BookOpen size={14} aria-hidden="true" /> Generate Report</span>
            <select
              aria-label="Generate report"
              onChange={(event) => {
                setSelectedReportNumber(event.target.value)
                setGenerationError('')
              }}
              value={selectedReportNumber}
            >
              <option value="">Select report</option>
              {mainReports.map((report) => (
                <option key={report.number} value={report.number}>{report.name}</option>
              ))}
              <optgroup label="Other Reports">
                {otherReports.map((report) => (
                  <option key={report.number} value={report.number}>{report.number}. {report.name}</option>
                ))}
              </optgroup>
            </select>
          </label>

          {requiresCollector && (
            <label className="report-select-field">
              <span><BookOpen size={14} aria-hidden="true" /> Collector</span>
              <select
                aria-label="Collector"
                disabled={Boolean(cashierAssignment)}
                onChange={(event) => {
                  setSelectedCollector(event.target.value)
                  setGenerationError('')
                }}
                value={selectedCollector}
              >
                {!cashierAssignment && <option value="">Select collector</option>}
                {collectorOptions.map((collector) => (
                  <option key={collector.value} value={collector.value}>{collector.label}</option>
                ))}
              </select>
            </label>
          )}

          <button className="primary-button generate-selected-report-button" disabled={!selectedReportNumber || isGenerating || (requiresCollector && !selectedCollector)} onClick={generateReport} type="button">
            <FileText size={15} aria-hidden="true" />
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        <div className="report-generator-helper">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>Report Scope</strong>
            <p>Choose a month and report template. Reports 1 to 34 are generated from the read-only Firebird bridge, BPLS workbook sources, and uploaded Excel templates.</p>
          </div>
        </div>

        {generationError && <p className="report-generation-error">{generationError}</p>}
      </section>

      {generatedReport && (
        <section className="generated-report-panel" aria-label="Generated report preview">
          <div className="generated-report-actions no-print">
            <div>
              <p className="eyebrow">Generated Preview</p>
              <h3>{generatedReport.name}</h3>
            </div>
            <div className="generated-report-buttons">
              <button className="secondary-button" disabled={isDownloading} onClick={downloadGeneratedReport} type="button">
                <FileSpreadsheet size={15} aria-hidden="true" />
                {isDownloading ? 'Downloading...' : 'Download'}
              </button>
              <button className="primary-button" onClick={printGeneratedReport} type="button">
                <Printer size={15} aria-hidden="true" />
                Print
              </button>
            </div>
          </div>

          <TemplatePreview report={generatedReport} />
        </section>
      )}
    </div>
  )
}
