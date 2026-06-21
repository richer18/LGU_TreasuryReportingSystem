<?php
require __DIR__ . '/../backend/vendor/autoload.php';
use PhpOffice\PhpWord\TemplateProcessor;

// --- Database connection ---
$servername = "127.0.0.1";
$username = "root";
$password = "";
$dbname = "business_permit_license";

$conn = new mysqli($servername, $username, $password, $dbname);
if ($conn->connect_error) {
    die("Database connection failed: " . $conn->connect_error);
}

// --- Get record ID from URL ---
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;
if ($id <= 0) {
    die("Invalid record ID.");
}

// --- Fetch record from database ---
$sql = "SELECT * FROM bplo_records WHERE ID = $id";
$result = $conn->query($sql);
if ($result->num_rows == 0) {
    die("Record not found.");
}
$data = $result->fetch_assoc();

// --- Helper function for ordinal suffix ---
function getOrdinalSuffix($number) {
    if (!in_array(($number % 100), [11, 12, 13])) {
        switch ($number % 10) {
            case 1: return "ST";
            case 2: return "ND";
            case 3: return "RD";
        }
    }
    return "TH";
}

// --- Assign variables ---
$operator_name   = strtoupper(trim($data['FNAME'] . " " . $data['MNAME'] . " " . $data['LNAME']));
$franchise_no    = $data['FRANCHISE_NO'];
$mch_no          = $data['MCH_NO'];
$barangay        = strtoupper($data['BARANGAY']);
$make            = strtoupper($data['MAKE']);
$motor_no        = strtoupper($data['MOTOR_NO']);
$chassis_no      = strtoupper($data['CHASSIS_NO']);
$date_pay        = date("F j, Y", strtotime($data['PAYMENT_DATE'] ?? date("Y-m-d")));
$date_pay2       = $date_pay;
$date_renewed_from = date("F j, Y", strtotime($data['RENEW_FROM'] ?? date("Y-m-d")));
$date_renewed_to   = date("F j, Y", strtotime($data['RENEW_TO'] ?? date("Y-m-d")));

// --- Extract date parts for placeholders ---
$date = new DateTime($date_pay);
$day = $date->format('j');
$month = strtoupper($date->format('F'));
$year = $date->format('Y');
$suffix = getOrdinalSuffix($day);

// --- Load Word template ---
$templatePath = __DIR__ . '/../template/ORDER_TEMPLATE.docx';
if (!file_exists($templatePath)) {
    die("Template file not found: $templatePath");
}

$template = new TemplateProcessor($templatePath);

// --- Replace placeholders in template ---
// 📌 Make sure your Word template has these placeholders like ${operator_name}, ${franchise_no}, etc.
$template->setValue('operator_name', $operator_name);
$template->setValue('franchise_no', $franchise_no);
$template->setValue('mch_no', $mch_no);
$template->setValue('barangay', $barangay);
$template->setValue('make', $make);
$template->setValue('motor_no', $motor_no);
$template->setValue('chassis_no', $chassis_no);
$template->setValue('date_pay', $date_pay);
$template->setValue('date_renewed_from', $date_renewed_from);
$template->setValue('date_renewed_to', $date_renewed_to);

// --- Generate output filename ---
$clean_name = preg_replace('/[^A-Za-z0-9_\-]/', '_', $operator_name);
$timestamp = date("Ymd_His");
$outputDir = __DIR__ . "/$clean_name/Order_$id";
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0777, true);
}

$outputFile = "$outputDir/{$clean_name}_Order_{$mch_no}_{$timestamp}.docx";
$template->saveAs($outputFile);

// --- Force download ---
header("Content-Description: File Transfer");
header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
header('Content-Disposition: attachment; filename="' . basename($outputFile) . '"');
header('Content-Length: ' . filesize($outputFile));
readfile($outputFile);
exit;
?>
