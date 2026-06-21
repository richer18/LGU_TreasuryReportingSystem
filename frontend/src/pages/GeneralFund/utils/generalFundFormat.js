export const formatMoney = (value) =>
  new Intl.NumberFormat('en-PH', {
    currency: 'PHP',
    minimumFractionDigits: 2,
    style: 'currency',
  }).format(Number(value || 0))

export const formatNumber = (value) =>
  new Intl.NumberFormat('en-PH').format(Number(value || 0))
