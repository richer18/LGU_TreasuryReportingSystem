import { useCallback, useEffect, useMemo, useState } from 'react'
import axiosInstance from '../../../axiosinstance/axiosInstance'

const toDateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const currentMonthDefaultFilters = () => {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)

  return {
    date_from: toDateInputValue(firstDay),
    date_to: toDateInputValue(today),
    collector: '',
    receipt_from: '',
    receipt_to: '',
  }
}

const defaultFilters = {
  ...currentMonthDefaultFilters(),
}

const initialData = {
  summary: null,
  collections: [],
  daily: [],
  sources: [],
  collectors: [],
  receiptReport: [],
}

const buildParams = (filters, extra = {}) => {
  const params = {
    date_from: filters.date_from,
    date_to: filters.date_to,
    ...extra,
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) {
      delete params[key]
    }
  })

  return params
}

export function useGeneralFundData(fundScope = 'general') {
  const [filters, setFilters] = useState(defaultFilters)
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const params = useMemo(() => buildParams(filters, { fund_scope: fundScope }), [filters, fundScope])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [summary, collections, collectors, daily] = await Promise.all([
        axiosInstance.get('/general-fund/summary', { params }),
        axiosInstance.get('/general-fund/collections', { params: { ...params, limit: 150 } }),
        axiosInstance.get('/general-fund/collectors', { params }),
        axiosInstance.get('/general-fund/daily', { params }),
      ])

      setData((current) => ({
        ...current,
        summary: summary.data.data,
        collections: collections.data.data || [],
        collectors: collectors.data.data || [],
        daily: daily.data.data || [],
      }))
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load collections.',
      )
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  const loadReceiptReport = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await axiosInstance.get('/general-fund/receipt-report', {
        params: buildParams(filters, {
          collector: filters.collector,
          fund_scope: fundScope,
          receipt_from: filters.receipt_from,
          receipt_to: filters.receipt_to,
          limit: 300,
        }),
      })

      setData((current) => ({
        ...current,
        receiptReport: response.data.data || [],
      }))
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load the receipt report.',
      )
    } finally {
      setLoading(false)
    }
  }

  return {
    data,
    error,
    filters,
    loading,
    loadData,
    loadReceiptReport,
    updateFilter,
  }
}
