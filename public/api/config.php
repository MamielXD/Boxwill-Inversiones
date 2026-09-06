<?php
// api/config.php
// api/config.php

// Lista de dominios permitidos para CORS con credenciales
$allowed_origins = [
    'http://localhost:4321', 
    'http://25.42.9.31:4321', 
    'http://192.168.101.71:4321',
    'http://inversiones.boxwill.com',
    'https://core.boxwill.com'
];

if (isset($_SERVER['HTTP_ORIGIN']) && in_array($_SERVER['HTTP_ORIGIN'], $allowed_origins)) {
    header("Access-Control-Allow-Origin: " . $_SERVER['HTTP_ORIGIN']);
    header("Access-Control-Allow-Credentials: true");
} else {
    // Fallback seguro si no hay origin o no está permitido
    header("Access-Control-Allow-Origin: null");
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-System-Secret');
header('Content-Type: application/json; charset=utf-8');

// Configuración de sesión persistente (30 días) para apps móviles (PWA)
session_set_cookie_params([
    'lifetime' => 60 * 60 * 24 * 30, // 30 días
    'path' => '/',
    'domain' => '.boxwill.com',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'None'
]);

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Cargar variables de entorno desde el archivo .env en la raíz del proyecto
$env_path = __DIR__ . '/../../.env';
if (file_exists($env_path)) {
    $env_vars = parse_ini_file($env_path);
} else {
    $env_vars = [];
}

// Token de Seguridad para Automatización
define('TOKEN_SISTEMA', $env_vars['TOKEN_SISTEMA'] ?? 'BX_HOLDING_2026_SECRET_KEY');

// Credenciales
define('DB_HOST', $env_vars['DB_HOST'] ?? 'localhost');
define('DB_NAME', $env_vars['DB_NAME'] ?? 'bwinversiones');
define('DB_USER', $env_vars['DB_USER'] ?? 'root');
define('DB_PASS', $env_vars['DB_PASS'] ?? '');

// Conexión con PDO
try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error de conexión a base de datos']);
    exit();
}
?>