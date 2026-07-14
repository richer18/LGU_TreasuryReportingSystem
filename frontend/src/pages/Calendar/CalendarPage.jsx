import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Edit3, Landmark, Plus, RefreshCcw, Trash2, WalletCards } from 'lucide-react'
import axiosInstance from '../../axiosinstance/axiosInstance'
import { getHolidaysForMonth } from '../../data/holidays'
import { getTreasuryRemindersForMonth } from '../../data/treasuryCalendarReminders'
import { formatMoney } from '../GeneralFund/utils/generalFundFormat'

const monthName = (year, month) => new Date(year, month - 1, 1).toLocaleString('en-PH', { month: 'long', year: 'numeric' })
const dateKey = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
const todayKey = () => {
  const today = new Date()
  return dateKey(today.getFullYear(), today.getMonth() + 1, today.getDate())
}

const buildCalendarCells = (year, month) => {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const lastDay = new Date(year, month, 0).getDate()
  const cells = []
  for (let index = 0; index < firstDay; index += 1) cells.push(null)
  for (let day = 1; day <= lastDay; day += 1) cells.push(dateKey(year, month, day))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const groupByDate = (items) => items.reduce((lookup, item) => {
  lookup[item.date] = lookup[item.date] || []
  lookup[item.date].push(item)
  return lookup
}, {})

const emptyDay = (date) => ({
  date,
  collection: { amount: 0, transaction_count: 0, collectors: [] },
  rcd: { count: 0, statuses: [], items: [] },
  exceptions: { canceled_void_count: 0, not_remitted_count: 0 },
  events: [],
})

const statValue = (value) => Number(value || 0)
const eventCategories = [
  { value: 'Task', label: 'Task', color: '#2563eb' },
  { value: 'Meeting', label: 'Meeting', color: '#7c3aed' },
  { value: 'Deadline', label: 'Deadline', color: '#dc2626' },
  { value: 'Reminder', label: 'Reminder', color: '#d97706' },
  { value: 'Holiday', label: 'Holiday', color: '#16a34a' },
]
const categoryColor = (category) => eventCategories.find((item) => item.value === category)?.color || '#2563eb'
const eventDateValue = (date, time = '09:00') => `${date}T${time}`

const toDateTimeLocal = (value, fallbackDate, fallbackTime = '09:00') => {
  if (!value) return eventDateValue(fallbackDate, fallbackTime)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return eventDateValue(fallbackDate, fallbackTime)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const formatEventTime = (event) => {
  if (event.allDay) return 'All day'
  const start = event.start ? new Date(event.start) : null
  const end = event.end ? new Date(event.end) : null
  if (!start || Number.isNaN(start.getTime())) return '-'
  const options = { hour: 'numeric', minute: '2-digit' }
  if (!end || Number.isNaN(end.getTime())) return start.toLocaleTimeString('en-PH', options)
  return `${start.toLocaleTimeString('en-PH', options)} - ${end.toLocaleTimeString('en-PH', options)}`
}

const eventFormFromDate = (date) => ({ id: null, title: '', description: '', category: 'Reminder', color: '#d97706', allDay: false, startAt: eventDateValue(date, '09:00'), endAt: eventDateValue(date, '10:00') })
const eventFormFromEvent = (event, fallbackDate) => ({
  id: event.id,
  title: event.title || '',
  description: event.description || '',
  category: event.category || 'Reminder',
  color: event.color || categoryColor(event.category || 'Reminder'),
  allDay: Boolean(event.allDay),
  startAt: toDateTimeLocal(event.start, fallbackDate, '09:00'),
  endAt: toDateTimeLocal(event.end, fallbackDate, '10:00'),
})

export function CalendarPage({ user }) {
  const now = new Date()
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [calendarData, setCalendarData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [eventError, setEventError] = useState('')
  const [savingEvent, setSavingEvent] = useState(false)
  const [eventDialog, setEventDialog] = useState({ open: false, mode: 'create' })
  const [eventForm, setEventForm] = useState(eventFormFromDate(todayKey()))
  const canManageCalendar = Boolean(user?.permissions?.includes('calendar.manage'))

  const holidays = useMemo(() => getHolidaysForMonth(period.year, period.month), [period.year, period.month])
  const reminders = useMemo(() => getTreasuryRemindersForMonth(period.year, period.month), [period.year, period.month])
  const holidaysByDate = useMemo(() => groupByDate(holidays), [holidays])
  const remindersByDate = useMemo(() => groupByDate(reminders), [reminders])
  const cells = useMemo(() => buildCalendarCells(period.year, period.month), [period.year, period.month])
  const daysByDate = useMemo(() => {
    const lookup = {}
    ;(calendarData?.days || []).forEach((day) => { lookup[day.date] = { ...emptyDay(day.date), ...day, events: day.events || [] } })
    return lookup
  }, [calendarData])

  const selectedDay = daysByDate[selectedDate] || emptyDay(selectedDate)
  const selectedHolidays = holidaysByDate[selectedDate] || []
  const selectedReminders = remindersByDate[selectedDate] || []

  const loadCalendar = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await axiosInstance.get('/calendar/summary', { params: { year: period.year, month: period.month } })
      setCalendarData(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message || 'Unable to load calendar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const firstOfMonth = dateKey(period.year, period.month, 1)
    const currentToday = todayKey()
    setSelectedDate(currentToday.startsWith(firstOfMonth.slice(0, 7)) ? currentToday : firstOfMonth)
  }, [period.year, period.month])

  useEffect(() => {
    loadCalendar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.year, period.month])

  const moveMonth = (offset) => setPeriod((current) => {
    const next = new Date(current.year, current.month - 1 + offset, 1)
    return { year: next.getFullYear(), month: next.getMonth() + 1 }
  })
  const goToday = () => {
    const today = new Date()
    setPeriod({ year: today.getFullYear(), month: today.getMonth() + 1 })
    setSelectedDate(todayKey())
  }
  const openCreateEvent = () => { setEventError(''); setEventForm(eventFormFromDate(selectedDate)); setEventDialog({ open: true, mode: 'create' }) }
  const openEditEvent = (event) => { setEventError(''); setEventForm(eventFormFromEvent(event, selectedDate)); setEventDialog({ open: true, mode: 'edit' }) }
  const closeEventDialog = () => { setEventDialog({ open: false, mode: 'create' }); setEventError('') }
  const updateEventForm = (field, value) => setEventForm((current) => {
    const next = { ...current, [field]: value }
    if (field === 'category') next.color = categoryColor(value)
    if (field === 'allDay' && value) {
      const date = (current.startAt || eventDateValue(selectedDate)).slice(0, 10)
      next.startAt = `${date}T00:00`
      next.endAt = `${date}T23:59`
    }
    return next
  })

  const saveEvent = async () => {
    if (!eventForm.title.trim()) { setEventError('Title is required.'); return }
    if (new Date(eventForm.endAt).getTime() < new Date(eventForm.startAt).getTime()) { setEventError('End schedule must be after the start schedule.'); return }
    setSavingEvent(true)
    setEventError('')
    try {
      const payload = { title: eventForm.title.trim(), description: eventForm.description.trim(), category: eventForm.category, color: eventForm.color, all_day: eventForm.allDay, start_at: eventForm.startAt, end_at: eventForm.endAt }
      if (eventDialog.mode === 'edit' && eventForm.id) await axiosInstance.patch(`/calendar/events/${eventForm.id}`, payload)
      else await axiosInstance.post('/calendar/events', payload)
      closeEventDialog()
      await loadCalendar()
    } catch (requestError) {
      setEventError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message || 'Unable to save calendar event.')
    } finally {
      setSavingEvent(false)
    }
  }

  const deleteEvent = async () => {
    if (!eventForm.id) return
    setSavingEvent(true)
    setEventError('')
    try {
      await axiosInstance.delete(`/calendar/events/${eventForm.id}`)
      closeEventDialog()
      await loadCalendar()
    } catch (requestError) {
      setEventError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message || 'Unable to delete calendar event.')
    } finally {
      setSavingEvent(false)
    }
  }

  const summary = calendarData?.summary || {}
  const exceptionTotal = statValue(summary.receipt_exceptions_count)
  const manualEventTotal = statValue(summary.manual_event_count)
  const warnings = calendarData?.warnings || []
  const scopeMessage = calendarData?.scope?.message

  return (
    <section className="calendar-page">
      <div className="calendar-hero">
        <div>
          <p className="eyebrow">Treasury Operations</p>
          <h1>Treasury Calendar</h1>
          <p>Monitor holidays, collections, remittances, exceptions, report reminders, and manual treasury events.</p>
          <span className="calendar-user-scope">{user?.role === 'admin' || user?.role === 'treasurer' ? 'All treasury activity' : calendarData?.scope?.collector_label || calendarData?.scope?.message || 'Limited calendar view'}</span>
        </div>
        <div className="calendar-toolbar">
          <button className="secondary-button" onClick={() => moveMonth(-1)} type="button"><ChevronLeft size={18} aria-hidden="true" />Previous</button>
          <strong>{monthName(period.year, period.month)}</strong>
          <button className="secondary-button" onClick={() => moveMonth(1)} type="button">Next<ChevronRight size={18} aria-hidden="true" /></button>
          <button className="primary-button" onClick={goToday} type="button">Today</button>
          {canManageCalendar && <button className="primary-button" onClick={openCreateEvent} type="button"><Plus size={18} aria-hidden="true" />Add Event</button>}
        </div>
      </div>

      {(scopeMessage || warnings.length > 0 || error) && (
        <div className={`calendar-notice ${error ? 'is-error' : ''}`}><AlertTriangle size={18} aria-hidden="true" /><div>{error || scopeMessage || warnings[0]}{warnings.length > 1 && <span> {warnings.length - 1} more warning(s).</span>}</div></div>
      )}

      <div className="calendar-summary-grid">
        <article><WalletCards size={20} aria-hidden="true" /><span>Today's Collection</span><strong>{formatMoney(summary.today_collection || 0)}</strong></article>
        <article><Landmark size={20} aria-hidden="true" /><span>Month Collection</span><strong>{formatMoney(summary.month_collection || 0)}</strong></article>
        <article><ClipboardList size={20} aria-hidden="true" /><span>Pending Remittance</span><strong>{statValue(summary.pending_remittance_count)}</strong></article>
        <article><AlertTriangle size={20} aria-hidden="true" /><span>Receipt Exceptions</span><strong>{exceptionTotal}</strong></article>
        <article><CalendarDays size={20} aria-hidden="true" /><span>Manual Events</span><strong>{manualEventTotal}</strong></article>
      </div>

      <div className="calendar-workspace-grid">
        <div className="calendar-card calendar-month-card">
          <div className="calendar-card-header"><div><p className="eyebrow">Month View</p><h2>{monthName(period.year, period.month)}</h2></div><button className="secondary-button" disabled={loading} onClick={loadCalendar} type="button"><RefreshCcw size={16} aria-hidden="true" />{loading ? 'Loading' : 'Refresh'}</button></div>
          <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {cells.map((cell, index) => {
              if (!cell) return <div className="calendar-day is-empty" key={`empty-${index}`} />
              const day = daysByDate[cell] || emptyDay(cell)
              const dayNumber = Number(cell.slice(-2))
              const isToday = cell === todayKey()
              const isSelected = cell === selectedDate
              const dayHolidays = holidaysByDate[cell] || []
              const dayReminders = remindersByDate[cell] || []
              const dayEvents = day.events || []
              const hasCollection = statValue(day.collection?.amount) > 0
              const hasRcd = statValue(day.rcd?.count) > 0
              const hasException = statValue(day.exceptions?.canceled_void_count) + statValue(day.exceptions?.not_remitted_count) > 0
              return (
                <button className={`calendar-day ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`} key={cell} onClick={() => setSelectedDate(cell)} type="button">
                  <span className="calendar-day-number">{dayNumber}</span>
                  {hasCollection && <strong>{formatMoney(day.collection.amount)}</strong>}
                  <div className="calendar-badges">
                    {dayHolidays.length > 0 && <span className="calendar-badge holiday">Holiday</span>}
                    {hasCollection && <span className="calendar-badge collection">Collection</span>}
                    {hasRcd && <span className="calendar-badge rcd">RCD</span>}
                    {hasException && <span className="calendar-badge exception">Exception</span>}
                    {dayReminders.length > 0 && <span className="calendar-badge reminder">Report Due</span>}
                    {dayEvents.length > 0 && <span className="calendar-badge event">Event</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="calendar-card calendar-detail-panel">
          <p className="eyebrow">Selected Date</p>
          <h2>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
          <div className="calendar-detail-block"><h3>Collection</h3><strong>{formatMoney(selectedDay.collection?.amount || 0)}</strong><span>{statValue(selectedDay.collection?.transaction_count)} receipt(s)</span>{(selectedDay.collection?.collectors || []).map((collector) => <div className="calendar-detail-line" key={`${collector.collector}-${collector.amount}`}><span>{collector.collector}</span><strong>{formatMoney(collector.amount)}</strong></div>)}</div>
          <div className="calendar-detail-block"><h3>RCD / Remittance</h3>{(selectedDay.rcd?.items || []).length === 0 && <span>No RCD activity.</span>}{(selectedDay.rcd?.items || []).map((item) => <div className="calendar-detail-line is-stacked" key={`${item.report_no}-${item.status}`}><span>{item.report_no} - {item.collector}</span><strong>{item.status}</strong></div>)}</div>
          <div className="calendar-detail-block"><h3>Manual Events</h3>{(selectedDay.events || []).length === 0 && <span>No manual event.</span>}{(selectedDay.events || []).map((event) => <div className="calendar-detail-line is-stacked calendar-event-line" key={`${event.id}-${event.title}`} style={{ '--event-color': event.color || categoryColor(event.category) }}><span>{event.title}</span><strong>{event.category} | {formatEventTime(event)}</strong>{event.description && <small>{event.description}</small>}{canManageCalendar && !event.isSystem && <button className="calendar-link-button" onClick={() => openEditEvent(event)} type="button"><Edit3 size={14} aria-hidden="true" />Edit</button>}</div>)}</div>
          <div className="calendar-detail-block"><h3>Receipt Exceptions</h3><div className="calendar-detail-line"><span>Canceled / Void</span><strong>{statValue(selectedDay.exceptions?.canceled_void_count)}</strong></div><div className="calendar-detail-line"><span>Not Remitted</span><strong>{statValue(selectedDay.exceptions?.not_remitted_count)}</strong></div></div>
          <div className="calendar-detail-block"><h3>Holidays / Reminders</h3>{[...selectedHolidays, ...selectedReminders].length === 0 && <span>No holiday or reminder.</span>}{selectedHolidays.map((holiday) => <div className="calendar-detail-line is-stacked" key={holiday.name}><span>{holiday.name}</span><strong>{holiday.type}</strong></div>)}{selectedReminders.map((reminder) => <div className="calendar-detail-line is-stacked" key={reminder.title}><span>{reminder.title}</span><strong>{reminder.type}</strong></div>)}</div>
        </aside>
      </div>

      {eventDialog.open && (
        <div className="calendar-modal-backdrop" role="presentation">
          <div className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-event-title">
            <div className="calendar-modal-header"><div><p className="eyebrow">Treasury Event</p><h2 id="calendar-event-title">{eventDialog.mode === 'edit' ? 'Edit Event' : 'Add Event'}</h2></div><button className="icon-button" onClick={closeEventDialog} type="button">x</button></div>
            {eventError && <div className="calendar-notice is-error"><AlertTriangle size={18} aria-hidden="true" />{eventError}</div>}
            <div className="calendar-form-grid">
              <label><span>Title</span><input onChange={(event) => updateEventForm('title', event.target.value)} value={eventForm.title} /></label>
              <label><span>Category</span><select onChange={(event) => updateEventForm('category', event.target.value)} value={eventForm.category}>{eventCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
              <label><span>Start</span><input onChange={(event) => updateEventForm('startAt', event.target.value)} type="datetime-local" value={eventForm.startAt} /></label>
              <label><span>End</span><input onChange={(event) => updateEventForm('endAt', event.target.value)} type="datetime-local" value={eventForm.endAt} /></label>
              <label className="calendar-checkbox-row"><input checked={eventForm.allDay} onChange={(event) => updateEventForm('allDay', event.target.checked)} type="checkbox" /><span>All day event</span></label>
              <label className="calendar-form-wide"><span>Description</span><textarea onChange={(event) => updateEventForm('description', event.target.value)} rows={4} value={eventForm.description} /></label>
            </div>
            <div className="calendar-modal-actions">
              {eventDialog.mode === 'edit' && <button className="danger-button" disabled={savingEvent} onClick={deleteEvent} type="button"><Trash2 size={16} aria-hidden="true" />Delete</button>}
              <button className="secondary-button" onClick={closeEventDialog} type="button">Cancel</button>
              <button className="primary-button" disabled={savingEvent} onClick={saveEvent} type="button">{savingEvent ? 'Saving' : 'Save Event'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
