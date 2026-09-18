<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('waterworks_accounts')) {
            Schema::create('waterworks_accounts', function (Blueprint $table) {
                $table->id();
                $table->string('local_tin', 80)->nullable()->index();
                $table->string('permittee_name', 180)->index();
                $table->string('address', 255)->nullable();
                $table->string('account_number', 80)->nullable()->index();
                $table->string('meter_number', 80)->nullable();
                $table->string('connection_type', 80)->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('waterworks_payments')) {
            Schema::create('waterworks_payments', function (Blueprint $table) {
                $table->id();
                $table->string('payment_reference', 120)->unique();
                $table->string('source_origin', 80)->default('general_fund_payment');
                $table->date('payment_date')->nullable();
                $table->string('receipt_no', 80)->nullable()->index();
                $table->string('permittee_name', 180)->nullable()->index();
                $table->string('address', 255)->nullable();
                $table->string('account_number', 80)->nullable()->index();
                $table->string('meter_number', 80)->nullable();
                $table->string('local_tin', 80)->nullable()->index();
                $table->string('connection_type', 80)->nullable();
                $table->string('collector', 80)->nullable()->index();
                $table->string('cashier_user_id', 80)->nullable();
                $table->string('payment_mode', 80)->nullable();
                $table->unsignedTinyInteger('billing_month')->nullable();
                $table->unsignedSmallInteger('billing_year')->nullable();
                $table->decimal('total_usage', 14, 2)->default(0);
                $table->decimal('subtotal_amount', 14, 2)->default(0);
                $table->decimal('surcharge_amount', 14, 2)->default(0);
                $table->decimal('interest_amount', 14, 2)->default(0);
                $table->decimal('total_amount_due', 14, 2)->default(0);
                $table->decimal('total_amount_paid', 14, 2)->default(0);
                $table->string('status', 40)->default('PAID')->index();
                $table->text('remarks')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('waterworks_tickets')) {
            Schema::create('waterworks_tickets', function (Blueprint $table) {
                $table->id();
                $table->string('ticket_no', 80)->unique();
                $table->string('taxpayer_name', 180)->index();
                $table->string('local_tin', 80)->nullable()->index();
                $table->string('account_number', 80)->nullable()->index();
                $table->string('meter_number', 80)->nullable();
                $table->string('concern_type', 100)->nullable();
                $table->string('priority', 40)->default('Normal');
                $table->string('status', 40)->default('Open')->index();
                $table->string('assigned_to', 120)->nullable();
                $table->text('description')->nullable();
                $table->text('remarks')->nullable();
                $table->timestamp('opened_at')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('waterworks_tickets');
        Schema::dropIfExists('waterworks_payments');
        Schema::dropIfExists('waterworks_accounts');
    }
};
