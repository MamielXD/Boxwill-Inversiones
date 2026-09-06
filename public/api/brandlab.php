<?php
require_once 'config.php';

session_start();

// Permitir bypass de sesión si viene con el Token Seguro
// Nota: $_SERVER['HTTP_X_SYSTEM_SECRET'] es el estándar para leer "X-System-Secret"
$systemToken = $_SERVER['HTTP_X_SYSTEM_SECRET'] ?? null;
$isAutomated = ($systemToken === TOKEN_SISTEMA);

if (!$isAutomated && (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true)) {
    http_response_code(401);
    echo json_encode(['error' => 'No autenticado']);
    exit();
}

if ($isAutomated) {
    $_SESSION['user_id'] = 1; // Admin por defecto para scripts
}

header('Content-Type: application/json');

if (!$isAutomated && $_SESSION['user_id'] != 1) {
    http_response_code(403);
    echo json_encode(['error' => 'Acceso denegado a BrandLab. Solo disponible para el administrador.']);
    exit();
}

ensureTables();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        if (isset($_GET['metrics'])) {
            getMetrics();
        } else {
            getMovimientos();
        }
        break;
    case 'POST':
        addMovimiento();
        break;
    case 'DELETE':
        deleteMovimiento();
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}

function ensureTables() {
    global $pdo;
    $pdo->exec("CREATE TABLE IF NOT EXISTS brandlab_movimientos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tipo ENUM('inyeccion','dividendo') NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        fecha DATE NOT NULL,
        notas TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    
    // Ensure account tables exist
    $pdo->exec("CREATE TABLE IF NOT EXISTS cuenta_movimientos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tipo ENUM('deposito','retiro','rendimiento','gasto') NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        fecha DATE NOT NULL,
        notas TEXT NULL,
        inversion_ref VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
}

function getMovimientos() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    try {
        $stmt = $pdo->prepare("SELECT * FROM brandlab_movimientos WHERE user_id = ? ORDER BY fecha DESC, id DESC");
        $stmt->execute([$userId]);
        $movimientos = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($movimientos);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener movimientos: ' . $e->getMessage()]);
    }
}

function getMetrics() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    try {
        // Total Inyectado
        $stmt = $pdo->prepare("SELECT SUM(monto) as total FROM brandlab_movimientos WHERE tipo = 'inyeccion' AND user_id = ?");
        $stmt->execute([$userId]);
        $totalInyectado = floatval($stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

        // Total Dividendos
        $stmt = $pdo->prepare("SELECT SUM(monto) as total FROM brandlab_movimientos WHERE tipo = 'dividendo' AND user_id = ?");
        $stmt->execute([$userId]);
        $totalDividendos = floatval($stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

        // Ganancia Neta = Dividendos - Capital
        $gananciaNeta = $totalDividendos - $totalInyectado;

        // ROI sobre capital inyectado
        $roi = $totalInyectado > 0 ? ($totalDividendos / $totalInyectado) * 100 : 0;

        // MOIC
        $moic = $totalInyectado > 0 ? $totalDividendos / $totalInyectado : 0;

        // Fecha de fundación o primera inyección
        $primeraFecha = '2025-05-18'; 
        
        $eaPercent = 0;
        $diffDays = 0;
        if ($primeraFecha) {
            $inicio = new DateTime($primeraFecha);
            $hoy = new DateTime();
            $diffDays = max(1, $inicio->diff($hoy)->days);
            if ($roi > 0) {
                $eaPercent = (pow(1 + ($roi / 100), 365 / $diffDays) - 1) * 100;
            }
        }

        // Movimientos agrupados por mes
        $stmt = $pdo->prepare("
            SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, tipo, SUM(monto) as total
            FROM brandlab_movimientos
            WHERE user_id = ?
            GROUP BY mes, tipo
            ORDER BY mes ASC
        ");
        $stmt->execute([$userId]);
        $evolucion = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'total_inyectado' => $totalInyectado,
            'total_dividendos' => $totalDividendos,
            'ganancia_neta' => $gananciaNeta,
            'roi' => round($roi, 2),
            'moic' => round($moic, 3),
            'ea_percent' => round($eaPercent, 2),
            'dias_activo' => $diffDays,
            'evolucion' => $evolucion,
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al calcular métricas: ' . $e->getMessage()]);
    }
}

function addMovimiento() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['tipo']) || empty($data['monto']) || !in_array($data['tipo'], ['inyeccion', 'dividendo'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Tipo (inyeccion|dividendo) y monto son obligatorios']);
        return;
    }

    $tipo = $data['tipo'];
    $monto = floatval($data['monto']);
    $fecha = !empty($data['fecha']) ? $data['fecha'] : date('Y-m-d');
    $notas = !empty($data['notas']) ? trim($data['notas']) : null;

    if ($monto <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'El monto debe ser mayor a 0']);
        return;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO brandlab_movimientos (user_id, tipo, monto, fecha, notas) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $tipo, $monto, $fecha, $notas]);

        $id = $pdo->lastInsertId();

        // Sincronizar con cuenta bancaria
        if (!empty($data['registrar_en_cuenta'])) {
            $tipoCuenta = ($tipo === 'inyeccion') ? 'retiro' : 'deposito';
            $stmtAcc = $pdo->prepare("INSERT INTO cuenta_movimientos (user_id, tipo, monto, fecha, inversion_ref, notas) VALUES (?,?,?,?,?,?)");
            $stmtAcc->execute([$userId, $tipoCuenta, $monto, $fecha, 'BrandLab Equity', "Movimiento $tipo: $notas"]);
        }

        $stmt = $pdo->prepare("SELECT * FROM brandlab_movimientos WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        $nuevo = $stmt->fetch(PDO::FETCH_ASSOC);

        http_response_code(201);
        echo json_encode($nuevo);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al agregar movimiento: ' . $e->getMessage()]);
    }
}

function deleteMovimiento() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID requerido']);
        return;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM brandlab_movimientos WHERE id = ? AND user_id = ?");
        $stmt->execute([$data['id'], $userId]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Movimiento no encontrado']);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al eliminar: ' . $e->getMessage()]);
    }
}
?>
