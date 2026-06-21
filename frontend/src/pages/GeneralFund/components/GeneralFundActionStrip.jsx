import { BarChart3, CalendarDays, ListTree, Users } from 'lucide-react'

const actions = [
  { id: 'category', label: 'Category Breakdown', icon: BarChart3 },
  { id: 'collector', label: 'Collection per Collector', icon: Users },
  { id: 'daily', label: 'Daily Collection', icon: CalendarDays },
  { id: 'source', label: 'Source Breakdown', icon: ListTree },
]

export function GeneralFundActionStrip({ onOpen }) {
  return (
    <section className="action-strip" aria-label="General Fund report views">
      {actions.map((action) => {
        const Icon = action.icon

        return (
          <button key={action.id} onClick={() => onOpen(action.id)} type="button">
            <Icon size={18} aria-hidden="true" />
            <span>{action.label}</span>
          </button>
        )
      })}
    </section>
  )
}
