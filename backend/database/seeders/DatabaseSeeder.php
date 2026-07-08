<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $accounts = [
            [
                'name' => 'LGU Treasury Admin',
                'email' => 'admin@zamboanguita.local',
                'password' => 'admin123',
                'role' => 'admin',
            ],
            [
                'name' => 'Municipal Treasurer',
                'email' => 'treasurer@zamboanguita.local',
                'password' => 'treasurer123',
                'role' => 'treasurer',
            ],
            [
                'name' => 'Cashier Account',
                'email' => 'cashier@zamboanguita.local',
                'password' => 'cashier123',
                'role' => 'cashier',
            ],
            [
                'name' => 'Collector Account',
                'email' => 'collector@zamboanguita.local',
                'password' => 'collector123',
                'role' => 'collector',
            ],
            [
                'name' => 'Viewer Account',
                'email' => 'viewer@zamboanguita.local',
                'password' => 'viewer123',
                'role' => 'viewer',
            ],
        ];

        foreach ($accounts as $account) {
            $user = User::query()->firstOrNew(['email' => $account['email']]);

            $user->fill([
                'name' => $user->exists ? $user->name : $account['name'],
                'role' => $account['role'],
                'account_status' => 'active',
            ]);

            if (! $user->exists) {
                $user->password = Hash::make($account['password']);
            }

            $user->save();
        }
    }
}
