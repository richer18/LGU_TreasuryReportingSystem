import { Banknote, ReceiptText, Users } from 'lucide-react'
import { formatMoney, formatNumber } from '../utils/generalFundFormat'

export function GeneralFundSummaryCards({ summary }) {
  const totals = summary?.totals || {}

  return (
    <section className="metrics-grid general-fund-metrics" aria-label="General Fund summary">
      <SummaryCard icon={Banknote} label="Total General Fund" value={formatMoney(totals.total_amount)} />
      <SummaryCard icon={ReceiptText} label="Receipts" value={formatNumber(totals.receipt_count)} />
      <SummaryCard icon={Users} label="Collectors" value={formatNumber(totals.collector_count)} />
    </section>
  )
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <div className="metric">
      <Icon size={20} aria-hidden="true" />
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
