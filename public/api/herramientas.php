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

ensureTables();

switch ($method) {
    case 'GET':
        if ($action === 'metrics') obtenerMetricasHerramientas();
        elseif ($action === 'usos') obtenerUsosItem();
        else obtenerItems();
        break;
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        if ($action === 'reponer') reponerItem($data);
        else agregarItem($data);
        break;
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        actualizarItem($data);
        break;
    case 'DELETE':
        $data = json_decode(file_get_contents('php://input'), true);
        eliminarItem($data);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}

function ensureTables() {
    global $pdo;

    // Se replican por si este endpoint corre antes que inversiones.php/cuenta.php
    $pdo->exec("CREATE TABLE IF NOT EXISTS inversiones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        categoria VARCHAR(100) DEFAULT 'Sin categoría',
        fecha DATE,
        estado ENUM('activo', 'vendido') DEFAULT 'activo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS inversion_gastos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        inversion_id INT NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        concepto VARCHAR(255) NOT NULL,
        fecha DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inversion_id) REFERENCES inversiones(id) ON DELETE CASCADE
    )");

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

    $pdo->exec("CREATE TABLE IF NOT EXISTS inventario_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tipo ENUM('consumible', 'herramienta', 'repuesto') NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        costo_compra DECIMAL(12,2) NOT NULL,
        fecha_compra DATE NOT NULL,
        unidad_medida VARCHAR(30) NULL,
        cantidad_total DECIMAL(12,4) NULL,
        cantidad_restante DECIMAL(12,4) NULL,
        costo_unitario DECIMAL(14,6) NULL,
        estado ENUM('activo', 'agotado', 'dañado', 'perdido') NOT NULL DEFAULT 'activo',
        notas TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    try { $pdo->exec("ALTER TABLE inventario_items MODIFY COLUMN tipo ENUM('consumible', 'herramienta', 'repuesto') NOT NULL"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE inventario_items ADD COLUMN origen_inversion_id INT NULL AFTER user_id"); } catch (Exception $e) {}

    $pdo->exec("CREATE TABLE IF NOT EXISTS inventario_usos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        item_id INT NOT NULL,
        inversion_id INT NULL,
        inversion_gasto_id INT NULL,
        cantidad_usada DECIMAL(12,4) NULL,
        costo_calculado DECIMAL(12,2) NOT NULL DEFAULT 0,
        fecha DATE NOT NULL,
        notas TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES inventario_items(id) ON DELETE CASCADE
    )");

    // Migración: columnas de vínculo en inversion_gastos (si no existen ya)
    try { $pdo->exec("ALTER TABLE inversion_gastos ADD COLUMN item_id INT NULL AFTER inversion_id"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE inversion_gastos ADD COLUMN cantidad_usada DECIMAL(12,4) NULL AFTER item_id"); } catch (Exception $e) {}
}

function obtenerItems() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    try {
        $stmt = $pdo->prepare("SELECT * FROM inventario_items WHERE user_id = ? ORDER BY tipo, estado = 'activo' DESC, nombre ASC");
        $stmt->execute([$userId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as &$item) {
            if (in_array($item['tipo'], ['consumible', 'repuesto']) && floatval($item['cantidad_total']) > 0) {
                $item['porcentaje_restante'] = round((floatval($item['cantidad_restante']) / floatval($item['cantidad_total'])) * 100, 1);
            } else {
                $item['porcentaje_restante'] = null;
            }
        }
        echo json_encode($items);
    } catch (PDOException $e) {
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

function obtenerUsosItem() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $itemId = intval($_GET['item_id'] ?? 0);
    try {
        $stmt = $pdo->prepare("
            SELECT u.*, i.nombre as inversion_nombre
            FROM inventario_usos u
            LEFT JOIN inversiones i ON u.inversion_id = i.id
            WHERE u.item_id = ? AND u.user_id = ?
            ORDER BY u.fecha DESC, u.id DESC
        ");
        $stmt->execute([$itemId, $userId]);
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

function obtenerMetricasHerramientas() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    try {
        $stmt = $pdo->prepare("SELECT SUM(costo_compra) FROM inventario_items WHERE tipo = 'herramienta' AND user_id = ? AND estado != 'perdido'");
        $stmt->execute([$userId]);
        $totalHerramientas = floatval($stmt->fetchColumn() ?? 0);

        $stmt = $pdo->prepare("SELECT SUM(costo_compra) FROM inventario_items WHERE tipo = 'consumible' AND user_id = ?");
        $stmt->execute([$userId]);
        $totalInvertidoConsumibles = floatval($stmt->fetchColumn() ?? 0);

        $stmt = $pdo->prepare("SELECT SUM(cantidad_restante * costo_unitario) FROM inventario_items WHERE tipo = 'repuesto' AND estado = 'activo' AND user_id = ?");
        $stmt->execute([$userId]);
        $valorRepuestos = floatval($stmt->fetchColumn() ?? 0);

        // Valor restante en consumibles activos (lo que aún no se ha "gastado" en reparaciones)
        $stmt = $pdo->prepare("SELECT SUM(cantidad_restante * costo_unitario) FROM inventario_items WHERE tipo = 'consumible' AND estado = 'activo' AND user_id = ?");
        $stmt->execute([$userId]);
        $valorRestanteConsumibles = floatval($stmt->fetchColumn() ?? 0);
        $valorInventarioTotal = $valorRestanteConsumibles + $valorRepuestos + $totalHerramientas;

        // Costo operativo distribuido: lo realmente "consumido" (para no confundir con el retiro completo de caja)
        $stmt = $pdo->prepare("SELECT SUM(costo_calculado) FROM inventario_usos WHERE user_id = ?");
        $stmt->execute([$userId]);
        $costoDistribuidoTotal = floatval($stmt->fetchColumn() ?? 0);

        $stmt = $pdo->prepare("SELECT SUM(costo_calculado) FROM inventario_usos WHERE user_id = ? AND fecha >= DATE_FORMAT(CURDATE(), '%Y-%m-01')");
        $stmt->execute([$userId]);
        $costoDistribuidoMes = floatval($stmt->fetchColumn() ?? 0);

        // Consumibles por agotarse (menos del 20% restante, aún activos)
        $stmt = $pdo->prepare("
            SELECT id, nombre, cantidad_restante, cantidad_total, unidad_medida
            FROM inventario_items
            WHERE tipo = 'consumible' AND estado = 'activo' AND user_id = ?
            AND cantidad_total > 0 AND (cantidad_restante / cantidad_total) < 0.2
            ORDER BY (cantidad_restante / cantidad_total) ASC
        ");
        $stmt->execute([$userId]);
        $porAgotarse = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmt = $pdo->prepare("SELECT COUNT(*) FROM inventario_items WHERE tipo = 'herramienta' AND estado = 'activo' AND user_id = ?");
        $stmt->execute([$userId]);
        $herramientasActivas = intval($stmt->fetchColumn() ?? 0);

        echo json_encode([
            'total_invertido_herramientas' => $totalHerramientas,
            'total_invertido_consumibles' => $totalInvertidoConsumibles,
            'valor_restante_consumibles' => $valorRestanteConsumibles,
            'valor_repuestos' => $valorRepuestos,
            'valor_inventario_total' => $valorInventarioTotal,
            'costo_operativo_distribuido_total' => $costoDistribuidoTotal,
            'costo_operativo_distribuido_mes' => $costoDistribuidoMes,
            'herramientas_activas' => $herramientasActivas,
            'consumibles_por_agotarse' => $porAgotarse,
        ]);
    } catch (PDOException $e) {
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

function agregarItem($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];

    $tipo = $data['tipo'] ?? '';
    if (!in_array($tipo, ['consumible', 'herramienta', 'repuesto'])) {
        http_response_code(400); echo json_encode(['error' => 'Tipo inválido']); return;
    }
    if (empty($data['nombre']) || !isset($data['costo_compra']) || floatval($data['costo_compra']) <= 0) {
        http_response_code(400); echo json_encode(['error' => 'Nombre y costo de compra son obligatorios']); return;
    }

    $nombre = trim($data['nombre']);
    $costoCompra = floatval($data['costo_compra']);
    $fechaCompra = !empty($data['fecha_compra']) ? $data['fecha_compra'] : date('Y-m-d');
    $notas = !empty($data['notas']) ? trim($data['notas']) : null;

    $unidadMedida = null; $cantidadTotal = null; $cantidadRestante = null; $costoUnitario = null;

    if (in_array($tipo, ['consumible', 'repuesto'])) {
        if (empty($data['unidad_medida']) || !isset($data['cantidad_total']) || floatval($data['cantidad_total']) <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Para consumibles y repuestos, unidad de medida y cantidad total son obligatorias']);
            return;
        }
        $unidadMedida = trim($data['unidad_medida']);
        $cantidadTotal = floatval($data['cantidad_total']);
        $cantidadRestante = $cantidadTotal;
        $costoUnitario = $costoCompra / $cantidadTotal;
    }

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("INSERT INTO inventario_items
            (user_id, tipo, nombre, costo_compra, fecha_compra, unidad_medida, cantidad_total, cantidad_restante, costo_unitario, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $tipo, $nombre, $costoCompra, $fechaCompra, $unidadMedida, $cantidadTotal, $cantidadRestante, $costoUnitario, $notas]);
        $itemId = $pdo->lastInsertId();

        // La compra sale de caja; los repuestos se registran como retiro en lugar de gasto operativo.
        if (!empty($data['registrar_en_cuenta'])) {
            $tipoMovimiento = $tipo === 'repuesto' ? 'retiro' : 'gasto';
            $stmtAcc = $pdo->prepare("INSERT INTO cuenta_movimientos (user_id, tipo, monto, fecha, inversion_ref, notas) VALUES (?, ?, ?, ?, ?, ?)");
            $stmtAcc->execute([
                $userId,
                $tipoMovimiento,
                $costoCompra,
                $fechaCompra,
                $nombre,
                $tipoMovimiento === 'retiro'
                    ? 'Retiro por compra de repuesto'
                    : 'Gasto operativo: compra de ' . ($tipo === 'herramienta' ? 'herramienta' : $tipo)
            ]);
        }

        $pdo->commit();

        $stmt = $pdo->prepare("SELECT * FROM inventario_items WHERE id = ? AND user_id = ?");
        $stmt->execute([$itemId, $userId]);
        http_response_code(201);
        echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

// Recargar stock de un consumible (ej: compraste otro tarro de la misma pasta)
function reponerItem($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];

    if (empty($data['id']) || !isset($data['cantidad_agregada']) || !isset($data['costo_compra'])) {
        http_response_code(400); echo json_encode(['error' => 'Faltan datos para reponer stock']); return;
    }

    $id = intval($data['id']);
    $cantidadAgregada = floatval($data['cantidad_agregada']);
    $costoCompra = floatval($data['costo_compra']);
    $fecha = !empty($data['fecha']) ? $data['fecha'] : date('Y-m-d');

    try {
        $stmt = $pdo->prepare("SELECT * FROM inventario_items WHERE id = ? AND user_id = ? AND tipo IN ('consumible', 'repuesto')");
        $stmt->execute([$id, $userId]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$item) { http_response_code(404); echo json_encode(['error' => 'Consumible o repuesto no encontrado']); return; }

        $nuevaCantidadTotal = floatval($item['cantidad_total']) + $cantidadAgregada;
        $nuevoCostoTotalAcumulado = floatval($item['costo_compra']) + $costoCompra;
        $nuevoCostoUnitario = $nuevoCostoTotalAcumulado / $nuevaCantidadTotal; // promedio ponderado
        $nuevaCantidadRestante = floatval($item['cantidad_restante']) + $cantidadAgregada;

        $pdo->beginTransaction();

        $upd = $pdo->prepare("UPDATE inventario_items SET cantidad_total = ?, cantidad_restante = ?, costo_compra = ?, costo_unitario = ?, estado = 'activo' WHERE id = ? AND user_id = ?");
        $upd->execute([$nuevaCantidadTotal, $nuevaCantidadRestante, $nuevoCostoTotalAcumulado, $nuevoCostoUnitario, $id, $userId]);

        if (!empty($data['registrar_en_cuenta'])) {
            $tipoMovimiento = $item['tipo'] === 'repuesto' ? 'retiro' : 'gasto';
            $stmtAcc = $pdo->prepare("INSERT INTO cuenta_movimientos (user_id, tipo, monto, fecha, inversion_ref, notas) VALUES (?, ?, ?, ?, ?, ?)");
            $stmtAcc->execute([
                $userId,
                $tipoMovimiento,
                $costoCompra,
                $fecha,
                $item['nombre'],
                $tipoMovimiento === 'retiro'
                    ? 'Retiro por reposición de repuesto'
                    : 'Gasto operativo: reposición de stock'
            ]);
        }

        $pdo->commit();

        $stmt = $pdo->prepare("SELECT * FROM inventario_items WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

// Edición: solo campos "seguros" (nombre, notas, estado). cantidad/costo se manejan
// con reponer() o no se tocan, para no desincronizar el historial de usos ya registrado.
function actualizarItem($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['id'])) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); return; }

    $fields = []; $params = [];
    foreach (['nombre', 'notas', 'estado'] as $f) {
        if (isset($data[$f])) { $fields[] = "$f = ?"; $params[] = $data[$f] === '' ? null : $data[$f]; }
    }
    if (empty($fields)) { echo json_encode(['error' => 'No hay campos válidos para actualizar']); return; }

    $params[] = intval($data['id']);
    $params[] = $userId;
    try {
        $stmt = $pdo->prepare("UPDATE inventario_items SET " . implode(', ', $fields) . " WHERE id = ? AND user_id = ?");
        $stmt->execute($params);

        $stmt = $pdo->prepare("SELECT * FROM inventario_items WHERE id = ? AND user_id = ?");
        $stmt->execute([intval($data['id']), $userId]);
        echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

function eliminarItem($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['id'])) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); return; }

    // Los inversion_gastos que ya usaron este item quedan con item_id = NULL (ON DELETE SET NULL),
    // así el costo histórico de esa reparación no se pierde.
    $stmt = $pdo->prepare("DELETE FROM inventario_items WHERE id = ? AND user_id = ?");
    $stmt->execute([$data['id'], $userId]);
    echo json_encode(['success' => $stmt->rowCount() > 0]);
}
?>
