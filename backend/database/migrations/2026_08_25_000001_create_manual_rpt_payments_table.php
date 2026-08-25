<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('manual_rpt_payments')) {
            return;
        }

        Schema::create('manual_rpt_payments', function (Blueprint $table) {
            $table->id();
            $table->string('td_no', 80);
            $table->date('payment_date');
            $table->string('declared_owner')->nullable();
            $table->string('paid_by');
            $table->string('receipt_no', 80)->nullable();
            $table->string('tax_year', 20)->nullable();
            $table->decimal('basic_tax', 14, 2)->default(0);
            $table->decimal('basic_penalty', 14, 2)->default(0);
            $table->decimal('sef_tax', 14, 2)->default(0);
            $table->decimal('sef_penalty', 14, 2)->default(0);
            $table->decimal('total_amount', 14, 2)->default(0);
            $table->string('collector')->nullable();
            $table->string('rcd_number', 80)->nullable();
            $table->string('status', 40)->default('Manual');
            $table->text('remarks')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('td_no');
            $table->index('payment_date');
            $table->index('receipt_no');
            $table->index(['td_no', 'payment_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manual_rpt_payments');
    }
};
