const lastDayOfMonth = (year, month) => new Date(year, month, 0).getDate()

export const getTreasuryRemindersForMonth = (year, month) => {
  const monthText = `${year}-${String(month).padStart(2, '0')}`
  const endDay = lastDayOfMonth(year, month)
  const reminders = [
    {
      date: `${monthText}-01`,
      title: 'Monthly collection monitoring starts',
      type: 'monthly',
    },
    {
      date: `${monthText}-${String(Math.min(5, endDay)).padStart(2, '0')}`,
      title: 'Review prior month collection summaries',
      type: 'monthly',
    },
    {
      date: `${monthText}-${String(Math.min(10, endDay)).padStart(2, '0')}`,
      title: 'Income target review',
      type: 'income-target',
    },
    {
      date: `${monthText}-${String(endDay).padStart(2, '0')}`,
      title: 'Month-end report preparation',
      type: 'month-end',
    },
  ]

  if ([3, 6, 9, 12].includes(month)) {
    reminders.push({
      date: `${monthText}-${String(endDay).padStart(2, '0')}`,
      title: 'Quarterly ESRE preparation',
      type: 'quarterly',
    })
  }

  if (month === 12) {
    reminders.push({
      date: `${monthText}-31`,
      title: 'Year-end treasury report preparation',
      type: 'year-end',
    })
  }

  return reminders
}
