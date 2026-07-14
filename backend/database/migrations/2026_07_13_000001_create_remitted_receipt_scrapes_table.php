<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('remitted_receipt_scrapes')) {
            return;
        }

        Schema::create('remitted_receipt_scrapes', function (Blueprint $table) {
            $table->id();
            $table->string('input_receipt_no', 80)->index();
            $table->string('input_form_type', 120)->nullable()->index();
            $table->decimal('input_amount', 18, 2)->nullable();
            $table->string('input_assigned_collector', 150)->nullable()->index();
            $table->string('payment_id', 80)->nullable()->index();
            $table->date('collection_date')->nullable()->index();
            $table->string('taxpayer_name', 255)->nullable();
            $table->string('receipt_no', 80)->nullable()->index();
            $table->string('receipt_type', 120)->nullable();
            $table->string('rcd_number', 120)->nullable()->index();
            $table->text('descriptions')->nullable();
            $table->decimal('amount', 18, 2)->default(0);
            $table->dateTime('date_remitted')->nullable()->index();
            $table->string('cashier', 150)->nullable();
            $table->string('rcd_collection', 255)->nullable();
            $table->dateTime('transaction_date')->nullable()->index();
            $table->string('assigned_collector', 150)->nullable()->index();
            $table->string('collection_status', 80)->nullable()->index();
            $table->unsignedBigInteger('rcd_batch_id')->nullable()->index();
            $table->unsignedBigInteger('rcd_collection_line_id')->nullable()->index();
            $table->string('scrape_status', 80)->default('Pending')->index();
            $table->text('scrape_message')->nullable();
            $table->json('raw_json')->nullable();
            $table->timestamps();
            $table->unique(['input_receipt_no', 'payment_id'], 'uq_remitted_receipt_payment');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('remitted_receipt_scrapes');
    }
};
