import { AlertCircle, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { GeneralFundActionStrip } from './components/GeneralFundActionStrip'
import { GeneralFundCategoryBreakdown } from './components/GeneralFundCategoryBreakdown'
import { GeneralFundCollectorCollections } from './components/GeneralFundCollectorCollections'
import { GeneralFundCollectionsTable } from './components/GeneralFundCollectionsTable'
import { GeneralFundDailyTable } from './components/GeneralFundDailyTable'
import { GeneralFundDialog } from './components/GeneralFundDialog'
import { GeneralFundFilters } from './components/GeneralFundFilters'
import { GeneralFundReceiptReport } from './components/GeneralFundReceiptReport'
import { GeneralFundSourceBreakdown } from './components/GeneralFundSourceBreakdown'
import { useGeneralFundData } from './hooks/useGeneralFundData'

export function GeneralFundPage() {
  const [activeDialog, setActiveDialog] = useState('')
  const {
    data,
    error,
    filters,
    loading,
    loadData,
    updateFilter,
  } = useGeneralFundData()

  const openDialog = (dialog) => {
    setActiveDialog(dialog)
  }

  return (
    <div className="page-stack general-fund-page">
      <section className="general-fund-hero">
        <div>
          <p className="eyebrow">Collection Monitor</p>
          <h2>General Fund</h2>
        </div>
        <button className="general-fund-generate-button" onClick={() => openDialog('generateReceipt')} type="button">
          <ReceiptText size={17} aria-hidden="true" />
          Generate Receipt
        </button>
      </section>

      <GeneralFundFilters
        collectors={data.collectors}
        filters={filters}
        loading={loading}
        onRefresh={loadData}
        onUpdateFilter={updateFilter}
      />

      {error && (
        <section className="inline-alert">
          <AlertCircle size={18} aria-hidden="true" />
          {error}
        </section>
      )}

      <GeneralFundActionStrip onOpen={openDialog} />
      <GeneralFundCollectionsTable collections={data.collections} />

      <GeneralFundDialog
        onClose={() => setActiveDialog('')}
        open={activeDialog === 'category'}
        title="Category Breakdown"
      >
        <GeneralFundCategoryBreakdown categories={data.summary?.categories || []} filters={filters} />
      </GeneralFundDialog>

      <GeneralFundDialog
        onClose={() => setActiveDialog('')}
        open={activeDialog === 'collector'}
        title="Collection per Collector"
      >
        <GeneralFundCollectorCollections collectors={data.collectors} filters={filters} />
      </GeneralFundDialog>

      <GeneralFundDialog
        onClose={() => setActiveDialog('')}
        open={activeDialog === 'generateReceipt'}
        title="Generate Receipt"
      >
        <GeneralFundReceiptReport collectors={data.collectors} />
      </GeneralFundDialog>

      <GeneralFundDialog
        onClose={() => setActiveDialog('')}
        open={activeDialog === 'daily'}
        title="Daily Collection"
      >
        <GeneralFundDailyTable daily={data.daily} />
      </GeneralFundDialog>

      <GeneralFundDialog
        onClose={() => setActiveDialog('')}
        open={activeDialog === 'source'}
        title="Source Breakdown"
      >
        <GeneralFundSourceBreakdown filters={filters} />
      </GeneralFundDialog>
    </div>
  )
}
