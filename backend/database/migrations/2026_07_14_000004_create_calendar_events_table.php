<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('calendar_events')) {
            return;
        }

        Schema::create('calendar_events', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->boolean('all_day')->default(false);
            $table->string('category', 50)->default('Reminder');
            $table->string('color', 20)->default('#2563eb');
            $table->boolean('is_system')->default(false);
            $table->string('holiday_type', 50)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('start_at');
            $table->index('end_at');
            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_events');
    }
};
