<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('cash_ticket_types')) {
            Schema::create('cash_ticket_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120)->unique();
            $table->decimal('unit_value', 12, 2)->default(0);
            $table->string('source_category', 120)->nullable();
            $table->string('account_code', 80)->nullable();
            $table->string('status', 30)->default('active')->index();
            $table->text('description')->nullable();
            $table->timestamps();
            });
        }

        if (! Schema::hasTable('cash_ticket_books')) {
            Schema::create('cash_ticket_books', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cash_ticket_type_id')->nullable()->constrained('cash_ticket_types')->nullOnDelete();
            $table->string('book_no', 80)->nullable()->index();
            $table->string('serial_from', 80)->index();
            $table->string('serial_to', 80)->index();
            $table->string('current_serial', 80)->nullable();
            $table->unsignedInteger('quantity')->default(0);
            $table->decimal('amount_released', 18, 2)->default(0);
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('assigned_to_name', 150)->nullable()->index();
            $table->string('collector_signature', 150)->nullable();
            $table->date('date_issued')->nullable()->index();
            $table->date('date_returned')->nullable();
            $table->string('status', 30)->default('available')->index();
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->unique(['cash_ticket_type_id', 'serial_from', 'serial_to'], 'cash_ticket_book_range_unique');
            });
        }

        if (! Schema::hasTable('cash_ticket_collections')) {
            Schema::create('cash_ticket_collections', function (Blueprint $table) {
            $table->id();
            $table->string('rd_no', 80)->nullable()->index();
            $table->date('collection_date')->index();
            $table->date('remittance_date')->nullable()->index();
            $table->foreignId('collector_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('collector_name', 150)->nullable()->index();
            $table->foreignId('cash_ticket_type_id')->nullable()->constrained('cash_ticket_types')->nullOnDelete();
            $table->string('ticket_type_name', 120)->nullable()->index();
            $table->string('serial_from', 80)->nullable()->index();
            $table->string('serial_to', 80)->nullable()->index();
            $table->unsignedInteger('quantity')->default(0);
            $table->decimal('unit_value', 12, 2)->default(0);
            $table->decimal('amount', 18, 2)->default(0);
            $table->string('source', 80)->default('manual')->index();
            $table->string('status', 30)->default('posted')->index();
            $table->text('remarks')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            });
        }

        if (! Schema::hasTable('cash_ticket_report_rows')) {
            Schema::create('cash_ticket_report_rows', function (Blueprint $table) {
            $table->id();
            $table->string('rd_no', 80)->nullable()->index();
            $table->date('collection_date')->index();
            $table->decimal('amount', 18, 2)->default(0);
            $table->string('source_file', 255)->nullable();
            $table->string('source_sheet', 120)->nullable();
            $table->string('source_cell', 120)->nullable();
            $table->string('status', 30)->default('posted')->index();
            $table->text('remarks')->nullable();
            $table->timestamps();
            });
        }

        if (! Schema::hasTable('cash_ticket_audit_logs')) {
            Schema::create('cash_ticket_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('auditable_type', 120)->nullable();
            $table->unsignedBigInteger('auditable_id')->nullable();
            $table->string('action', 80)->index();
            $table->foreignId('performed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('performed_by_name', 150)->nullable();
            $table->json('details')->nullable();
            $table->timestamps();

            $table->index(['auditable_type', 'auditable_id'], 'cash_ticket_audit_subject_index');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('cash_ticket_audit_logs');
        Schema::dropIfExists('cash_ticket_report_rows');
        Schema::dropIfExists('cash_ticket_collections');
        Schema::dropIfExists('cash_ticket_books');
        Schema::dropIfExists('cash_ticket_types');
    }
};
