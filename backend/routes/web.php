<?php

use Illuminate\Support\Facades\Route;


Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated. Please login again.'], 401);
})->name('login');

Route::get('/', function () {
    return view('welcome');
});
