<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('rcd_batches')) {
            Schema::table('rcd_batches', function (Blueprint $table) {
                if (! Schema::hasColumn('rcd_batches', 'receipt_no_from')) {
                    $table->string('receipt_no_from', 80)->nullable()->index()->after('date_to');
                }
                if (! Schema::hasColumn('rcd_batches', 'receipt_no_to')) {
                    $table->string('receipt_no_to', 80)->nullable()->after('receipt_no_from');
                }
                if (! Schema::hasColumn('rcd_batches', 'fdb_total')) {
                    $table->decimal('fdb_total', 18, 2)->default(0)->after('receipt_no_to');
                }
                if (! Schema::hasColumn('rcd_batches', 'difference')) {
                    $table->decimal('difference', 18, 2)->default(0)->after('fdb_total');
                }
                if (! Schema::hasColumn('rcd_batches', 'remittance_status')) {
                    $table->string('remittance_status', 80)->nullable()->index()->after('variance_amount');
                }
                if (! Schema::hasColumn('rcd_batches', 'remitted_by')) {
                    $table->string('remitted_by', 150)->nullable()->after('remittance_status');
                }
                if (! Schema::hasColumn('rcd_batches', 'remitted_at')) {
                    $table->dateTime('remitted_at')->nullable()->after('remitted_by');
                }
                if (! Schema::hasColumn('rcd_batches', 'remitted_to_aco_by')) {
                    $table->string('remitted_to_aco_by', 150)->nullable()->after('remitted_at');
                }
                if (! Schema::hasColumn('rcd_batches', 'remitted_to_aco_at')) {
                    $table->dateTime('remitted_to_aco_at')->nullable()->after('remitted_to_aco_by');
                }
                if (! Schema::hasColumn('rcd_batches', 'received_by')) {
                    $table->string('received_by', 150)->nullable()->after('remitted_to_aco_at');
                }
                if (! Schema::hasColumn('rcd_batches', 'received_at')) {
                    $table->dateTime('received_at')->nullable()->after('received_by');
                }
                if (! Schema::hasColumn('rcd_batches', 'received_by_aco')) {
                    $table->string('received_by_aco', 150)->nullable()->after('received_at');
                }
                if (! Schema::hasColumn('rcd_batches', 'received_by_aco_at')) {
                    $table->dateTime('received_by_aco_at')->nullable()->after('received_by_aco');
                }
                if (! Schema::hasColumn('rcd_batches', 'cash_amount')) {
                    $table->decimal('cash_amount', 18, 2)->default(0)->after('received_by_aco_at');
                }
                if (! Schema::hasColumn('rcd_batches', 'check_amount')) {
                    $table->decimal('check_amount', 18, 2)->default(0)->after('cash_amount');
                }
                if (! Schema::hasColumn('rcd_batches', 'reference_no')) {
                    $table->string('reference_no', 150)->nullable()->after('check_amount');
                }
                if (! Schema::hasColumn('rcd_batches', 'remittance_remarks')) {
                    $table->text('remittance_remarks')->nullable()->after('reference_no');
                }
            });
        }

        if (Schema::hasTable('rcd_collection_lines')) {
            Schema::table('rcd_collection_lines', function (Blueprint $table) {
                if (! Schema::hasColumn('rcd_collection_lines', 'line_no')) {
                    $table->unsignedInteger('line_no')->default(0)->after('rcd_batch_id');
                }
                if (! Schema::hasColumn('rcd_collection_lines', 'fdb_total')) {
                    $table->decimal('fdb_total', 18, 2)->default(0)->after('amount');
                }
                if (! Schema::hasColumn('rcd_collection_lines', 'saved_total')) {
                    $table->decimal('saved_total', 18, 2)->default(0)->after('fdb_total');
                }
                if (! Schema::hasColumn('rcd_collection_lines', 'difference')) {
                    $table->decimal('difference', 18, 2)->default(0)->after('saved_total');
                }
                if (! Schema::hasColumn('rcd_collection_lines', 'validation_message')) {
                    $table->text('validation_message')->nullable()->after('validation_status');
                }
                if (! Schema::hasColumn('rcd_collection_lines', 'raw_json')) {
                    $table->json('raw_json')->nullable()->after('validation_message');
                }
            });
        }

        if (! Schema::hasTable('rcd_accountable_form_releases')) {
            Schema::create('rcd_accountable_form_releases', function (Blueprint $table) {
                $table->id();
                $table->string('form_type', 80)->index();
                $table->string('serial_no', 100)->nullable()->index();
                $table->string('receipt_no_from', 80)->index();
                $table->string('receipt_no_to', 80)->index();
                $table->unsignedInteger('receipt_count')->default(0);
                $table->string('collector', 150)->index();
                $table->date('released_at')->nullable()->index();
                $table->string('released_by', 150)->nullable();
                $table->string('collector_signed_by', 150)->nullable();
                $table->date('returned_at')->nullable();
                $table->string('returned_to', 150)->nullable();
                $table->string('beginning_balance_from', 80)->nullable();
                $table->string('beginning_balance_to', 80)->nullable();
                $table->string('ending_balance_from', 80)->nullable();
                $table->string('ending_balance_to', 80)->nullable();
                $table->string('status', 40)->default('Released')->index();
                $table->text('remarks')->nullable();
                $table->string('created_by', 150)->nullable();
                $table->string('updated_by', 150)->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('rcd_accountability_snapshots')) {
            Schema::create('rcd_accountability_snapshots', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('rcd_batch_id')->index();
                $table->string('form_type', 80)->nullable();
                $table->unsignedInteger('beginning_qty')->default(0);
                $table->string('beginning_from', 80)->nullable();
                $table->string('beginning_to', 80)->nullable();
                $table->unsignedInteger('receipt_qty')->default(0);
                $table->string('receipt_from', 80)->nullable();
                $table->string('receipt_to', 80)->nullable();
                $table->unsignedInteger('issued_qty')->default(0);
                $table->string('issued_from', 80)->nullable();
                $table->string('issued_to', 80)->nullable();
                $table->unsignedInteger('ending_qty')->default(0);
                $table->string('ending_from', 80)->nullable();
                $table->string('ending_to', 80)->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('rcd_accountability_snapshots');
        Schema::dropIfExists('rcd_accountable_form_releases');
    }
};
