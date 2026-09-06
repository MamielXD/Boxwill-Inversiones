<?php
require_once 'config.php';

session_start();
if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
    http_response_code(401);
    echo json_encode(['error' => 'No autenticado']);
    exit();
}

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Ensure tables exist
ensureTables();

switch ($method) {
    case 'GET':
        if ($action === 'config') getConfig();
        elseif ($action === 'metrics') getMetrics();
        else getMovimientos();
        break;
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if ($action === 'config') updateConfig($data);
        else addMovimiento($data);
        break;
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        updateMovimiento($data);
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
    $pdo->exec("CREATE TABLE IF NOT EXISTS cuenta_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        nombre_banco VARCHAR(100) DEFAULT 'Cuenta Alto Rendimiento',
        tasa_rendimiento DECIMAL(5,2) DEFAULT 8.00,
        porcentaje_salario DECIMAL(5,2) DEFAULT 0.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");

    try { $pdo->exec("ALTER TABLE cuenta_config ADD COLUMN porcentaje_salario DECIMAL(5,2) DEFAULT 0.00"); } catch (Exception $e) {}

    $pdo->exec("CREATE TABLE IF NOT EXISTS cuenta_movimientos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tipo ENUM('deposito', 'retiro', 'rendimiento', 'gasto', 'nomina', 'ingreso_esperado') NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        fecha DATE NOT NULL,
        inversion_ref VARCHAR(255) NULL,
        notas TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    
    try { $pdo->exec("ALTER TABLE cuenta_movimientos MODIFY COLUMN tipo ENUM('deposito', 'retiro', 'rendimiento', 'gasto', 'nomina', 'ingreso_esperado') NOT NULL"); } catch (Exception $e) {}
}

function getConfig() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM cuenta_config WHERE user_id = ?");
        $stmt->execute([$userId]);
        $config = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$config) {
            $pdo->prepare("INSERT INTO cuenta_config (user_id, nombre_banco, tasa_rendimiento) VALUES (?, 'Cuenta Alto Rendimiento', 8.00)")->execute([$userId]);
            $stmt->execute([$userId]);
            $config = $stmt->fetch(PDO::FETCH_ASSOC);
        }
        echo json_encode($config);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error 500: ' . $e->getMessage()]);
    }
}

function updateConfig($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $nombre = !empty($data['nombre_banco']) ? trim($data['nombre_banco']) : 'Cuenta Alto Rendimiento';
    $tasa = isset($data['tasa_rendimiento']) ? floatval($data['tasa_rendimiento']) : 8.00;
    $salario = isset($data['porcentaje_salario']) ? floatval($data['porcentaje_salario']) : null;

    if ($tasa < 0 || $tasa > 100) {
        http_response_code(400);
        echo json_encode(['error' => 'Tasa debe ser entre 0 y 100']);
        return;
    }

    if ($salario !== null) {
        $stmt = $pdo->prepare("UPDATE cuenta_config SET nombre_banco = ?, tasa_rendimiento = ?, porcentaje_salario = ? WHERE user_id = ?");
        $stmt->execute([$nombre, $tasa, $salario, $userId]);
    } else {
        $stmt = $pdo->prepare("UPDATE cuenta_config SET nombre_banco = ?, tasa_rendimiento = ? WHERE user_id = ?");
        $stmt->execute([$nombre, $tasa, $userId]);
    }
    getConfig();
}

