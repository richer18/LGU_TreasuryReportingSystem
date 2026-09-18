import { BookOpen, Calendar, Eraser, FileSpreadsheet, FileText, Info, LoaderCircle, Printer, RefreshCw, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import { getCashierCollectorAssignment } from '../../utils/cashierAssignments'
import { RealPropertyTaxPaymentCardReport } from './RealPropertyTaxPaymentCardReport'
import './ReportsDelinquency.css'

const UI_REPORT_NUMBERS = new Set([21, 22, 23, 27, 28, 31, 33])
const DOWNLOAD_ONLY_REPORT_NUMBERS = new Set([
  ...Array.from({ length: 20 }, (_, index) => index + 1),
  25,
  26,
  29,
  30,
  32,
  34,
  35,
  36,
  37,
  38,
  39,
])
const MAIN_REPORT_NUMBERS = new Set([...UI_REPORT_NUMBERS, ...DOWNLOAD_ONLY_REPORT_NUMBERS])
const COLLECTOR_REPORT_NUMBER = 34
const DATE_RANGE_REPORT_NUMBER = 37
const QUARTER_REPORT_NUMBER = 38
const CRAAF_REPORT_ID = 'craaf'
const DELINQUENCY_LIST_REPORT_ID = 'rpt-delinquency-list'
const DELINQUENCY_NOTICE_REPORT_ID = 'rpt-delinquency-notice'
const RPT_PAYMENT_CARD_REPORT_ID = 'rpt-payment-card'
const RPT_PAYMENT_CARD_REPORT = {
  number: RPT_PAYMENT_CARD_REPORT_ID,
  name: 'Real Property Tax Payment Card',
  group: 'rpt',
  status: 'implemented_read_only',
}
const DELINQUENCY_LIST_REPORT = {
  number: DELINQUENCY_LIST_REPORT_ID,
  name: 'List of Real Property Tax Delinquencies',
  group: 'rpt',
  status: 'implemented_read_only',
}
const DELINQUENCY_NOTICE_REPORT = {
  number: DELINQUENCY_NOTICE_REPORT_ID,
  name: 'Notice of Delinquency on the Payment of Real Property Tax',
  group: 'rpt',
  status: 'implemented_template',
}
const REPORT_COLLECTORS = [
  { value: 'flora', label: 'FLORA MY D. FERRER' },
  { value: 'agnes', label: 'AGNES B. ELLO' },
  { value: 'ricardo', label: 'RICARDO T. ENOPIA' },
  { value: 'angelique', label: 'ANGELIQUE IRIS A. RAFALES' },
  { value: 'emily', label: 'EMILY E. CREDO' },
  { value: 'gtz', label: 'GTZ' },
]

const currentMonth = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const currentDateValue = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const currentYear = () => String(new Date().getFullYear())

const currentQuarter = () => String(Math.floor(new Date().getMonth() / 3) + 1)

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

const getQuarterRange = (yearValue, quarterValue) => {
  const year = Number(yearValue) || new Date().getFullYear()
  const quarter = [1, 2, 3, 4].includes(Number(quarterValue)) ? Number(quarterValue) : 1
  const firstMonth = (quarter - 1) * 3
  const firstDay = new Date(year, firstMonth, 1)
  const lastDay = new Date(year, firstMonth + 3, 0)
  const quarterLabels = {
    1: '1st Quarter',
    2: '2nd Quarter',
    3: '3rd Quarter',
    4: '4th Quarter',
  }

  return {
    dateFrom: toDateValue(firstDay),
    dateTo: toDateValue(lastDay),
    label: `${quarterLabels[quarter]} ${year}`,
    monthName: quarterLabels[quarter],
    quarter,
    year,
  }
}

const timestampForFilename = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}-${hours}${minutes}${seconds}`
}

const quarterToken = (quarter) => {
  const quarterNumber = Number(quarter) || 1
  const suffixes = {
    1: 'ST',
    2: 'ND',
    3: 'RD',
    4: 'TH',
  }
  return `${quarterNumber}${suffixes[quarterNumber] || 'TH'}`
}

const fallbackDownloadName = (report, period, selectedMonth) => {
  if (report.number === QUARTER_REPORT_NUMBER) {
    return `ESRE-REPORT-${quarterToken(period.quarter)}-QTR-${timestampForFilename()}.xlsx`
  }

  if (report.number === CRAAF_REPORT_ID) {
    return `CRAAF_${period.dateFrom || 'start'}_${period.dateTo || 'end'}.xlsx`
  }

  if (report.number === DELINQUENCY_NOTICE_REPORT_ID) {
    return `Notice_of_Delinquency_${timestampForFilename()}.docx`
  }

  return `report-${report.number}-${selectedMonth}.xlsx`
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
  const [dateRange, setDateRange] = useState({ dateFrom: '', dateTo: '' })
  const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter())
  const [selectedQuarterYear, setSelectedQuarterYear] = useState(currentYear())
  const [selectedReportNumber, setSelectedReportNumber] = useState('')
  const [selectedCollector, setSelectedCollector] = useState('')
  const [delinquencyNotice, setDelinquencyNotice] = useState(() => ({
    taxpayerName: '',
    taxYear: currentYear(),
    computedUntil: currentDateValue(),
    taxDecNo: '',
    propertyIndexNo: '',
    lotNo: '',
    location: '',
    propertyKind: '',
    assessedValue: '',
    unpaidYears: '',
    unpaidQuarters: '',
    totalAmount: '',
    status: 'Active',
    remarks: '',
  }))
  const [generatedReport, setGeneratedReport] = useState(null)
  const [delinquencyRecords, setDelinquencyRecords] = useState([])
  const [firebirdDelinquencyRows, setFirebirdDelinquencyRows] = useState([])
  const [firebirdDelinquencyMeta, setFirebirdDelinquencyMeta] = useState(null)
  const [delinquencyBarangays, setDelinquencyBarangays] = useState([])
  const [isLoadingDelinquencyBarangays, setIsLoadingDelinquencyBarangays] = useState(false)
  const [delinquencyAmountSort, setDelinquencyAmountSort] = useState('total_desc')
  const [delinquencyGeneratedAt, setDelinquencyGeneratedAt] = useState(null)
  const [delinquencyListFilters, setDelinquencyListFilters] = useState(() => ({
    asOf: currentDateValue(),
    barangayCode: '',
    includeCurrentYear: false,
    limit: '200',
  }))
  const [selectedDelinquencyId, setSelectedDelinquencyId] = useState('')
  const [isLoadingDelinquencies, setIsLoadingDelinquencies] = useState(false)
  const [isSavingDelinquency, setIsSavingDelinquency] = useState(false)
  const [delinquencyRecordMessage, setDelinquencyRecordMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const range = useMemo(() => getMonthRange(selectedMonth), [selectedMonth])
  const quarterRange = useMemo(
    () => getQuarterRange(selectedQuarterYear, selectedQuarter),
    [selectedQuarterYear, selectedQuarter],
  )
  const cashierAssignment = getCashierCollectorAssignment(user)
  const collectorOptions = cashierAssignment ? [cashierAssignment] : REPORT_COLLECTORS
  const isCollectionMonitor = variant === 'collectionMonitor'
  const allReports = useMemo(() => [...page.reports, RPT_PAYMENT_CARD_REPORT, DELINQUENCY_LIST_REPORT, DELINQUENCY_NOTICE_REPORT], [page.reports])
  const mainReports = allReports.filter((report) => (
    (MAIN_REPORT_NUMBERS.has(report.number) || report.number === CRAAF_REPORT_ID || report.number === RPT_PAYMENT_CARD_REPORT_ID || report.number === DELINQUENCY_LIST_REPORT_ID || report.number === DELINQUENCY_NOTICE_REPORT_ID) && !(report.number >= 1 && report.number <= 20)
  ))
  const otherReports = page.reports.filter((report) => report.number >= 1 && report.number <= 20)
  const quickReports = isCollectionMonitor ? page.reports : mainReports

  const findReport = (value) => allReports.find((report) => String(report.number) === value)
  const selectedReport = findReport(selectedReportNumber)
  const requiresCollector = selectedReport?.number === COLLECTOR_REPORT_NUMBER
  const isDelinquencyList = selectedReport?.number === DELINQUENCY_LIST_REPORT_ID
  const isDelinquencyNotice = selectedReport?.number === DELINQUENCY_NOTICE_REPORT_ID
  const isRptPaymentCard = selectedReport?.number === RPT_PAYMENT_CARD_REPORT_ID
  const sortedFirebirdDelinquencyRows = useMemo(() => {
    const direction = delinquencyAmountSort === 'total_asc' ? 1 : -1
    return [...firebirdDelinquencyRows].sort((left, right) => (
      (Number(left.total) - Number(right.total)) * direction
    ))
  }, [firebirdDelinquencyRows, delinquencyAmountSort])
  const selectedDelinquencyBarangay = delinquencyBarangays.find(
    (barangay) => String(barangay.code) === String(delinquencyListFilters.barangayCode),
  )
  const delinquencyBarangayNames = useMemo(
    () => Object.fromEntries(delinquencyBarangays.map((barangay) => [String(barangay.code), barangay.name || barangay.code])),
    [delinquencyBarangays],
  )
  const delinquencyAsOfYear = Number(delinquencyListFilters.asOf.slice(0, 4)) || new Date().getFullYear()
  const delinquencyCutOffYear = delinquencyAsOfYear - (delinquencyListFilters.includeCurrentYear ? 0 : 1)
  const usesDateRange = selectedReport?.number === DATE_RANGE_REPORT_NUMBER || selectedReport?.number === COLLECTOR_REPORT_NUMBER || selectedReport?.number === CRAAF_REPORT_ID
  const usesQuarterRange = selectedReport?.number === QUARTER_REPORT_NUMBER

  useEffect(() => {
    if (cashierAssignment && requiresCollector) {
      setSelectedCollector(cashierAssignment.value)
    }
  }, [cashierAssignment, requiresCollector])

  const updateDelinquencyNotice = (field, value) => {
    setDelinquencyNotice((current) => ({ ...current, [field]: value }))
    setGenerationError('')
    setDelinquencyRecordMessage('')
  }

  const delinquencyPayload = () => ({
    taxpayer_name: delinquencyNotice.taxpayerName,
    tax_year: delinquencyNotice.taxYear,
    computed_until: delinquencyNotice.computedUntil,
    tax_dec_no: delinquencyNotice.taxDecNo,
    property_index_no: delinquencyNotice.propertyIndexNo,
    lot_no: delinquencyNotice.lotNo,
    location: delinquencyNotice.location,
    property_kind: delinquencyNotice.propertyKind,
    assessed_value: delinquencyNotice.assessedValue,
    unpaid_years: delinquencyNotice.unpaidYears,
    unpaid_quarters: delinquencyNotice.unpaidQuarters,
    total_amount: delinquencyNotice.totalAmount,
    status: delinquencyNotice.status || 'Active',
    remarks: delinquencyNotice.remarks || '',
  })

  const noticeDownloadPayload = (notice = delinquencyNotice) => ({
    taxpayer_name: notice.taxpayerName,
    tax_year: notice.taxYear,
    computed_until: notice.computedUntil,
    tax_dec_no: notice.taxDecNo,
    property_index_no: notice.propertyIndexNo,
    lot_no: notice.lotNo,
    location: notice.location,
    property_kind: notice.propertyKind,
    assessed_value: notice.assessedValue,
    unpaid_years: notice.unpaidYears,
    unpaid_quarters: notice.unpaidQuarters,
    total_amount: notice.totalAmount,
  })

  const firebirdNoticeValues = (record) => {
    const startYear = Number(record?.start_year || 0)
    const cutOffYear = Number(firebirdDelinquencyMeta?.cut_off_year || delinquencyCutOffYear)
    const unpaidYears = startYear > 0
      ? (startYear === cutOffYear ? String(startYear) : `${startYear}-${cutOffYear}`)
      : String(cutOffYear)
    const propertyKind = [record?.property_kind, record?.property_classification]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(' - ')

    return {
      taxpayerName: record?.declarant || '',
      taxYear: String(cutOffYear),
      computedUntil: delinquencyListFilters.asOf || currentDateValue(),
      taxDecNo: record?.td_no || '',
      propertyIndexNo: record?.property_index_no || '',
      lotNo: record?.lot_no || '',
      location: delinquencyBarangayNames[String(record?.barangay_code)] || record?.barangay_code || '',
      propertyKind,
      assessedValue: record?.assessed_value ?? '',
      unpaidYears,
      unpaidQuarters: record?.unpaid_quarters || '',
      totalAmount: record?.total ?? '',
      status: 'Active',
      remarks: record?.remarks || '',
    }
  }

  const applyFirebirdDelinquencyRecord = (record) => {
    const values = firebirdNoticeValues(record)
    setSelectedDelinquencyId('')
    setDelinquencyNotice(values)
    setGenerationError('')
    setDelinquencyRecordMessage(`Loaded ${values.taxpayerName || 'taxpayer'} from the read-only Firebird delinquency list.`)
    return values
  }

  const applyDelinquencyRecord = (record) => {
    if (!record) return

    setDelinquencyNotice({
      taxpayerName: record.taxpayerName || '',
      taxYear: record.taxYear || currentYear(),
      computedUntil: record.computedUntil || currentDateValue(),
      taxDecNo: record.taxDecNo || '',
      propertyIndexNo: record.propertyIndexNo || '',
      lotNo: record.lotNo || '',
      location: record.location || '',
      propertyKind: record.propertyKind || '',
      assessedValue: record.assessedValue || '',
      unpaidYears: record.unpaidYears || '',
      unpaidQuarters: record.unpaidQuarters || '',
      totalAmount: record.totalAmount || '',
      status: record.status || 'Active',
      remarks: record.remarks || '',
    })
    setGenerationError('')
    setDelinquencyRecordMessage('Loaded delinquency record.')
  }

  const resetDelinquencyNotice = () => {
    setSelectedDelinquencyId('')
    setDelinquencyNotice({
      taxpayerName: '',
      taxYear: currentYear(),
      computedUntil: currentDateValue(),
      taxDecNo: '',
      propertyIndexNo: '',
      lotNo: '',
      location: '',
      propertyKind: '',
      assessedValue: '',
      unpaidYears: '',
      unpaidQuarters: '',
      totalAmount: '',
      status: 'Active',
      remarks: '',
    })
    setGenerationError('')
    setDelinquencyRecordMessage('Ready for a new delinquency record.')
  }

  const loadDelinquencyRecords = async () => {
    setIsLoadingDelinquencies(true)
    try {
      const response = await axiosInstance.get('/rpt-delinquency-records', {
        params: { limit: 200 },
      })
      setDelinquencyRecords(response.data.records || [])
    } catch (error) {
      setGenerationError(error.response?.data?.message || 'Unable to load RPT delinquency records.')
    } finally {
      setIsLoadingDelinquencies(false)
    }
  }

  const saveDelinquencyRecord = async (mode = 'create') => {
    if (!delinquencyNotice.taxpayerName.trim() || !delinquencyNotice.taxYear.trim() || !String(delinquencyNotice.totalAmount).trim()) {
      setGenerationError('Please enter Taxpayer Name, Tax Year, and Total Amount before saving the delinquency record.')
      return
    }

    setIsSavingDelinquency(true)
    setGenerationError('')
    setDelinquencyRecordMessage('')

    try {
      const response = mode === 'update' && selectedDelinquencyId
        ? await axiosInstance.patch(`/rpt-delinquency-records/${selectedDelinquencyId}`, delinquencyPayload())
        : await axiosInstance.post('/rpt-delinquency-records', delinquencyPayload())

      const savedRecord = response.data.record
      await loadDelinquencyRecords()
      setSelectedDelinquencyId(String(savedRecord.id))
      applyDelinquencyRecord(savedRecord)
      setDelinquencyRecordMessage(response.data.message || 'RPT delinquency record saved.')
    } catch (error) {
      setGenerationError(error.response?.data?.message || 'Unable to save RPT delinquency record.')
    } finally {
      setIsSavingDelinquency(false)
    }
  }

  const deleteDelinquencyRecord = async () => {
    if (!selectedDelinquencyId) return

    setIsSavingDelinquency(true)
    setGenerationError('')
    setDelinquencyRecordMessage('')

    try {
      await axiosInstance.delete(`/rpt-delinquency-records/${selectedDelinquencyId}`)
      await loadDelinquencyRecords()
      resetDelinquencyNotice()
      setDelinquencyRecordMessage('RPT delinquency record deleted.')
    } catch (error) {
      setGenerationError(error.response?.data?.message || 'Unable to delete RPT delinquency record.')
    } finally {
      setIsSavingDelinquency(false)
    }
  }

  const printDelinquencyRecord = async (record) => {
    if (!record?.id) return

    setIsDownloading(true)
    setGenerationError('')
    setDelinquencyRecordMessage('')

    try {
      const response = await axiosInstance.get(`/rpt-delinquency-records/${record.id}/notice`, {
        responseType: 'blob',
      })
      const disposition = response.headers['content-disposition'] || ''
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i)
      const fallbackName = `Notice_of_Delinquency_${record.taxpayerName || 'taxpayer'}.docx`
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')

      link.href = url
      link.download = filenameMatch?.[1] || fallbackName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setDelinquencyRecordMessage(`Notice downloaded for ${record.taxpayerName}.`)
    } catch (error) {
      setGenerationError(await downloadErrorMessage(error))
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadDelinquencyNotice = async (notice, label = 'taxpayer') => {
    const response = await axiosInstance.get('/reports/rpt-delinquency-notice/download', {
      params: noticeDownloadPayload(notice),
      responseType: 'blob',
    })
    const disposition = response.headers['content-disposition'] || ''
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/i)
    const safeLabel = String(label || 'taxpayer').replace(/[^A-Za-z0-9_-]+/g, '_')
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')

    link.href = url
    link.download = filenameMatch?.[1] || `Notice_of_Delinquency_${safeLabel}.docx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const printCurrentDelinquencyNotice = async () => {
    if (!delinquencyNotice.taxpayerName.trim() || !delinquencyNotice.taxYear.trim() || !String(delinquencyNotice.totalAmount).trim()) {
      setGenerationError('Select a delinquent taxpayer or enter Taxpayer Name, Tax Year, and Total Amount before printing the notice.')
      return
    }

    setIsDownloading(true)
    setGenerationError('')
    setDelinquencyRecordMessage('')

    try {
      await downloadDelinquencyNotice(delinquencyNotice, delinquencyNotice.taxpayerName)
      setDelinquencyRecordMessage(`Notice downloaded for ${delinquencyNotice.taxpayerName}.`)
    } catch (error) {
      setGenerationError(await downloadErrorMessage(error))
    } finally {
      setIsDownloading(false)
    }
  }

  const printFirebirdDelinquencyNotice = async (record) => {
    const values = applyFirebirdDelinquencyRecord(record)
    setIsDownloading(true)
    setGenerationError('')

    try {
      await downloadDelinquencyNotice(values, values.taxpayerName)
      setDelinquencyRecordMessage(`Notice downloaded for ${values.taxpayerName}.`)
    } catch (error) {
      setGenerationError(await downloadErrorMessage(error))
    } finally {
      setIsDownloading(false)
    }
  }

  const generateDelinquencyList = async () => {
    setIsGenerating(true)
    setGenerationError('')
    setDelinquencyRecordMessage('')

    try {
      const response = await axiosInstance.post('/rpt-delinquency-records/generate', {
        as_of: delinquencyNotice.computedUntil || currentDateValue(),
        tax_year: delinquencyNotice.taxYear || undefined,
        status: delinquencyNotice.status || 'Active',
      })
      setDelinquencyRecords(response.data.records || [])
      setDelinquencyRecordMessage(`${response.data.message} Total taxpayers: ${response.data.summary?.records ?? 0}. Total amount: PHP ${Number(response.data.summary?.totalAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}.`)
      setGeneratedReport(null)
    } catch (error) {
      setGenerationError(error.response?.data?.message || 'Unable to generate RPT delinquency list.')
    } finally {
      setIsGenerating(false)
    }
  }

  const generateFirebirdDelinquencyList = async () => {
    if (!delinquencyListFilters.asOf) {
      setGenerationError('Please select an As Of Date for the RPT delinquency list.')
      return
    }

    setIsGenerating(true)
    setGenerationError('')
    setDelinquencyRecordMessage('')

    try {
      const response = await axiosInstance.get('/rpt-delinquency-firebird', {
        params: {
          as_of: delinquencyListFilters.asOf,
          barangay_code: delinquencyListFilters.barangayCode.trim(),
          include_current_year: delinquencyListFilters.includeCurrentYear ? 1 : 0,
          limit: Number(delinquencyListFilters.limit || 200),
        },
      })
      setFirebirdDelinquencyRows(response.data.rows || [])
      setFirebirdDelinquencyMeta(response.data)
      setDelinquencyGeneratedAt(new Date())
      setGeneratedReport(null)
      setDelinquencyRecordMessage(
        'Read-only Firebird list generated. Cut-off year: ' +
        response.data.cut_off_year +
        '. Records shown: ' +
        Number(response.data.count || 0).toLocaleString('en-PH') +
        '. Total: PHP ' +
        Number(response.data.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        '.',
      )
    } catch (error) {
      setFirebirdDelinquencyRows([])
      setFirebirdDelinquencyMeta(null)
      setDelinquencyGeneratedAt(null)
      setGenerationError(error.response?.data?.message || 'Unable to generate the report. Please verify the filters and try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const clearFirebirdDelinquencyResults = () => {
    setFirebirdDelinquencyRows([])
    setFirebirdDelinquencyMeta(null)
    setDelinquencyGeneratedAt(null)
    setDelinquencyRecordMessage('')
    setGenerationError('')
  }

  const updateFirebirdDelinquencyFilter = (field, value) => {
    setDelinquencyListFilters((current) => ({ ...current, [field]: value }))
    clearFirebirdDelinquencyResults()
  }

  const clearFirebirdDelinquencyFilters = () => {
    setSelectedMonth(currentMonth())
    setDelinquencyListFilters({
      asOf: currentDateValue(),
      barangayCode: '',
      includeCurrentYear: false,
      limit: '200',
    })
    setDelinquencyAmountSort('total_desc')
    clearFirebirdDelinquencyResults()
  }

  const exportFirebirdDelinquencyExcel = () => {
    if (sortedFirebirdDelinquencyRows.length === 0) return

    try {
      const generatedDate = delinquencyGeneratedAt || new Date()
      const asOfDate = new Date(delinquencyListFilters.asOf + 'T00:00:00')
      const barangayName = selectedDelinquencyBarangay?.name || 'All Barangays'
      const headers = [
        'Declarant',
        'Tax Declaration Number',
        'Lot Number',
        'Barangay',
        'Assessed Value',
        'Start Year',
        'Basic Tax Due',
        'Basic Penalty',
        'SEF Due',
        'SEF Penalty',
        'Total Delinquency',
        'Remarks',
      ]
      const dataRows = sortedFirebirdDelinquencyRows.map((record) => ([
        record.declarant || '',
        String(record.td_no || ''),
        String(record.lot_no || ''),
        delinquencyBarangayNames[String(record.barangay_code)] || record.barangay_code || '',
        Number(record.assessed_value || 0),
        Number(record.start_year || 0) || '',
        Number(record.basic_tax_due || 0),
        Number(record.basic_penalty || 0),
        Number(record.sef_due || 0),
        Number(record.sef_penalty || 0),
        Number(record.total || 0),
        record.remarks || '',
      ]))
      const monetaryIndexes = [4, 6, 7, 8, 9, 10]
      const totals = monetaryIndexes.reduce((result, columnIndex) => ({
        ...result,
        [columnIndex]: dataRows.reduce((sum, row) => sum + Number(row[columnIndex] || 0), 0),
      }), {})
      const informationRows = [
        ['Report', 'Real Property Tax Delinquencies'],
        ['Month and Year', range.label],
        ['As of Date', asOfDate],
        ['Barangay', barangayName],
        ['Cut-off Year', firebirdDelinquencyMeta?.cut_off_year || delinquencyCutOffYear],
        ['Include Current Tax Year', delinquencyListFilters.includeCurrentYear ? 'Yes' : 'No'],
        ['Generated Date', generatedDate],
        ['Total Records', sortedFirebirdDelinquencyRows.length],
        [],
      ]
      const totalRow = ['TOTAL', '', '', '', totals[4], '', totals[6], totals[7], totals[8], totals[9], totals[10], '']
      const worksheet = XLSX.utils.aoa_to_sheet(
        [...informationRows, headers, ...dataRows, totalRow],
        { cellDates: true, dateNF: 'mmmm d, yyyy' },
      )
      const headerRowNumber = informationRows.length + 1
      const firstDataRowNumber = headerRowNumber + 1
      const lastDataRowNumber = headerRowNumber + dataRows.length
      const totalRowNumber = lastDataRowNumber + 1

      worksheet['!autofilter'] = { ref: 'A' + headerRowNumber + ':L' + lastDataRowNumber }
      worksheet['!freeze'] = { xSplit: 0, ySplit: headerRowNumber }
      worksheet['!cols'] = [
        { wch: 34 },
        { wch: 24 },
        { wch: 18 },
        { wch: 16 },
        { wch: 17 },
        { wch: 12 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 19 },
        { wch: 24 },
      ]

      headers.forEach((header, columnIndex) => {
        const cell = worksheet[XLSX.utils.encode_cell({ r: headerRowNumber - 1, c: columnIndex })]
        if (cell) {
          cell.s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '17345B' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          }
        }
      })

      for (let rowNumber = firstDataRowNumber; rowNumber <= totalRowNumber; rowNumber += 1) {
        monetaryIndexes.forEach((columnIndex) => {
          const cell = worksheet[XLSX.utils.encode_cell({ r: rowNumber - 1, c: columnIndex })]
          if (cell) cell.z = '#,##0.00'
        })
      }

      ;['B3', 'B7'].forEach((address) => {
        if (worksheet[address]) worksheet[address].z = address === 'B7' ? 'mmmm d, yyyy h:mm AM/PM' : 'mmmm d, yyyy'
      })

      const totalLabelCell = worksheet['A' + totalRowNumber]
      if (totalLabelCell) totalLabelCell.s = { font: { bold: true } }
      monetaryIndexes.forEach((columnIndex) => {
        const cell = worksheet[XLSX.utils.encode_cell({ r: totalRowNumber - 1, c: columnIndex })]
        if (cell) cell.s = { font: { bold: true } }
      })

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'RPT Delinquencies')

      const barangayToken = selectedDelinquencyBarangay?.name
        ? '_' + selectedDelinquencyBarangay.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        : ''
      const filename = 'RPT_Delinquencies' + barangayToken + '_' + delinquencyListFilters.asOf + '.xlsx'
      XLSX.writeFile(workbook, filename, { cellStyles: true })
      setDelinquencyRecordMessage('Excel report downloaded successfully.')
      setGenerationError('')
    } catch (error) {
      setGenerationError('Unable to create the Excel file. Please try again.')
      setDelinquencyRecordMessage('')
    }
  }
  const loadDelinquencyBarangays = async () => {
    setIsLoadingDelinquencyBarangays(true)

    try {
      const response = await axiosInstance.get('/rpt-delinquency-firebird/barangays')
      setDelinquencyBarangays(response.data.barangays || [])
    } catch (error) {
      setDelinquencyBarangays([])
      setGenerationError(error.response?.data?.message || 'Unable to load the barangay list.')
    } finally {
      setIsLoadingDelinquencyBarangays(false)
    }
  }

  useEffect(() => {
    if (isDelinquencyNotice) {
      loadDelinquencyRecords()
    }
  }, [isDelinquencyNotice])

  useEffect(() => {
    if ((isDelinquencyList || isDelinquencyNotice) && delinquencyBarangays.length === 0) {
      loadDelinquencyBarangays()
    }
  }, [isDelinquencyList, isDelinquencyNotice])

  const downloadReport = async (report, period) => {
    const params = report.number === DELINQUENCY_NOTICE_REPORT_ID
      ? {
          taxpayer_name: delinquencyNotice.taxpayerName,
          tax_year: delinquencyNotice.taxYear,
          computed_until: delinquencyNotice.computedUntil,
          tax_dec_no: delinquencyNotice.taxDecNo,
          property_index_no: delinquencyNotice.propertyIndexNo,
          lot_no: delinquencyNotice.lotNo,
          location: delinquencyNotice.location,
          property_kind: delinquencyNotice.propertyKind,
          assessed_value: delinquencyNotice.assessedValue,
          unpaid_years: delinquencyNotice.unpaidYears,
          unpaid_quarters: delinquencyNotice.unpaidQuarters,
          total_amount: delinquencyNotice.totalAmount,
        }
      : {
          date_from: period.dateFrom,
          date_to: period.dateTo,
        }
    if (report.number === COLLECTOR_REPORT_NUMBER) {
      params.collector = selectedCollector
    }

    const endpoint = report.number === DELINQUENCY_NOTICE_REPORT_ID
      ? '/reports/rpt-delinquency-notice/download'
      : report.number === CRAAF_REPORT_ID
        ? '/rcd/craaf/download'
        : `/generated-reports/${report.number}/download`

    const response = await axiosInstance.get(endpoint, {
      params,
      responseType: 'blob',
    })
    const disposition = response.headers['content-disposition'] || ''
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/i)
    const fallbackName = fallbackDownloadName(report, period, selectedMonth)
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
    const isDownloadOnly = DOWNLOAD_ONLY_REPORT_NUMBERS.has(report.number) || report.number === CRAAF_REPORT_ID || report.number === DELINQUENCY_NOTICE_REPORT_ID
    const reportPeriod = report.number === DELINQUENCY_NOTICE_REPORT_ID
      ? {}
      : report.number === DATE_RANGE_REPORT_NUMBER || report.number === COLLECTOR_REPORT_NUMBER || report.number === CRAAF_REPORT_ID
        ? { dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo }
        : report.number === QUARTER_REPORT_NUMBER
          ? quarterRange
          : range

    if (report.number === DELINQUENCY_LIST_REPORT_ID) {
      await generateFirebirdDelinquencyList()
      return
    }

    if (report.number === DELINQUENCY_NOTICE_REPORT_ID) {
      await generateFirebirdDelinquencyList()
      return
    }

    if (report.number === COLLECTOR_REPORT_NUMBER && !selectedCollector) {
      setGenerationError('Please select a collector for Generate Collection Receipt Per Collector.')
      return
    }

    if (report.number === DATE_RANGE_REPORT_NUMBER || report.number === COLLECTOR_REPORT_NUMBER || report.number === CRAAF_REPORT_ID) {
      if (!dateRange.dateFrom || !dateRange.dateTo) {
        setGenerationError(report.number === COLLECTOR_REPORT_NUMBER ? 'Please select Date From and Date To for Generate Collection Receipt Per Collector.' : report.number === CRAAF_REPORT_ID ? 'Please select Date From and Date To for CRAAF.' : 'Please select Date From and Date To for Official Report Breakdown.')
        return
      }

      if (dateRange.dateFrom > dateRange.dateTo) {
        setGenerationError('Date From must not be greater than Date To.')
        return
      }
    }

    setIsGenerating(true)
    setGenerationError('')

    try {
      if (isDownloadOnly) {
        await downloadReport(report, reportPeriod)
        setGeneratedReport(null)
        return
      }

      const response = await axiosInstance.get(`/generated-reports/${report.number}/preview`, {
        params: {
          date_from: reportPeriod.dateFrom,
          date_to: reportPeriod.dateTo,
        },
      })

      setGeneratedReport({
        ...report,
        generatedAt: new Date().toLocaleString('en-PH'),
        period: reportPeriod,
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
          period: reportPeriod,
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

      <section className={'toolbar-panel master-report-panel report-generator-panel' + (isDelinquencyList ? ' delinquency-report-generator-panel' : '')}>
        <div className={'report-generator-heading' + (isDelinquencyList ? ' delinquency-page-heading' : '')}>
          {isDelinquencyList ? (
            <>
              <div>
                <h2>Real Property Tax Delinquencies</h2>
                <p className="toolbar-description">Generate, review, and export delinquent real property tax records.</p>
              </div>
              {delinquencyGeneratedAt && (
                <div className="delinquency-heading-meta" aria-label="Last generated report information">
                  <strong>{firebirdDelinquencyRows.length.toLocaleString('en-PH')} records</strong>
                  <span>Generated {delinquencyGeneratedAt.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="eyebrow">{isCollectionMonitor ? 'Official Collection Reports' : 'Office of the Municipal Treasurer'}</p>
              <h2>{isCollectionMonitor ? 'Reports' : page.title}</h2>
              <p className="toolbar-description">
                {isCollectionMonitor
                  ? page.description
                  : 'Generate, preview, export, and print official LGU treasury report templates.'}
              </p>
            </>
          )}
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

        <div className={'report-generator-controls' + (isDelinquencyList ? ' delinquency-generator-controls' : '')}>
          {(isDelinquencyNotice || isRptPaymentCard) ? null : usesDateRange ? (
            <>
              <label className="month-filter-field">
                <span><Calendar size={14} aria-hidden="true" /> Date From</span>
                <input
                  aria-label="Date from"
                  onChange={(event) => {
                    setDateRange((current) => ({ ...current, dateFrom: event.target.value }))
                    setGenerationError('')
                  }}
                  type="date"
                  value={dateRange.dateFrom}
                />
              </label>
              <label className="month-filter-field">
                <span><Calendar size={14} aria-hidden="true" /> Date To</span>
                <input
                  aria-label="Date to"
                  onChange={(event) => {
                    setDateRange((current) => ({ ...current, dateTo: event.target.value }))
                    setGenerationError('')
                  }}
                  type="date"
                  value={dateRange.dateTo}
                />
              </label>
            </>
          ) : usesQuarterRange ? (
            <>
              <label className="month-filter-field">
                <span><Calendar size={14} aria-hidden="true" /> Quarter</span>
                <select
                  aria-label="Quarter"
                  onChange={(event) => {
                    setSelectedQuarter(event.target.value)
                    setGenerationError('')
                  }}
                  value={selectedQuarter}
                >
                  <option value="1">1st Quarter (Jan-Mar)</option>
                  <option value="2">2nd Quarter (Apr-Jun)</option>
                  <option value="3">3rd Quarter (Jul-Sep)</option>
                  <option value="4">4th Quarter (Oct-Dec)</option>
                </select>
              </label>
              <label className="month-filter-field">
                <span><Calendar size={14} aria-hidden="true" /> Year</span>
                <input
                  aria-label="Quarter year"
                  max="2100"
                  min="2000"
                  onChange={(event) => {
                    setSelectedQuarterYear(event.target.value)
                    setGenerationError('')
                  }}
                  type="number"
                  value={selectedQuarterYear}
                />
              </label>
            </>
          ) : (
            <label className="month-filter-field">
              <span><Calendar size={14} aria-hidden="true" /> Month and Year</span>
              <input
                aria-label="Month and year"
                onChange={(event) => {
                  setSelectedMonth(event.target.value)
                  if (isDelinquencyList) clearFirebirdDelinquencyResults()
                }}
                type="month"
                value={selectedMonth}
              />
            </label>
          )}

          <label className="report-select-field">
            <span><BookOpen size={14} aria-hidden="true" /> {isDelinquencyList ? 'Report Type' : 'Generate Report'}</span>
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

          {(isDelinquencyList || isDelinquencyNotice) && (
            <>
              <label className="month-filter-field">
                <span><Calendar size={14} aria-hidden="true" /> As of Date</span>
                <input
                  aria-label="As of date"
                  onChange={(event) => updateFirebirdDelinquencyFilter('asOf', event.target.value)}
                  type="date"
                  value={delinquencyListFilters.asOf}
                />
              </label>
              <label className="report-select-field">
                <span>Barangay</span>
                <select
                  aria-label="Barangay"
                  disabled={isLoadingDelinquencyBarangays}
                  onChange={(event) => updateFirebirdDelinquencyFilter('barangayCode', event.target.value)}
                  value={delinquencyListFilters.barangayCode}
                >
                  <option value="">{isLoadingDelinquencyBarangays ? 'Loading barangays...' : 'All Barangays'}</option>
                  {delinquencyBarangays.map((barangay) => (
                    <option key={barangay.code} value={barangay.code}>
                      {barangay.name ? barangay.code + ' - ' + barangay.name : barangay.code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="month-filter-field">
                <span>Cut-off Year</span>
                <input aria-label="Cut-off year" readOnly type="number" value={delinquencyCutOffYear} />
              </label>
              <label className="report-select-field">
                <span>Maximum Rows</span>
                <select
                  aria-label="Maximum rows"
                  onChange={(event) => updateFirebirdDelinquencyFilter('limit', event.target.value)}
                  value={delinquencyListFilters.limit}
                >
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="500">500</option>
                  <option value="1000">1,000</option>
                  <option value="1500">1,500</option>
                  <option value="2000">2,000</option>
                  <option value="5000">5,000</option>
                </select>
              </label>
              <label className="report-select-field">
                <span>Sort by Amount</span>
                <select aria-label="Sort by amount" onChange={(event) => setDelinquencyAmountSort(event.target.value)} value={delinquencyAmountSort}>
                  <option value="total_desc">Highest to Lowest</option>
                  <option value="total_asc">Lowest to Highest</option>
                </select>
              </label>
              <label className="delinquency-current-year-toggle">
                <input
                  checked={delinquencyListFilters.includeCurrentYear}
                  onChange={(event) => updateFirebirdDelinquencyFilter('includeCurrentYear', event.target.checked)}
                  type="checkbox"
                />
                <span>Include Current Tax Year</span>
              </label>
            </>
          )}

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

          {!isRptPaymentCard && (
            <button className="primary-button generate-selected-report-button" disabled={!selectedReportNumber || isGenerating || (requiresCollector && !selectedCollector)} onClick={generateReport} type="button">
              {isGenerating ? <LoaderCircle className="delinquency-loading-icon" size={16} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
              {isGenerating ? 'Generating...' : isDelinquencyNotice ? 'Find Delinquent Taxpayers' : 'Generate Report'}
            </button>
          )}
          {(isDelinquencyList || isDelinquencyNotice) && (
            <button className="secondary-button delinquency-clear-filters-button" disabled={isGenerating} onClick={clearFirebirdDelinquencyFilters} type="button">
              <Eraser size={15} aria-hidden="true" />
              Clear Filters
            </button>
          )}
        </div>

        {isRptPaymentCard && <RealPropertyTaxPaymentCardReport canPrint={Boolean(user?.permissions?.includes('reports.export'))} />}

        {isDelinquencyList && (
          <section className="delinquency-firebird-report" aria-label="Real Property Tax Delinquencies results">
            {firebirdDelinquencyMeta && (
              <div className="delinquency-summary-strip" aria-label="Generated report summary">
                <div><span>Barangay</span><strong>{selectedDelinquencyBarangay?.name || firebirdDelinquencyMeta?.barangay_code || 'All barangays'}</strong></div>
                <div><span>As of</span><strong>{new Date(delinquencyListFilters.asOf + 'T00:00:00').toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></div>
                <div><span>Cut-off year</span><strong>{firebirdDelinquencyMeta.cut_off_year || delinquencyCutOffYear}</strong></div>
                <div><span>Total records</span><strong>{firebirdDelinquencyRows.length.toLocaleString('en-PH')}</strong></div>
                <div><span>Total delinquency</span><strong>PHP {Number(firebirdDelinquencyMeta.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
              </div>
            )}

            {firebirdDelinquencyRows.length > 0 && (
              <div className="delinquency-action-toolbar no-print">
                <span>{firebirdDelinquencyRows.length.toLocaleString('en-PH')} generated records</span>
                <div>
                  <button className="delinquency-excel-button" onClick={exportFirebirdDelinquencyExcel} type="button">
                    <FileSpreadsheet size={16} aria-hidden="true" />
                    Download Excel
                  </button>
                  <button className="secondary-button" disabled={isGenerating} onClick={generateFirebirdDelinquencyList} type="button">
                    <RefreshCw size={15} aria-hidden="true" />
                    Regenerate
                  </button>
                  <button className="secondary-button" onClick={clearFirebirdDelinquencyResults} type="button">
                    <Trash2 size={15} aria-hidden="true" />
                    Clear Results
                  </button>
                </div>
              </div>
            )}

            <div aria-live="polite">
              {delinquencyRecordMessage && <p className="delinquency-report-message success">{delinquencyRecordMessage}</p>}
              {generationError && <p className="delinquency-report-message error">{generationError}</p>}
            </div>

            {isGenerating ? (
              <div className="delinquency-report-state" role="status">
                <LoaderCircle className="delinquency-loading-icon" size={24} aria-hidden="true" />
                <strong>Generating delinquency report...</strong>
              </div>
            ) : generationError ? null : firebirdDelinquencyMeta && firebirdDelinquencyRows.length === 0 ? (
              <div className="delinquency-report-state">
                <strong>No delinquent real property tax records were found for the selected filters.</strong>
              </div>
            ) : firebirdDelinquencyRows.length === 0 ? (
              <div className="delinquency-report-state">
                <FileSpreadsheet size={25} aria-hidden="true" />
                <strong>Select the report filters, then click Generate Report.</strong>
              </div>
            ) : (
              <div className="delinquency-record-table-wrap">
                <table className="delinquency-record-table delinquency-firebird-table">
                  <caption>{firebirdDelinquencyRows.length.toLocaleString('en-PH')} generated delinquency records</caption>
                  <thead>
                    <tr>
                      <th>Declarant</th>
                      <th>Tax Declaration No.</th>
                      <th>Lot No.</th>
                      <th>Barangay</th>
                      <th>Assessed Value</th>
                      <th>Start Year</th>
                      <th>Basic Tax Due</th>
                      <th>Basic Penalty</th>
                      <th>SEF Due</th>
                      <th>SEF Penalty</th>
                      <th>Total Delinquency</th>
                      <th>Remarks</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFirebirdDelinquencyRows.map((record, index) => (
                      <tr key={(record.td_no || 'td') + '-' + index}>
                        <td><strong>{record.declarant || '-'}</strong></td>
                        <td>{record.td_no || '-'}</td>
                        <td>{record.lot_no || '-'}</td>
                        <td>{delinquencyBarangayNames[String(record.barangay_code)] || record.barangay_code || '-'}</td>
                        <td>{formatAmount(record.assessed_value)}</td>
                        <td>{record.start_year || '-'}</td>
                        <td>{formatAmount(record.basic_tax_due)}</td>
                        <td>{formatAmount(record.basic_penalty)}</td>
                        <td>{formatAmount(record.sef_due)}</td>
                        <td>{formatAmount(record.sef_penalty)}</td>
                        <td><strong>{formatAmount(record.total)}</strong></td>
                        <td>{record.remarks || ''}</td>
                        <td>
                          <button className="secondary-button" disabled={isDownloading} onClick={() => printFirebirdDelinquencyNotice(record)} type="button">
                            <Printer size={14} aria-hidden="true" />
                            Print Notice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={10}>TOTAL</th>
                      <th>{formatAmount(firebirdDelinquencyMeta?.total_amount || 0)}</th>
                      <th colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )}
        {isDelinquencyNotice && (
          <div className="delinquency-report-fields" aria-label="Notice of Delinquency fields">
            <div className="delinquency-record-tools">
              <label className="treasury-field delinquency-record-picker">
                <span>Delinquency Records</span>
                <select
                  aria-label="Select RPT delinquency record"
                  disabled={isLoadingDelinquencies}
                  onChange={(event) => {
                    const value = event.target.value
                    setSelectedDelinquencyId(value)
                    const record = delinquencyRecords.find((item) => String(item.id) === value)
                    if (record) applyDelinquencyRecord(record)
                  }}
                  value={selectedDelinquencyId}
                >
                  <option value="">{isLoadingDelinquencies ? 'Loading delinquency records...' : 'Select delinquency record'}</option>
                  {delinquencyRecords.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.taxpayerName} - {record.taxYear} - PHP {Number(record.totalAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary-button" disabled={isDownloading || !delinquencyNotice.taxpayerName.trim()} onClick={printCurrentDelinquencyNotice} type="button">
                <Printer size={14} aria-hidden="true" />
                Print Notice
              </button>
              <button className="secondary-button" disabled={isLoadingDelinquencies} onClick={loadDelinquencyRecords} type="button">Refresh</button>
              <button className="secondary-button" onClick={resetDelinquencyNotice} type="button">New</button>
              <button className="primary-button" disabled={isSavingDelinquency} onClick={() => saveDelinquencyRecord('create')} type="button">Save Record</button>
              <button className="secondary-button" disabled={!selectedDelinquencyId || isSavingDelinquency} onClick={() => saveDelinquencyRecord('update')} type="button">Update</button>
              <button className="danger-button" disabled={!selectedDelinquencyId || isSavingDelinquency} onClick={deleteDelinquencyRecord} type="button">Delete</button>
            </div>
            {delinquencyRecordMessage && <p className="delinquency-record-message">{delinquencyRecordMessage}</p>}
            <div className="delinquency-record-list notice-firebird-record-list">
              <div className="delinquency-record-list-heading">
                <div>
                  <strong>Delinquent Taxpayers from iTAX</strong>
                  <span>Read-only Firebird results. Select a taxpayer to prepare or print the official notice.</span>
                </div>
                {firebirdDelinquencyMeta && <strong>{firebirdDelinquencyRows.length.toLocaleString('en-PH')} record(s)</strong>}
              </div>
              {isGenerating ? (
                <div className="delinquency-report-state" role="status">
                  <LoaderCircle className="delinquency-loading-icon" size={22} aria-hidden="true" />
                  <strong>Finding delinquent taxpayers...</strong>
                </div>
              ) : firebirdDelinquencyRows.length === 0 ? (
                <div className="delinquency-report-state">
                  <strong>{firebirdDelinquencyMeta ? 'No delinquent taxpayers found for the selected filters.' : 'Set the As of Date and Barangay above, then click Find Delinquent Taxpayers.'}</strong>
                </div>
              ) : (
                <div className="delinquency-record-table-wrap">
                  <table className="delinquency-record-table delinquency-notice-source-table">
                    <thead>
                      <tr>
                        <th>Taxpayer</th>
                        <th>Tax Dec.</th>
                        <th>Lot No.</th>
                        <th>Barangay</th>
                        <th>Unpaid Years</th>
                        <th>Assessed Value</th>
                        <th>Total</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFirebirdDelinquencyRows.map((record, index) => {
                        const noticeValues = firebirdNoticeValues(record)
                        return (
                          <tr key={(record.td_no || 'notice') + '-' + index}>
                            <td><strong>{record.declarant || '-'}</strong></td>
                            <td>{record.td_no || '-'}</td>
                            <td>{record.lot_no || '-'}</td>
                            <td>{noticeValues.location || '-'}</td>
                            <td>{noticeValues.unpaidYears || '-'}</td>
                            <td>{formatAmount(record.assessed_value)}</td>
                            <td><strong>{formatAmount(record.total)}</strong></td>
                            <td>
                              <div className="delinquency-row-actions">
                                <button className="secondary-button" onClick={() => applyFirebirdDelinquencyRecord(record)} type="button">Use Record</button>
                                <button className="primary-button" disabled={isDownloading} onClick={() => printFirebirdDelinquencyNotice(record)} type="button">
                                  <Printer size={14} aria-hidden="true" />
                                  Print Notice
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <label className="treasury-field">
              <span>Taxpayer Name</span>
              <input aria-label="Taxpayer name" onChange={(event) => updateDelinquencyNotice('taxpayerName', event.target.value)} placeholder="Taxpayer / owner name" value={delinquencyNotice.taxpayerName} />
            </label>
            <label className="treasury-field">
              <span>Tax Year</span>
              <input aria-label="Tax year" maxLength={4} onChange={(event) => updateDelinquencyNotice('taxYear', event.target.value)} placeholder="2026" value={delinquencyNotice.taxYear} />
            </label>
            <label className="treasury-field">
              <span>Computed Until</span>
              <input aria-label="Computed until" onChange={(event) => updateDelinquencyNotice('computedUntil', event.target.value)} type="date" value={delinquencyNotice.computedUntil} />
            </label>
            <label className="treasury-field">
              <span>Total Amount</span>
              <input aria-label="Total amount" min="0" onChange={(event) => updateDelinquencyNotice('totalAmount', event.target.value)} placeholder="0.00" step="0.01" type="number" value={delinquencyNotice.totalAmount} />
            </label>
            <label className="treasury-field">
              <span>Tax Dec. No.</span>
              <input aria-label="Tax declaration number" onChange={(event) => updateDelinquencyNotice('taxDecNo', event.target.value)} placeholder="Tax Dec. No." value={delinquencyNotice.taxDecNo} />
            </label>
            <label className="treasury-field">
              <span>Property Index No.</span>
              <input aria-label="Property index number" onChange={(event) => updateDelinquencyNotice('propertyIndexNo', event.target.value)} placeholder="Property Index #" value={delinquencyNotice.propertyIndexNo} />
            </label>
            <label className="treasury-field">
              <span>Lot No.</span>
              <input aria-label="Lot number" onChange={(event) => updateDelinquencyNotice('lotNo', event.target.value)} placeholder="Lot No." value={delinquencyNotice.lotNo} />
            </label>
            <label className="treasury-field">
              <span>Location</span>
              <input aria-label="Property location" onChange={(event) => updateDelinquencyNotice('location', event.target.value)} placeholder="Property location" value={delinquencyNotice.location} />
            </label>
            <label className="treasury-field">
              <span>Kind of Property</span>
              <input aria-label="Kind of property" onChange={(event) => updateDelinquencyNotice('propertyKind', event.target.value)} placeholder="Residential / Agricultural / etc." value={delinquencyNotice.propertyKind} />
            </label>
            <label className="treasury-field">
              <span>Assessed Value</span>
              <input aria-label="Assessed value" min="0" onChange={(event) => updateDelinquencyNotice('assessedValue', event.target.value)} placeholder="0.00" step="0.01" type="number" value={delinquencyNotice.assessedValue} />
            </label>
            <label className="treasury-field">
              <span>Year Unpaid</span>
              <input aria-label="Year unpaid" onChange={(event) => updateDelinquencyNotice('unpaidYears', event.target.value)} placeholder="Year unpaid" value={delinquencyNotice.unpaidYears} />
            </label>
            <label className="treasury-field">
              <span>Unpaid Qtrs.</span>
              <input aria-label="Unpaid quarters" onChange={(event) => updateDelinquencyNotice('unpaidQuarters', event.target.value)} placeholder="Qtrs." value={delinquencyNotice.unpaidQuarters} />
            </label>
            <label className="treasury-field">
              <span>Status</span>
              <select aria-label="Delinquency status" onChange={(event) => updateDelinquencyNotice('status', event.target.value)} value={delinquencyNotice.status || 'Active'}>
                <option value="Active">Active</option>
                <option value="Resolved">Resolved</option>
              </select>
            </label>
            <label className="treasury-field delinquency-remarks-field">
              <span>Remarks</span>
              <input aria-label="Delinquency remarks" onChange={(event) => updateDelinquencyNotice('remarks', event.target.value)} placeholder="Remarks" value={delinquencyNotice.remarks || ''} />
            </label>
            <div className="delinquency-record-list">
              <div className="delinquency-record-list-heading">
                <div>
                  <strong>Saved Notice Records (Excel)</strong>
                  <span>{delinquencyRecords.length} taxpayer record(s)</span>
                </div>
              </div>
              <div className="delinquency-record-table-wrap">
                <table className="delinquency-record-table">
                  <thead>
                    <tr>
                      <th>Taxpayer</th>
                      <th>Tax Year</th>
                      <th>Tax Dec.</th>
                      <th>Location</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delinquencyRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7}>No RPT delinquency records yet. Encode and save a record above; it will be stored in the Excel file.</td>
                      </tr>
                    ) : delinquencyRecords.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <strong>{record.taxpayerName}</strong>
                          <span>{record.propertyIndexNo || '-'}</span>
                        </td>
                        <td>{record.taxYear}</td>
                        <td>{record.taxDecNo || '-'}</td>
                        <td>{record.location || '-'}</td>
                        <td>PHP {Number(record.totalAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        <td><span className={`status-pill ${record.status === 'Resolved' ? 'status-resolved' : 'status-active'}`}>{record.status || 'Active'}</span></td>
                        <td>
                          <div className="delinquency-row-actions">
                            <button className="secondary-button" onClick={() => { setSelectedDelinquencyId(String(record.id)); applyDelinquencyRecord(record) }} type="button">Load</button>
                            <button className="primary-button" disabled={isDownloading} onClick={() => printDelinquencyRecord(record)} type="button">
                              <Printer size={14} aria-hidden="true" />
                              Print Notice
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="report-generator-helper">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>Report Scope</strong>
            <p>Choose a report template and date scope. Generate Collection Receipt Per Collector, Report 37, and CRAAF use Date From and Date To, while Report 38 uses Quarter and Year. The List of Real Property Tax Delinquencies reads the open BSC/SEF ledger from Firebird in read-only mode using the selected cut-off year and barangay. The Real Property Tax Payment Card looks up ownership, assessment, and payment history from Firebird in read-only mode. The Notice of Delinquency can be printed directly for each taxpayer returned by the read-only Firebird delinquency list, with optional Excel saving for corrections and record keeping.</p>
          </div>
        </div>

        {generationError && !isDelinquencyList && <p className="report-generation-error">{generationError}</p>}
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

