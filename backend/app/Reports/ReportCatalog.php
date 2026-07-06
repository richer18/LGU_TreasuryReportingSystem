<?php

namespace App\Reports;

use Illuminate\Support\Collection;

class ReportCatalog
{
    public function all(): Collection
    {
        return collect([
            ['number' => 1, 'name' => 'Unified collection detail: RPT, CTC, and Other Fees/Charges', 'group' => 'source_query', 'status' => 'planned'],
            ['number' => 2, 'name' => 'Real Property Tax payment detail with RPT posting/account context', 'group' => 'rpt', 'status' => 'planned'],
            ['number' => 3, 'name' => 'RPT totals by Basic/SEF/other RPT line classification', 'group' => 'rpt', 'status' => 'planned'],
            ['number' => 4, 'name' => 'Community Tax Certificate / Cedula payment detail', 'group' => 'ctc', 'status' => 'planned'],
            ['number' => 5, 'name' => 'CTC totals; compares payment line totals to CTC computed/recorded totals', 'group' => 'ctc', 'status' => 'planned'],
            ['number' => 6, 'name' => 'Other Fees and Charges payment detail', 'group' => 'other_fees', 'status' => 'planned'],
            ['number' => 7, 'name' => 'Other Fees and Charges totals by revenue code', 'group' => 'other_fees', 'status' => 'planned'],
            ['number' => 8, 'name' => 'Daily collections for the three processes', 'group' => 'collections', 'status' => 'planned'],
            ['number' => 9, 'name' => 'Monthly collections for the three processes', 'group' => 'collections', 'status' => 'planned'],
            ['number' => 10, 'name' => 'Quarterly collections for the three processes', 'group' => 'collections', 'status' => 'planned'],
            ['number' => 11, 'name' => 'Yearly collections for the three processes', 'group' => 'collections', 'status' => 'planned'],
            ['number' => 12, 'name' => 'Receipt range and header-vs-detail reconciliation', 'group' => 'receipts', 'status' => 'planned'],
            ['number' => 13, 'name' => 'Other Fees and Charges tax/rate list', 'group' => 'other_fees', 'status' => 'planned'],
            ['number' => 14, 'name' => 'Other Fees and Charges parent-child hierarchy with rates', 'group' => 'other_fees', 'status' => 'planned'],
            ['number' => 15, 'name' => 'Total collection per collector: daily, monthly, and yearly', 'group' => 'collectors', 'status' => 'planned'],
            ['number' => 16, 'name' => 'Fees collected by selected collector', 'group' => 'collectors', 'status' => 'planned'],
            ['number' => 17, 'name' => 'Sources of Collections summary', 'group' => 'esre', 'status' => 'planned'],
            ['number' => 18, 'name' => 'Process flow: Real Property Tax payment', 'group' => 'workflow', 'status' => 'documented'],
            ['number' => 19, 'name' => 'Process flow: Community Tax Certificate / Cedula payment', 'group' => 'workflow', 'status' => 'documented'],
            ['number' => 20, 'name' => 'Process flow: Other Fees and Charges', 'group' => 'workflow', 'status' => 'documented'],
            ['number' => 21, 'name' => 'Summary of Collection', 'group' => 'summary_collection', 'status' => 'implemented_script'],
            ['number' => 22, 'name' => 'Summary of Collection no rpt', 'group' => 'summary_collection', 'status' => 'implemented_script'],
            ['number' => 23, 'name' => 'Summary of Collection rpt', 'group' => 'summary_collection', 'status' => 'implemented_script'],
            ['number' => 25, 'name' => 'Record of Real Property Tax Collection', 'group' => 'rpt', 'status' => 'implemented_script'],
            ['number' => 26, 'name' => 'Record of Real Property Tax Collection - Advance Payment Report', 'group' => 'rpt', 'status' => 'implemented_script'],
            ['number' => 27, 'name' => 'Summary Report Sharing', 'group' => 'rpt_sharing', 'status' => 'implemented_script'],
            ['number' => 28, 'name' => 'Provincial RPT Coding / Province Remittance Report', 'group' => 'rpt_sharing', 'status' => 'implemented_script'],
            ['number' => 29, 'name' => 'Abstract of General Collections', 'group' => 'abstract', 'status' => 'implemented_script'],
            ['number' => 30, 'name' => 'Abstract of Trust Funds Collections', 'group' => 'abstract', 'status' => 'implemented_script'],
            ['number' => 31, 'name' => 'Full Report Collections', 'group' => 'full_report', 'status' => 'implemented_script'],
            ['number' => 32, 'name' => 'CMCI Annex A-B Business Permit Registration Report', 'group' => 'business_permit', 'status' => 'implemented_script'],
            ['number' => 33, 'name' => 'Tax on Business Summary from BPLS Business Tax', 'group' => 'business_tax', 'status' => 'implemented_script'],
            ['number' => 34, 'name' => 'Generate Collection Receipt Per Collector', 'group' => 'collectors', 'status' => 'implemented_script'],
            ['number' => 35, 'name' => 'Canceled / Void Receipts Report', 'group' => 'receipt_exceptions', 'status' => 'implemented_script'],
            ['number' => 36, 'name' => 'Receipts Not Remitted Report', 'group' => 'receipt_exceptions', 'status' => 'implemented_script'],
            ['number' => 37, 'name' => 'Official Report Breakdown', 'group' => 'category_breakdown', 'status' => 'implemented_script'],
            ['number' => 38, 'name' => 'ESRE Quarterly Report', 'group' => 'esre', 'status' => 'implemented_script'],
        ]);
    }

    public function find(int $number): ?array
    {
        return $this->all()->firstWhere('number', $number);
    }
}
