<?php
// api/auth.php
require_once 'config.php';


session_start();

// Permitir bypass de sesión si viene con el Token Seguro
// Nota: $_SERVER['HTTP_X_SYSTEM_SECRET'] es el estándar para leer "X-System-Secret"
$systemToken = $_SERVER['HTTP_X_SYSTEM_SECRET'] ?? null;
$isAutomated = ($systemToken === TOKEN_SISTEMA);

if ($isAutomated) {
    $_SESSION['authenticated'] = true;
    $_SESSION['user_id'] = 1;
}

// Manejar preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit();
}

ensureTables();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Guardar preferencias si la acción es save_prefs
    if (isset($data['action']) && $data['action'] === 'save_prefs') {
        if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
            http_response_code(401);
            echo json_encode(['error' => 'No autenticado']);
            exit();
        }
        $userId = $_SESSION['user_id'];
        $prefs = json_encode($data['preferencias'] ?? []);
        global $pdo;
        $stmt = $pdo->prepare("UPDATE usuarios SET preferencias = ? WHERE id = ?");
        $stmt->execute([$prefs, $userId]);
        echo json_encode(['success' => true]);
        exit();
    }

    // Login
    if (empty($data['username']) || empty($data['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Usuario y contraseña requeridos']);
        exit();
    }
    
    $username = $data['username'];
    $password = $data['password'];

    global $pdo;
    $stmt = $pdo->prepare("SELECT * FROM usuarios WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['authenticated'] = true;
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user'] = $user['username'];
        $prefs = isset($user['preferencias']) && $user['preferencias'] ? json_decode($user['preferencias'], true) : null;
        echo json_encode(['success' => true, 'message' => 'Autenticado', 'user' => $user['username'], 'preferencias' => $prefs, 'user_id' => $user['id']]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Credenciales incorrectas']);
    }
    
} elseif ($method === 'GET') {
    // Verificar sesión
    if (isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true) {
        $prefs = null;
        try {
            global $pdo;
            $stmt = $pdo->prepare("SELECT preferencias FROM usuarios WHERE id = ?");
            $stmt->execute([$_SESSION['user_id']]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            $prefs = ($user && isset($user['preferencias']) && $user['preferencias']) ? json_decode($user['preferencias'], true) : null;
        } catch (\PDOException $e) {}
        echo json_encode(['authenticated' => true, 'user' => $_SESSION['user'], 'user_id' => $_SESSION['user_id'], 'preferencias' => $prefs]);
    } else {
        http_response_code(401);
        echo json_encode(['authenticated' => false]);
    }
    
} elseif ($method === 'DELETE') {
    // Logout
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Sesión cerrada']);
    
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
}

function ensureTables() {
    global $pdo;
    // 1. Crear tabla usuarios
    $pdo->exec("CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    try { $pdo->exec("ALTER TABLE usuarios ADD COLUMN preferencias TEXT DEFAULT NULL"); } catch (\PDOException $e) {} catch (\Exception $e) {}

    // 2. Crear usuario demo si no existe
    $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE username = 'demo'");
    $stmt->execute();
    $demoUser = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$demoUser) {
        $hash = password_hash('demo', PASSWORD_DEFAULT);
        $pdo->exec("INSERT INTO usuarios (username, password, role) VALUES ('demo', '$hash', 'demo')");
        $demoUserId = $pdo->lastInsertId();
        seedDemoData($demoUserId);
    }
}

function seedDemoData($demoUserId) {
    global $pdo;
    try {
        // Generar datos ficticios básicos para que el panel no luzca vacío
        // Inversiones
        $pdo->prepare("INSERT INTO inversiones (user_id, nombre, monto, categoria, estado, costo_operativo, fecha) VALUES (?, 'Demo Tech Stock', 1500000, 'Acciones en Bolsa', 'activo', 25000, '2023-01-15')")->execute([$demoUserId]);
        $inv1 = $pdo->lastInsertId();
        
        $pdo->prepare("INSERT INTO inversiones (user_id, nombre, monto, categoria, estado, costo_operativo, fecha) VALUES (?, 'Demo Negocio Local', 5000000, 'Equity / Empresas', 'activo', 150000, '2022-06-20')")->execute([$demoUserId]);
        $inv2 = $pdo->lastInsertId();

        // Dividendos para la primera inversión
        $pdo->prepare("INSERT INTO dividendos (inversion_id, user_id, monto, fecha) VALUES (?, ?, 75000, '2023-06-15')")->execute([$inv1, $demoUserId]);
        $pdo->prepare("INSERT INTO dividendos (inversion_id, user_id, monto, fecha) VALUES (?, ?, 85000, '2023-12-15')")->execute([$inv1, $demoUserId]);

        // Préstamos
        $pdo->prepare("INSERT INTO prestamos (user_id, prestatario, monto_original, tasa_mensual, num_cuotas, fecha_inicio, estado) VALUES (?, 'Demo Cliente', 2000000, 5, 12, '2023-05-01', 'activo')")->execute([$demoUserId]);
        $prestamoId = $pdo->lastInsertId();

        // Pagos del préstamo
        $pdo->prepare("INSERT INTO prestamo_pagos (user_id, prestamo_id, monto, fecha) VALUES (?, ?, 260000, '2023-06-01')")->execute([$demoUserId, $prestamoId]);
        $pdo->prepare("INSERT INTO prestamo_pagos (user_id, prestamo_id, monto, fecha) VALUES (?, ?, 260000, '2023-07-01')")->execute([$demoUserId, $prestamoId]);

        // Cuenta (Movimientos)
        $pdo->prepare("INSERT INTO cuenta_movimientos (user_id, tipo, monto, fecha, notas) VALUES (?, 'deposito', 10000000, '2022-01-01', 'Capital Inicial Demo')")->execute([$demoUserId]);
        
    } catch (Exception $e) {
        // Ignorar si las tablas no existen todavía (se crean al visitar los otros endpoints)
    }
}
?>