function getMovimientos() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $stmt = $pdo->prepare("SELECT * FROM cuenta_movimientos WHERE user_id = ? ORDER BY fecha DESC, id DESC LIMIT 100");
    $stmt->execute([$userId]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function getMetrics() {
    global $pdo;
    $userId = $_SESSION['user_id'];

    try {
        // Config (Robusto)
        $stmtCfg = $pdo->prepare("SELECT * FROM cuenta_config WHERE user_id = ?");
        $stmtCfg->execute([$userId]);
        $cfg = $stmtCfg->fetch(PDO::FETCH_ASSOC);
        if (!$cfg) {
            $pdo->prepare("INSERT INTO cuenta_config (user_id, nombre_banco, tasa_rendimiento) VALUES (?, 'Cuenta Alto Rendimiento', 8.00)")->execute([$userId]);
            $stmtCfg->execute([$userId]);
            $cfg = $stmtCfg->fetch(PDO::FETCH_ASSOC);
        }
        $tasa = floatval($cfg['tasa_rendimiento'] ?? 8.00);

        // Balance actual = depósitos + rendimientos - (retiros + gastos + nómina)
        // ingreso_esperado NO afecta el saldo hasta que se convierta en deposito
        $stmt = $pdo->prepare("
            SELECT
                SUM(CASE WHEN tipo IN ('deposito','rendimiento') THEN monto ELSE 0 END) -
                SUM(CASE WHEN tipo IN ('retiro','gasto','nomina') THEN monto ELSE 0 END) as saldo,
                SUM(CASE WHEN tipo = 'deposito' THEN monto ELSE 0 END) as total_depositos,
                SUM(CASE WHEN tipo = 'retiro' THEN monto ELSE 0 END) as total_retiros,
                SUM(CASE WHEN tipo = 'rendimiento' THEN monto ELSE 0 END) as total_rendimientos,
                SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END) as total_gastos,
                SUM(CASE WHEN tipo = 'nomina' THEN monto ELSE 0 END) as total_nomina,
                SUM(CASE WHEN tipo = 'ingreso_esperado' THEN monto ELSE 0 END) as total_esperado
            FROM cuenta_movimientos
            WHERE user_id = ?
        ");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        $saldo = floatval($row['saldo'] ?? 0);
        $totalDepositos = floatval($row['total_depositos'] ?? 0);
        $totalRetiros = floatval($row['total_retiros'] ?? 0);
        $totalRendimientos = floatval($row['total_rendimientos'] ?? 0);
        $totalGastos = floatval($row['total_gastos'] ?? 0);
        $totalNomina = floatval($row['total_nomina'] ?? 0);
        $totalEsperado = floatval($row['total_esperado'] ?? 0);

        // Rendimiento proyectado mensual y anual al saldo actual
        $rendimientoMensual = $saldo * ($tasa / 100) / 12;
        $rendimientoAnual = $saldo * ($tasa / 100);
        $porcentaje_salario = floatval($cfg['porcentaje_salario'] ?? 0.00);

        echo json_encode([
            'saldo' => $saldo,
            'total_depositos' => $totalDepositos,
            'total_retiros' => $totalRetiros,
            'total_rendimientos' => $totalRendimientos,
            'total_gastos' => $totalGastos,
            'total_nomina' => $totalNomina,
            'total_esperado' => $totalEsperado,
            'rendimiento_mensual_proyectado' => round($rendimientoMensual, 2),
            'rendimiento_anual_proyectado' => round($rendimientoAnual, 2),
            'tasa_rendimiento' => $tasa,
            'porcentaje_salario' => $porcentaje_salario,
            'nombre_banco' => $cfg['nombre_banco'] ?? 'Cuenta Alto Rendimiento',
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error 500: ' . $e->getMessage()]);
    }
}

function addMovimiento($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];

    $tipos_validos = ['deposito', 'retiro', 'rendimiento', 'gasto', 'nomina', 'ingreso_esperado'];
    if (empty($data['tipo']) || !in_array($data['tipo'], $tipos_validos)) {
        http_response_code(400);
        echo json_encode(['error' => 'Tipo inválido']);
        return;
    }

    $monto = floatval($data['monto'] ?? 0);
    if ($monto <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'El monto debe ser mayor a 0']);
        return;
    }

    $fecha = !empty($data['fecha']) ? $data['fecha'] : date('Y-m-d');
    $notas = !empty($data['notas']) ? trim($data['notas']) : null;
    $ref = !empty($data['inversion_ref']) ? trim($data['inversion_ref']) : null;

    $stmt = $pdo->prepare("INSERT INTO cuenta_movimientos (user_id, tipo, monto, fecha, notas, inversion_ref) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$userId, $data['tipo'], $monto, $fecha, $notas, $ref]);

    $id = $pdo->lastInsertId();
    $stmt = $pdo->prepare("SELECT * FROM cuenta_movimientos WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    http_response_code(201);
    echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
}

function updateMovimiento($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];

    if (empty($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID requerido']);
        return;
    }

    $tipos_validos = ['deposito', 'retiro', 'rendimiento', 'gasto', 'nomina', 'ingreso_esperado'];
    if (!empty($data['tipo']) && !in_array($data['tipo'], $tipos_validos)) {
        http_response_code(400);
        echo json_encode(['error' => 'Tipo inválido']);
        return;
    }

    $fields = [];
    $params = [];

    if (isset($data['tipo'])) { $fields[] = 'tipo = ?'; $params[] = $data['tipo']; }
    if (isset($data['monto'])) { $fields[] = 'monto = ?'; $params[] = floatval($data['monto']); }
    if (isset($data['fecha'])) { $fields[] = 'fecha = ?'; $params[] = $data['fecha']; }
    if (array_key_exists('notas', $data)) { $fields[] = 'notas = ?'; $params[] = $data['notas']; }
    if (array_key_exists('inversion_ref', $data)) { $fields[] = 'inversion_ref = ?'; $params[] = $data['inversion_ref']; }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(['error' => 'No hay campos para actualizar']);
        return;
    }

    $params[] = $data['id'];
    $params[] = $userId;
    $sql = "UPDATE cuenta_movimientos SET " . implode(', ', $fields) . " WHERE id = ? AND user_id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $stmt2 = $pdo->prepare("SELECT * FROM cuenta_movimientos WHERE id = ? AND user_id = ?");
    $stmt2->execute([$data['id'], $userId]);
    echo json_encode($stmt2->fetch(PDO::FETCH_ASSOC));
}

function deleteMovimiento() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $data = json_decode(file_get_contents('php://input'), true);
    if (empty($data['id'])) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); return; }

    $stmt = $pdo->prepare("DELETE FROM cuenta_movimientos WHERE id = ? AND user_id = ?");
    $stmt->execute([$data['id'], $userId]);
    echo json_encode(['success' => $stmt->rowCount() > 0]);
}
?>
