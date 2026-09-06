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
    // Login
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (empty($data['username']) || empty($data['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Usuario y contraseña requeridos']);
        exit();
    }
    
    $username = $data['username'];
    $password = $data['password'];

    global $pdo;
    $stmt = $pdo->prepare("SELECT id, username, password FROM usuarios WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['authenticated'] = true;
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user'] = $user['username'];
        echo json_encode(['success' => true, 'message' => 'Autenticado', 'user' => $user['username']]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Credenciales incorrectas']);
    }
    
} elseif ($method === 'GET') {
    // Verificar sesión
    if (isset($_SESSION['authenticated']) && $_SESSION['authenticated'] === true) {
        echo json_encode(['authenticated' => true, 'user' => $_SESSION['user'], 'user_id' => $_SESSION['user_id']]);
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
}
?>