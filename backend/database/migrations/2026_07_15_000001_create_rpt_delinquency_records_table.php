<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('rpt_delinquency_records')) {
            return;
        }

        Schema::create('rpt_delinquency_records', function (Blueprint $table) {
            $table->id();
            $table->string('taxpayer_name');
            $table->string('tax_year', 4);
            $table->date('computed_until')->nullable();
            $table->string('tax_dec_no', 80)->nullable();
            $table->string('property_index_no', 80)->nullable();
            $table->string('lot_no', 80)->nullable();
            $table->string('location', 140)->nullable();
            $table->string('property_kind', 80)->nullable();
            $table->decimal('assessed_value', 14, 2)->nullable();
            $table->string('unpaid_years', 80)->nullable();
            $table->string('unpaid_quarters', 80)->nullable();
            $table->decimal('total_amount', 14, 2)->default(0);
            $table->string('status', 40)->default('Active');
            $table->text('remarks')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tax_year', 'status']);
            $table->index('taxpayer_name');
            $table->index('tax_dec_no');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rpt_delinquency_records');
    }
};
