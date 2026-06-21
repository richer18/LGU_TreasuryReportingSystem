import { BookOpen, Calendar, FileSpreadsheet, FileText, Info, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import axiosInstance from '../../axiosinstance/axiosInstance'

const MAIN_REPORT_NUMBERS = new Set(Array.from({ length: 11 }, (_, index) => index + 21))

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

const provincialRows = [
  ['Land Residential', '40102050-401-01-01', '', '40102050-401-01-01', '', '40102050-402-01-01', '', '40102050-402-01-01', ''],
  ['Land Commercial', '40102050-401-01-02', '', '40102050-401-01-02', '', '40102050-402-01-02', '', '40102050-402-01-02', ''],
  ['Land Industrial', '40102050-401-01-03', '', '40102050-401-01-03', '', '40102050-402-01-03', '', '40102050-402-01-03', ''],
  ['Land Machinery', '40102050-401-01-04', '', '40102050-401-01-04', '', '40102050-402-01-04', '', '40102050-402-01-04', ''],
  ['Land Agricultural', '40102050-401-01-05', '', '40102050-401-01-05', '', '40102050-402-01-05', '', '40102050-402-01-05', ''],
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

  if ([23, 24].includes(report.number)) {
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
      rows: sharingSections,
    }
  }

  if (report.number === 28) {
    return {
      kind: 'provincial',
      title: 'MONTHLY REPORT ON THE COLLECTION OF REAL PROPERTY TAX',
      subtitle: 'BY PROPERTY CLASSIFICATION',
      municipality: 'Municipality of Zamboanguita',
      periodText: `For the month of ${period.monthName} ${period.year}`,
      fundTitle: 'SEF',
      headers: ['', '', 'CURRENT YEAR', '', 'PRIOR YEAR', '', 'CURRENT YEAR PENALTY', '', 'PRIOR YEAR'],
      rows: provincialRows,
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
      rows: [['', '', '', '', '', '']],
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

const SharingTemplate = ({ template }) => (
  <article className="excel-template-sheet printable-report">
    <h1 className="excel-left-title">{template.title}</h1>
    <div className="excel-meta-grid compact-meta">
      {template.meta.map(([label, value]) => (
        <div key={label}><strong>{label}</strong><span>{value}</span></div>
      ))}
    </div>
    <TemplateTable headers={['Classification', 'Current', 'Discount', 'Prior', 'Penalty Current', 'Penalty Prior']} rows={template.rows} />
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

const TemplatePreview = ({ report }) => {
  const template = getTemplateDefinition(report, report.period)

  if (template.kind === 'summary') return <SummaryTemplate template={template} />
  if (template.kind === 'record') return <RecordTemplate template={template} />
  if (template.kind === 'sharing') return <SharingTemplate template={template} />
  if (template.kind === 'provincial') return <ProvincialTemplate template={template} />
  if (template.kind === 'abstract') return <AbstractTemplate template={template} />
  if (template.kind === 'full') return <FullTemplate template={template} />
  return <AbstractTemplate template={template} />
}

export function ReportsPage({ page }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [selectedReportNumber, setSelectedReportNumber] = useState('')
  const [generatedReport, setGeneratedReport] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const range = useMemo(() => getMonthRange(selectedMonth), [selectedMonth])
  const mainReports = page.reports.filter((report) => MAIN_REPORT_NUMBERS.has(report.number))
  const otherReports = page.reports.filter((report) => report.number >= 1 && report.number <= 20)

  const findReport = (value) => page.reports.find((report) => String(report.number) === value)

  const generateReport = async () => {
    const report = findReport(selectedReportNumber)
    if (!report) return

    setIsGenerating(true)
    setGenerationError('')

    try {
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
      const message = error.response?.data?.error || error.message || 'Unable to generate report preview.'
      setGenerationError(message)

      setGeneratedReport({
        ...report,
        generatedAt: new Date().toLocaleString('en-PH'),
        period: range,
        selectedMonth,
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadGeneratedReport = async () => {
    if (!generatedReport) return

    setIsDownloading(true)
    setGenerationError('')

    try {
      const response = await axiosInstance.get(`/generated-reports/${generatedReport.number}/download`, {
        params: {
          date_from: generatedReport.period.dateFrom,
          date_to: generatedReport.period.dateTo,
        },
        responseType: 'blob',
      })
      const disposition = response.headers['content-disposition'] || ''
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i)
      const fallbackName = `report-${generatedReport.number}-${generatedReport.selectedMonth}.xlsx`
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')

      link.href = url
      link.download = filenameMatch?.[1] || fallbackName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
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
    <div className="page-stack reports-page">
      <section className="toolbar-panel master-report-panel report-generator-panel">
        <div className="report-generator-heading">
          <p className="eyebrow">Office of the Municipal Treasurer</p>
          <h2>{page.title}</h2>
          <p className="toolbar-description">Generate, preview, export, and print official LGU treasury report templates.</p>
        </div>

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
              onChange={(event) => setSelectedReportNumber(event.target.value)}
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

          <button className="primary-button generate-selected-report-button" disabled={!selectedReportNumber || isGenerating} onClick={generateReport} type="button">
            <FileText size={15} aria-hidden="true" />
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        <div className="report-generator-helper">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>Report Scope</strong>
            <p>Choose a month and report template. Reports 21 to 31 are generated from the read-only Firebird bridge and uploaded Excel templates.</p>
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
