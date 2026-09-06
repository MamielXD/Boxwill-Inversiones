<?php
require_once 'config.php';

session_start();
if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
    http_response_code(401);
    echo json_encode(['error' => 'No autenticado']);
    exit();
}

ensureTables();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        if (isset($_GET['metrics'])) { obtenerMetricas(); } 
        elseif (isset($_GET['gastos'])) { obtenerGastosInversion(); }
        elseif (($_GET['action'] ?? '') === 'componentes') { obtenerComponentes(); }
        else { obtenerInversiones(); }
        break;
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        $action = $_GET['action'] ?? $data['action'] ?? '';
        if ($action === 'dividendo' || $action === 'add_dividendo') {
            agregarDividendo($data);
        } elseif ($action === 'add_gasto') {
            agregarGastoInversion($data);
        } elseif ($action === 'actualizar_gasto') {
            actualizarGastoInversion($data);
        } elseif ($action === 'crear_despiece') {
            crearDespiece($data);
        } elseif ($action === 'resolver_componente') {
            resolverComponente($data);
        } else {
            agregarInversion($data);
        }
        break;
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        actualizarInversion($data);
        break;
    case 'DELETE':
        $data = json_decode(file_get_contents('php://input'), true);
        $action = $_GET['action'] ?? $data['action'] ?? '';
        if ($action === 'delete_dividendo') {
            eliminarDividendo($data);
        } elseif ($action === 'delete_gasto') {
            eliminarGastoInversion($data);
        } else {
            eliminarInversion($data);
        }
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}

function ensureTables() {
    global $pdo;
    $pdo->exec("CREATE TABLE IF NOT EXISTS inversiones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        categoria VARCHAR(100) DEFAULT 'Sin categoría',
        fecha DATE,
        valor_actual DECIMAL(12,2) DEFAULT NULL,
        costo_operativo DECIMAL(12,2) DEFAULT 0,
        costo_operativo_venta DECIMAL(12,2) DEFAULT 0,
        precio_venta DECIMAL(12,2) DEFAULT NULL,
        fecha_venta DATE DEFAULT NULL,
        estado ENUM('activo', 'vendido') DEFAULT 'activo',
        notas TEXT,
        cantidad DECIMAL(12,4) DEFAULT NULL,
        precio_unitario DECIMAL(12,2) DEFAULT NULL,
        valor_actual_unitario DECIMAL(12,2) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    // Migration: add costo_operativo_venta column if missing
    try { $pdo->exec("ALTER TABLE inversiones ADD COLUMN costo_operativo_venta DECIMAL(12,2) DEFAULT 0 AFTER costo_operativo"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE inversiones ADD COLUMN despiece TINYINT(1) NOT NULL DEFAULT 0 AFTER estado"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE inversiones ADD COLUMN valor_transferido DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER precio_venta"); } catch (Exception $e) {}

    $pdo->exec("CREATE TABLE IF NOT EXISTS inversion_componentes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        inversion_id INT NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        costo_asignado DECIMAL(12,2) NOT NULL,
        valor_estimado DECIMAL(12,2) NULL,
        estado ENUM('pendiente', 'vendido', 'retenido', 'perdido') NOT NULL DEFAULT 'pendiente',
        precio_venta DECIMAL(12,2) NULL,
        fecha_resolucion DATE NULL,
        notas TEXT NULL,
        inventario_item_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inversion_id) REFERENCES inversiones(id) ON DELETE CASCADE
    )");
    try { $pdo->exec("ALTER TABLE inversion_componentes ADD COLUMN inventario_item_id INT NULL AFTER notas"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE inversion_componentes ADD COLUMN cantidad DECIMAL(12,4) DEFAULT 1 AFTER costo_asignado"); } catch (Exception $e) {}
    
    $pdo->exec("CREATE TABLE IF NOT EXISTS dividendos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        inversion_id INT NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        fecha DATE,
        notas TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inversion_id) REFERENCES inversiones(id) ON DELETE CASCADE
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
    try { $pdo->exec("ALTER TABLE cuenta_movimientos MODIFY COLUMN tipo ENUM('deposito', 'retiro', 'rendimiento', 'gasto', 'nomina', 'ingreso_esperado') NOT NULL"); } catch (Exception $e) {}

    // Módulo de Herramientas/Consumibles
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

    try { $pdo->exec("ALTER TABLE inversion_gastos ADD COLUMN item_id INT NULL AFTER inversion_id"); } catch (Exception $e) {}
    try { $pdo->exec("ALTER TABLE inversion_gastos ADD COLUMN cantidad_usada DECIMAL(12,4) NULL AFTER item_id"); } catch (Exception $e) {}
}

function obtenerInversiones() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    try {
        $stmt = $pdo->prepare("SELECT i.*, 
            (SELECT SUM(monto) FROM dividendos d WHERE d.inversion_id = i.id) as total_dividendos,
            (SELECT SUM(monto) FROM inversion_gastos g WHERE g.inversion_id = i.id) as total_gastos_detallados,
            (SELECT GROUP_CONCAT(concepto SEPARATOR ', ') FROM inversion_gastos g WHERE g.inversion_id = i.id) as conceptos_gastos
            ,(SELECT COUNT(*) FROM inversion_componentes c WHERE c.inversion_id = i.id) as total_componentes
            ,(SELECT COUNT(*) FROM inversion_componentes c WHERE c.inversion_id = i.id AND c.estado = 'pendiente') as componentes_pendientes
            FROM inversiones i 
            WHERE i.user_id = ?
            ORDER BY i.fecha DESC, i.id DESC");
        $stmt->execute([$userId]);
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function obtenerMetricas() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    try {
        // Gastos detallados por estado (Filtrar por user_id)
        $stmtGAct = $pdo->prepare("SELECT SUM(g.monto) FROM inversion_gastos g JOIN inversiones i ON g.inversion_id = i.id WHERE i.estado = 'activo' AND i.user_id = ?");
        $stmtGAct->execute([$userId]);
        $gastosDetActivos = floatval($stmtGAct->fetchColumn() ?? 0);
        
        $stmtGVen = $pdo->prepare("SELECT SUM(g.monto) FROM inversion_gastos g JOIN inversiones i ON g.inversion_id = i.id WHERE i.estado = 'vendido' AND i.user_id = ?");
        $stmtGVen->execute([$userId]);
        $gastosDetVendidos = floatval($stmtGVen->fetchColumn() ?? 0);

        // Capital Vivo (Monto base + Costo compra + Gastos detallados) - costo_operativo_venta no aplica para activos
        $stmt = $pdo->prepare("SELECT SUM(monto + COALESCE(costo_operativo, 0)) as total FROM inversiones WHERE estado = 'activo' AND user_id = ?");
        $stmt->execute([$userId]);
        $capitalVivo = floatval($stmt->fetch()['total'] ?? 0) + $gastosDetActivos;

        // Valor Actual Vivo
        $stmt = $pdo->prepare("SELECT SUM(COALESCE(valor_actual, monto + COALESCE(costo_operativo, 0))) as total FROM inversiones WHERE estado = 'activo' AND user_id = ?");
        $stmt->execute([$userId]);
        $valorActualVivo = floatval($stmt->fetch()['total'] ?? 0) + $gastosDetActivos;
        
        // Ganancia en Ventas (costo total = monto + costo_op_compra + costo_op_venta + gastos det.)
        $stmt = $pdo->prepare("SELECT SUM(precio_venta) as v, SUM(monto + COALESCE(costo_operativo, 0) + COALESCE(costo_operativo_venta, 0) - COALESCE(valor_transferido, 0)) as c FROM inversiones WHERE estado = 'vendido' AND user_id = ?");
        $stmt->execute([$userId]);
        $ventas = $stmt->fetch();
        $ventasTotales = floatval($ventas['v'] ?? 0);
        $gananciaVentas = $ventasTotales - (floatval($ventas['c'] ?? 0) + $gastosDetVendidos);

        // Ganancia en Ventas, filtrada SOLO a categoría 'Acciones en Bolsa' (para la card de portafolio bursátil)
        $stmtGastosDetBolsaVen = $pdo->prepare("SELECT SUM(g.monto) FROM inversion_gastos g JOIN inversiones i ON g.inversion_id = i.id WHERE i.estado = 'vendido' AND i.categoria = 'Acciones en Bolsa' AND i.user_id = ?");
        $stmtGastosDetBolsaVen->execute([$userId]);
        $gastosDetBolsaVendidos = floatval($stmtGastosDetBolsaVen->fetchColumn() ?? 0);

        $stmtBolsa = $pdo->prepare("SELECT SUM(precio_venta) as v, SUM(monto + COALESCE(costo_operativo, 0) + COALESCE(costo_operativo_venta, 0)) as c FROM inversiones WHERE estado = 'vendido' AND categoria = 'Acciones en Bolsa' AND user_id = ?");
        $stmtBolsa->execute([$userId]);
        $ventasBolsa = $stmtBolsa->fetch();
        $gananciaVentasBolsa = floatval($ventasBolsa['v'] ?? 0) - (floatval($ventasBolsa['c'] ?? 0) + $gastosDetBolsaVendidos);

        $stmt = $pdo->prepare("SELECT SUM(monto) as total FROM dividendos WHERE user_id = ?");
        $stmt->execute([$userId]);
        $totalDiv = floatval($stmt->fetch()['total'] ?? 0);

        // Dividendos SOLO de inversiones con categoría 'Acciones en Bolsa'
        $stmtDivBolsa = $pdo->prepare("
            SELECT SUM(d.monto) FROM dividendos d
            JOIN inversiones i ON d.inversion_id = i.id
            WHERE i.categoria = 'Acciones en Bolsa' AND d.user_id = ?
        ");
        $stmtDivBolsa->execute([$userId]);
        $totalDivBolsa = floatval($stmtDivBolsa->fetchColumn() ?? 0);

        $gananciaAccionesBolsa = $gananciaVentasBolsa + $totalDivBolsa;

        // Rendimientos registrados en la cuenta bancaria
        $totalRendimientosCuenta = 0;
        try {
            $stmtR = $pdo->prepare("SELECT COALESCE(SUM(monto), 0) FROM cuenta_movimientos WHERE tipo = 'rendimiento' AND user_id = ?");
            $stmtR->execute([$userId]);
            $totalRendimientosCuenta = floatval($stmtR->fetchColumn() ?? 0);
        } catch (PDOException $e) { $totalRendimientosCuenta = 0; }
        
        // Gastos operativos generales desde la cuenta bancaria
        $totalGastos = 0;
        $totalNominaGlobal = 0;
        $totalEsperado = 0;
        try {
            $stmtG = $pdo->prepare("SELECT 
                SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END) as total_gastos,
                SUM(CASE WHEN tipo = 'nomina' THEN monto ELSE 0 END) as total_nomina,
                SUM(CASE WHEN tipo = 'ingreso_esperado' THEN monto ELSE 0 END) as total_esperado
                FROM cuenta_movimientos WHERE user_id = ?");
            $stmtG->execute([$userId]);
            $movs = $stmtG->fetch(PDO::FETCH_ASSOC);
            $totalGastos = floatval($movs['total_gastos'] ?? 0);
            $totalNominaGlobal = floatval($movs['total_nomina'] ?? 0);
            $totalEsperado = floatval($movs['total_esperado'] ?? 0);
        } catch (PDOException $e) { $totalGastos = 0; $totalEsperado = 0; $totalNominaGlobal = 0; }
        
        $gananciaLiquida = ($gananciaVentas + $totalDiv + $totalRendimientosCuenta) - ($totalGastos + $totalNominaGlobal);
        // Inventario disponible: consumibles, repuestos retenidos y herramientas activas.
        $valorInventario = 0;
        try {
            $stmtInv = $pdo->prepare("SELECT COALESCE(SUM(CASE WHEN tipo = 'herramienta' THEN costo_compra ELSE cantidad_restante * costo_unitario END), 0) FROM inventario_items WHERE user_id = ? AND estado = 'activo'");
            $stmtInv->execute([$userId]);
            $valorInventario = floatval($stmtInv->fetchColumn() ?? 0);
        } catch (PDOException $e) { $valorInventario = 0; }
        
        // --- Ganancias del mes actual (NÓMINA) ---
        $stmtVenMes = $pdo->prepare("
            SELECT SUM(
                precio_venta - (
                    monto + COALESCE(costo_operativo, 0) + COALESCE(costo_operativo_venta, 0) - COALESCE(valor_transferido, 0) +
                    COALESCE((SELECT SUM(monto) FROM inversion_gastos WHERE inversion_id = i.id), 0)
                )
            ) as ganancia
            FROM inversiones i
            WHERE estado = 'vendido' 
            AND user_id = ? 
            AND DATE_FORMAT(fecha_venta, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m')
        ");
        $stmtVenMes->execute([$userId]);
        $gananciaVentasMes = floatval($stmtVenMes->fetchColumn() ?? 0);

        $stmtDivMes = $pdo->prepare("
            SELECT SUM(monto) 
            FROM dividendos 
            WHERE user_id = ? 
            AND DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m')
        ");
        $stmtDivMes->execute([$userId]);
        $dividendosMes = floatval($stmtDivMes->fetchColumn() ?? 0);

        $stmtRendMes = $pdo->prepare("
            SELECT SUM(monto) 
            FROM cuenta_movimientos 
            WHERE user_id = ? 
            AND tipo = 'rendimiento'
            AND DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m')
        ");
        $stmtRendMes->execute([$userId]);
        $rendimientosBancoMes = floatval($stmtRendMes->fetchColumn() ?? 0);

        $stmtGastosMes = $pdo->prepare("
            SELECT COALESCE(SUM(monto), 0) FROM cuenta_movimientos 
            WHERE tipo = 'gasto' 
            AND user_id = ? 
            AND DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m')
        ");
        $stmtGastosMes->execute([$userId]);
        $gastosMes = floatval($stmtGastosMes->fetchColumn() ?? 0);

        $stmtNominaMes = $pdo->prepare("
            SELECT SUM(monto) 
            FROM cuenta_movimientos 
            WHERE user_id = ? 
            AND tipo = 'nomina'
            AND DATE_FORMAT(fecha, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m')
        ");
        $stmtNominaMes->execute([$userId]);
        $nominaYaPagadaMes = floatval($stmtNominaMes->fetchColumn() ?? 0);

        $gananciaBrutaMes = $gananciaVentasMes + $dividendosMes + $rendimientosBancoMes;
        $gananciaNetaMes = $gananciaBrutaMes - $gastosMes;

        // Distribución Histórica (Incluyendo Gastos Detallados)
        $stmt = $pdo->prepare("
            SELECT categoria, SUM(total) as total 
            FROM (
                SELECT categoria, (monto + COALESCE(costo_operativo, 0) + COALESCE(costo_operativo_venta, 0)) as total 
                FROM inversiones 
                WHERE user_id = ?
                UNION ALL
                SELECT i.categoria, ig.monto as total 
                FROM inversion_gastos ig
                JOIN inversiones i ON ig.inversion_id = i.id
                WHERE ig.user_id = ?
            ) t 
            GROUP BY categoria
        ");
        $stmt->execute([$userId, $userId]);
        $distribucion = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Distribución Activa (Incluyendo Gastos Detallados)
        $stmtA = $pdo->prepare("
            SELECT categoria, SUM(total) as total 
            FROM (
                SELECT categoria, (monto + COALESCE(costo_operativo, 0)) as total 
                FROM inversiones 
                WHERE user_id = ? AND estado = 'activo'
                UNION ALL
                SELECT i.categoria, ig.monto as total 
                FROM inversion_gastos ig
                JOIN inversiones i ON ig.inversion_id = i.id
                WHERE ig.user_id = ? AND i.estado = 'activo'
            ) t 
            GROUP BY categoria
        ");
        $stmtA->execute([$userId, $userId]);
        $distribucionActiva = $stmtA->fetchAll(PDO::FETCH_ASSOC);

        // Evolución Histórica (Incluyendo Gastos Detallados)
        $stmt = $pdo->prepare("
            SELECT mes, SUM(total) as total 
            FROM (
                SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, (monto + COALESCE(costo_operativo, 0) + COALESCE(costo_operativo_venta, 0)) as total 
                FROM inversiones 
                WHERE user_id = ?
                UNION ALL
                SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, monto as total 
                FROM inversion_gastos 
                WHERE user_id = ?
            ) t 
            GROUP BY mes 
            ORDER BY mes ASC
        ");
        $stmt->execute([$userId, $userId]);
        $evolucion = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Evolución Activa (Solo de inversiones actuales)
        $stmtA2 = $pdo->prepare("
            SELECT mes, SUM(total) as total 
            FROM (
                SELECT DATE_FORMAT(fecha, '%Y-%m') as mes, (monto + COALESCE(costo_operativo, 0)) as total 
                FROM inversiones 
                WHERE user_id = ? AND estado = 'activo'
                UNION ALL
                SELECT DATE_FORMAT(ig.fecha, '%Y-%m') as mes, ig.monto as total 
                FROM inversion_gastos ig
                JOIN inversiones i ON ig.inversion_id = i.id
                WHERE ig.user_id = ? AND i.estado = 'activo'
            ) t 
            GROUP BY mes 
            ORDER BY mes ASC
        ");
        $stmtA2->execute([$userId, $userId]);
        $evolucionActiva = $stmtA2->fetchAll(PDO::FETCH_ASSOC);

        // Costo histórico total (Para ROI global)
        $stmtC = $pdo->prepare("SELECT SUM(monto + COALESCE(costo_operativo, 0) + COALESCE(costo_operativo_venta, 0) - COALESCE(valor_transferido, 0)) as total FROM inversiones WHERE user_id = ?");
        $stmtC->execute([$userId]);
        // Sumamos también todos los gastos detallados (activos y vendidos)
        $stmtGD = $pdo->prepare("SELECT SUM(monto) FROM inversion_gastos WHERE user_id = ?");
        $stmtGD->execute([$userId]);
        $costoHistorico = floatval($stmtC->fetchColumn() ?? 0) + floatval($stmtGD->fetchColumn() ?? 0);
        
        // Costo de solo los vendidos (para capital recuperado)
        $stmtCV = $pdo->prepare("SELECT SUM(monto + COALESCE(costo_operativo, 0) + COALESCE(costo_operativo_venta, 0) - COALESCE(valor_transferido, 0)) as total FROM inversiones WHERE estado = 'vendido' AND user_id = ?");
        $stmtCV->execute([$userId]);
        $costoVendidos = floatval($stmtCV->fetchColumn() ?? 0) + $gastosDetVendidos;

        echo json_encode([
            'capital_vivo' => $capitalVivo,
            'valor_actual_vivo' => $valorActualVivo,
            'ganancia_liquida' => $gananciaLiquida,
            'total_dividendos' => $totalDiv,
            'total_rendimientos_cuenta' => $totalRendimientosCuenta,
            'total_gastos_banco' => $totalGastos,
            'total_nomina' => $totalNominaGlobal,
            'total_recuperado' => $ventasTotales + $totalDiv + $totalRendimientosCuenta,
            'roi_mensual_actual' => $gananciaNetaMes / ($gananciaBrutaMes > 0 ? $gananciaBrutaMes : 1) * 100,
            // Métricas exclusivas del portafolio de bolsa (categoría 'Acciones en Bolsa')
            'ganancia_ventas_acciones_bolsa' => $gananciaVentasBolsa,
            'dividendos_acciones_bolsa' => $totalDivBolsa,
            'ganancia_acciones_bolsa' => $gananciaAccionesBolsa,
            'distribucion' => $distribucion,
            'distribucion_activa' => $distribucionActiva,
            'evolucion' => $evolucion,
            'evolucion_activa' => $evolucionActiva,
            'costo_vendidos' => $costoVendidos,
            'costo_historico' => $costoHistorico,
            'roi_real' => $costoHistorico > 0 ? ($gananciaLiquida / $costoHistorico) * 100 : 0,
            // Nuevas métricas para nómina mensual e ingresos esperados
            'ganancia_bruta_mes' => $gananciaBrutaMes,
            'ganancia_neta_mes' => $gananciaNetaMes,
            'gastos_mes' => $gastosMes,
            'nomina_ya_pagada_mes' => $nominaYaPagadaMes,
            'total_esperado' => $totalEsperado
            ,'valor_inventario' => $valorInventario
        ]);
    } catch (PDOException $e) { http_response_code(500); echo json_encode(['error' => $e->getMessage()]); }
}

function agregarInversion($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['nombre']) || (empty($data['monto']) && (empty($data['cantidad']) || empty($data['precio_unitario'])))) {
        http_response_code(400); echo json_encode(['error' => 'Nombre y monto (o cantidad + precio unitario) son obligatorios']); return;
    }
    
    $monto = floatval($data['monto']);
    $costoOp = isset($data['costo_operativo']) ? floatval($data['costo_operativo']) : 0;
    // Si se especifican cantidad y precio unitario, el costo total es autoritativo
    if (!empty($data['cantidad']) && !empty($data['precio_unitario'])) {
        $monto = floatval($data['cantidad']) * floatval($data['precio_unitario']);
    }
    $totalRequerido = $monto + $costoOp;

    try {
        $stmtSaldo = $pdo->prepare("
            SELECT
                SUM(CASE WHEN tipo IN ('deposito','rendimiento') THEN monto ELSE 0 END) -
                SUM(CASE WHEN tipo IN ('retiro','gasto','nomina') THEN monto ELSE 0 END) as saldo
            FROM cuenta_movimientos
            WHERE user_id = ?
        ");
        $stmtSaldo->execute([$userId]);
        $saldo = floatval($stmtSaldo->fetchColumn() ?? 0);

        if ($saldo < $totalRequerido) {
            http_response_code(400);
            echo json_encode(['error' => "Fondos insuficientes en Cuenta Bancaria. Saldo disponible: $" . number_format($saldo, 2, ',', '.')]);
            return;
        }

        $stmt = $pdo->prepare("INSERT INTO inversiones (user_id, nombre, monto, categoria, fecha, valor_actual, notas, costo_operativo, precio_venta, estado, fecha_venta, cantidad, precio_unitario, valor_actual_unitario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $fecha = $data['fecha'] ?? date('Y-m-d');
        $stmt->execute([
            $userId, $data['nombre'], $monto, $data['categoria'] ?? 'Sin categoría', $fecha,
            isset($data['valor_actual']) ? floatval($data['valor_actual']) : null,
            $data['notas'] ?? null,
            $costoOp,
            isset($data['precio_venta']) ? floatval($data['precio_venta']) : null,
            $data['estado'] ?? 'activo',
            $data['fecha_venta'] ?? null,
            isset($data['cantidad']) ? floatval($data['cantidad']) : null,
            isset($data['precio_unitario']) ? floatval($data['precio_unitario']) : null,
            isset($data['valor_actual_unitario']) ? floatval($data['valor_actual_unitario']) : null
        ]);
        
        $nuevoId = $pdo->lastInsertId();

        // Descontar desde cuenta de banco
        $stmtD = $pdo->prepare("INSERT INTO cuenta_movimientos (user_id, tipo, monto, fecha, inversion_ref, notas) VALUES (?, 'retiro', ?, ?, ?, ?)");
        $stmtD->execute([$userId, $totalRequerido, $fecha, $data['nombre'], 'Compra Inversión (+ Costos Op)']);

        $stmt = $pdo->prepare("SELECT i.*, 0 as total_dividendos FROM inversiones i WHERE i.id = ? AND i.user_id = ?");
        $stmt->execute([$nuevoId, $userId]);
        echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

function actualizarInversion($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['id'])) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); return; }
    
    $id = intval($data['id']);

    try {
        $invQuery = $pdo->prepare("SELECT nombre, estado, despiece FROM inversiones WHERE id = ? AND user_id = ?");
        $invQuery->execute([$id, $userId]);
        $invOld = $invQuery->fetch(PDO::FETCH_ASSOC);
        if (!$invOld) { http_response_code(404); echo json_encode(['error' => 'Inversión no encontrada']); return; }
        if ($invOld['despiece'] && ($data['estado'] ?? '') === 'vendido') { http_response_code(400); echo json_encode(['error' => 'Este lote se completa automáticamente cuando resuelvas todas sus piezas.']); return; }

        $params = [];
        $sets = [];
        $fields = ['nombre', 'monto', 'categoria', 'fecha', 'valor_actual', 'notas', 'costo_operativo', 'costo_operativo_venta', 'precio_venta', 'estado', 'fecha_venta', 'cantidad', 'precio_unitario', 'valor_actual_unitario'];
        foreach ($fields as $f) {
            if (isset($data[$f])) {
                $sets[] = "$f = ?";
                $params[] = $data[$f] === '' ? null : $data[$f];
            }
        }
        // Si se envían cantidad y precio_unitario, recalcular monto autoritativamente
        if (isset($data['cantidad']) && isset($data['precio_unitario']) && $data['cantidad'] !== '' && $data['precio_unitario'] !== '') {
            $montoCalc = floatval($data['cantidad']) * floatval($data['precio_unitario']);
            $sets[] = "monto = ?";
            $params[] = $montoCalc;
        }
        if (empty($sets)) { echo json_encode(['error' => 'No hay campos para actualizar']); return; }
        
        $sql = "UPDATE inversiones SET " . implode(', ', $sets) . " WHERE id = ? AND user_id = ?";
        $params[] = $id;
        $params[] = $userId;
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        
        $stmt = $pdo->prepare("SELECT i.*, (SELECT SUM(monto) FROM dividendos d WHERE d.inversion_id = i.id) as total_dividendos FROM inversiones i WHERE i.id = ? AND i.user_id = ?");
        $stmt->execute([$id, $userId]);
        echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

function eliminarInversion($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['id'])) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); return; }

    try {
        $pdo->beginTransaction();

        // Devolver al inventario cualquier consumible que esta inversión haya usado
        $stmt = $pdo->prepare("SELECT item_id, cantidad_usada FROM inversion_gastos WHERE inversion_id = ? AND user_id = ? AND item_id IS NOT NULL AND cantidad_usada IS NOT NULL");
        $stmt->execute([$data['id'], $userId]);
        $gastosConItem = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($gastosConItem as $g) {
            $upd = $pdo->prepare("UPDATE inventario_items SET cantidad_restante = cantidad_restante + ?, estado = 'activo' WHERE id = ? AND user_id = ?");
            $upd->execute([floatval($g['cantidad_usada']), $g['item_id'], $userId]);
        }

        $pdo->prepare("DELETE FROM dividendos WHERE inversion_id = ? AND user_id = ?")->execute([$data['id'], $userId]);
        $pdo->prepare("DELETE FROM inventario_usos WHERE inversion_id = ? AND user_id = ?")->execute([$data['id'], $userId]);
        $pdo->prepare("DELETE FROM inversion_componentes WHERE inversion_id = ? AND user_id = ?")->execute([$data['id'], $userId]);
        $pdo->prepare("DELETE FROM inversion_gastos WHERE inversion_id = ? AND user_id = ?")->execute([$data['id'], $userId]);
        $pdo->prepare("DELETE FROM inversiones WHERE id = ? AND user_id = ?")->execute([$data['id'], $userId]);

        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

function agregarDividendo($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['inversion_id']) || empty($data['monto'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID de inversión y monto son obligatorios']);
        return;
    }
    $inversion_id = intval($data['inversion_id']);
    $monto = floatval($data['monto']);
    $fecha = !empty($data['fecha']) ? $data['fecha'] : date('Y-m-d');
    $notas = !empty($data['notas']) ? trim($data['notas']) : null;

    try {
        $stmt = $pdo->prepare("INSERT INTO dividendos (user_id, inversion_id, monto, fecha, notas) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$userId, $inversion_id, $monto, $fecha, $notas]);

        if (!empty($data['registrar_en_cuenta'])) {
             $inv = $pdo->prepare("SELECT nombre FROM inversiones WHERE id = ? AND user_id = ?");
             $inv->execute([$inversion_id, $userId]);
             $nombre = $inv->fetchColumn();
             $stmtAcc = $pdo->prepare("INSERT INTO cuenta_movimientos (user_id, tipo, monto, fecha, inversion_ref, notas) VALUES (?, 'deposito',?,?,?,?)");
             $stmtAcc->execute([$userId, $monto, $fecha, $nombre, 'Cobro de Dividendos']);
        }
        
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al registrar dividendo: ' . $e->getMessage()]);
    }
}

function eliminarDividendo($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['id'])) { return; }
    $pdo->prepare("DELETE FROM dividendos WHERE id = ? AND user_id = ?")->execute([$data['id'], $userId]);
}

function obtenerComponentes() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $inversionId = intval($_GET['inversion_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM inversion_componentes WHERE inversion_id = ? AND user_id = ? ORDER BY id ASC");
    $stmt->execute([$inversionId, $userId]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function crearDespiece($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $inversionId = intval($data['inversion_id'] ?? 0);
    $componentes = $data['componentes'] ?? [];
    if (!$inversionId || !is_array($componentes) || count($componentes) < 2) { http_response_code(400); echo json_encode(['error' => 'Registra al menos dos piezas para el despiece']); return; }
    try {
        $inv = $pdo->prepare("SELECT monto, costo_operativo, despiece FROM inversiones WHERE id = ? AND user_id = ? AND estado = 'activo'");
        $inv->execute([$inversionId, $userId]);
        $lote = $inv->fetch(PDO::FETCH_ASSOC);
        if (!$lote) { http_response_code(404); echo json_encode(['error' => 'Lote activo no encontrado']); return; }
        if ($lote['despiece']) { http_response_code(400); echo json_encode(['error' => 'Este lote ya fue desarmado']); return; }
        $gastos = $pdo->prepare("SELECT COALESCE(SUM(monto), 0) FROM inversion_gastos WHERE inversion_id = ? AND user_id = ?");
        $gastos->execute([$inversionId, $userId]);
        $costoTotal = floatval($lote['monto']) + floatval($lote['costo_operativo']) + floatval($gastos->fetchColumn());
        $suma = 0;
        foreach ($componentes as $c) {
            if (empty(trim($c['nombre'] ?? '')) || !isset($c['costo_asignado']) || floatval($c['costo_asignado']) < 0) { http_response_code(400); echo json_encode(['error' => 'Cada pieza necesita nombre y costo válido']); return; }
            // cantidad es opcional, por defecto 1
            if (isset($c['cantidad']) && floatval($c['cantidad']) <= 0) { http_response_code(400); echo json_encode(['error' => 'Cantidad debe ser mayor a 0']); return; }
            $suma += floatval($c['costo_asignado']);
        }
        if (abs($suma - $costoTotal) > 0.01) { http_response_code(400); echo json_encode(['error' => 'Los costos asignados deben sumar exactamente ' . number_format($costoTotal, 2, '.', '')]); return; }
        $pdo->beginTransaction();
        $insert = $pdo->prepare("INSERT INTO inversion_componentes (user_id, inversion_id, nombre, costo_asignado, cantidad, valor_estimado, notas) VALUES (?, ?, ?, ?, ?, ?, ?)");
        foreach ($componentes as $c) {
            $cantidad = isset($c['cantidad']) && $c['cantidad'] !== '' ? floatval($c['cantidad']) : 1;
            $insert->execute([$userId, $inversionId, trim($c['nombre']), floatval($c['costo_asignado']), $cantidad, isset($c['valor_estimado']) ? floatval($c['valor_estimado']) : null, $c['notas'] ?? null]);
        }
        $pdo->prepare("UPDATE inversiones SET despiece = 1, valor_actual = NULL WHERE id = ? AND user_id = ?")->execute([$inversionId, $userId]);
        $pdo->commit(); echo json_encode(['success' => true]);
    } catch (PDOException $e) { if ($pdo->inTransaction()) $pdo->rollBack(); http_response_code(500); echo json_encode(['error' => $e->getMessage()]); }
}

function resolverComponente($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $componentId = intval($data['componente_id'] ?? 0);
    $estado = $data['estado'] ?? '';
    if (!$componentId || !in_array($estado, ['vendido', 'retenido', 'perdido'])) { http_response_code(400); echo json_encode(['error' => 'Datos de componente inválidos']); return; }
    if ($estado === 'vendido' && (!isset($data['precio_venta']) || floatval($data['precio_venta']) < 0)) { http_response_code(400); echo json_encode(['error' => 'Indica el precio de venta']); return; }
    try {
        $pdo->beginTransaction();
        $q = $pdo->prepare("SELECT c.*, i.nombre as lote_nombre FROM inversion_componentes c JOIN inversiones i ON i.id = c.inversion_id WHERE c.id = ? AND c.user_id = ? AND c.estado = 'pendiente'");
        $q->execute([$componentId, $userId]); $c = $q->fetch(PDO::FETCH_ASSOC);
        if (!$c) { $pdo->rollBack(); http_response_code(404); echo json_encode(['error' => 'Componente pendiente no encontrado']); return; }
        $fecha = $data['fecha'] ?? date('Y-m-d');
        $precio = $estado === 'vendido' ? floatval($data['precio_venta']) : null;
        $inventarioItemId = null;
        if ($estado === 'retenido') {
            // Transferencia interna: conserva exactamente el costo asignado, sin movimiento de caja.
            // Si el componente tiene cantidad >1, crear el item con esa cantidad y calcular costo_unitario
            $cantidad_comp = isset($c['cantidad']) && $c['cantidad'] > 0 ? floatval($c['cantidad']) : 1;
            $costo_compra_total = floatval($c['costo_asignado']);
            $costo_unitario = $cantidad_comp > 0 ? round($costo_compra_total / $cantidad_comp, 6) : $costo_compra_total;
            $insItem = $pdo->prepare("INSERT INTO inventario_items (user_id, origen_inversion_id, tipo, nombre, costo_compra, fecha_compra, unidad_medida, cantidad_total, cantidad_restante, costo_unitario, estado, notas) VALUES (?, ?, 'repuesto', ?, ?, ?, 'unidad', ?, ?, ?, 'activo', ?)");
            $insItem->execute([$userId, $c['inversion_id'], $c['nombre'], $costo_compra_total, $fecha, $cantidad_comp, $cantidad_comp, $costo_unitario, 'Transferido desde despiece: ' . $c['lote_nombre']]);
            $inventarioItemId = $pdo->lastInsertId();
        }
        $pdo->prepare("UPDATE inversion_componentes SET estado = ?, precio_venta = ?, fecha_resolucion = ?, notas = ?, inventario_item_id = ? WHERE id = ? AND user_id = ?")->execute([$estado, $precio, $fecha, $data['notas'] ?? null, $inventarioItemId, $componentId, $userId]);
        if ($estado === 'vendido' && !empty($data['registrar_en_cuenta'])) {
            $notaCuenta = 'Venta por despiece: ' . $c['nombre'];
            
            // Si viene la bandera de venta principal, armamos el texto especial
            if (!empty($data['es_principal'])) {
                $precioFmt = number_format($precio, 0, ',', '.');
                $comisionVal = isset($data['comision']) ? floatval($data['comision']) : 0;
                
                if ($comisionVal > 0) {
                    $comisionFmt = number_format($comisionVal, 0, ',', '.');
                    $notaCuenta = 'Venta principal: ' . $c['nombre'] . ' (' . $precioFmt . ' - ' . $comisionFmt . ' costos venta)';
                } else {
                    $notaCuenta = 'Venta principal: ' . $c['nombre'] . ' (' . $precioFmt . ')';
                }
            }
            
            $pdo->prepare("INSERT INTO cuenta_movimientos (user_id, tipo, monto, fecha, inversion_ref, notas) VALUES (?, 'deposito', ?, ?, ?, ?)")->execute([$userId, $precio, $fecha, $c['lote_nombre'], $notaCuenta]);
        }
        $pend = $pdo->prepare("SELECT COUNT(*) FROM inversion_componentes WHERE inversion_id = ? AND user_id = ? AND estado = 'pendiente'"); $pend->execute([$c['inversion_id'], $userId]);
        if (intval($pend->fetchColumn()) === 0) {
            $ventas = $pdo->prepare("SELECT COALESCE(SUM(precio_venta), 0), MAX(fecha_resolucion) FROM inversion_componentes WHERE inversion_id = ? AND user_id = ? AND estado = 'vendido'");
            $ventas->execute([$c['inversion_id'], $userId]); $tot = $ventas->fetch(PDO::FETCH_NUM);
            $transferido = $pdo->prepare("SELECT COALESCE(SUM(costo_asignado), 0) FROM inversion_componentes WHERE inversion_id = ? AND user_id = ? AND estado = 'retenido'");
            $transferido->execute([$c['inversion_id'], $userId]);
            $pdo->prepare("UPDATE inversiones SET estado = 'vendido', precio_venta = ?, valor_transferido = ?, fecha_venta = ? WHERE id = ? AND user_id = ?")->execute([floatval($tot[0]), floatval($transferido->fetchColumn()), $tot[1] ?? $fecha, $c['inversion_id'], $userId]);
        }
        $pdo->commit(); echo json_encode(['success' => true]);
    } catch (PDOException $e) { if ($pdo->inTransaction()) $pdo->rollBack(); http_response_code(500); echo json_encode(['error' => $e->getMessage()]); }
}

function agregarGastoInversion($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['inversion_id'])) {
        http_response_code(400); echo json_encode(['error' => 'ID de inversión requerido']); return;
    }

    // Rama 1: viene de un item del inventario (consumible o herramienta)
    if (!empty($data['item_id'])) {
        agregarGastoDesdeItem($data);
        return;
    }

    // Rama 2: gasto manual, como siempre
    if (empty($data['monto']) || empty($data['concepto'])) {
        http_response_code(400); echo json_encode(['error' => 'Faltan datos obligatorios']); return;
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO inversion_gastos (user_id, inversion_id, monto, concepto, fecha) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $userId,
            $data['inversion_id'], 
            floatval($data['monto']), 
            $data['concepto'], 
            $data['fecha'] ?? date('Y-m-d')
        ]);
        
        // Auto-sincronizar con cuenta bancaria
        if (!empty($data['registrar_en_cuenta'])) {
            $inv = $pdo->prepare("SELECT nombre FROM inversiones WHERE id = ? AND user_id = ?");
            $inv->execute([$data['inversion_id'], $userId]);
            $nombre = $inv->fetchColumn();
            
            $stmtAcc = $pdo->prepare("INSERT INTO cuenta_movimientos (user_id, tipo, monto, fecha, inversion_ref, notas) VALUES (?, 'retiro',?,?,?,?)");
            $stmtAcc->execute([
                $userId,
                floatval($data['monto']), 
                $data['fecha'] ?? date('Y-m-d'), 
                $nombre, 
                "Costo Op. Detallado: " . $data['concepto']
            ]);
        }
        
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

// Gasto originado por el selector de inventario en el desglose de reparación.
// IMPORTANTE: esto NUNCA toca cuenta_movimientos — esa plata ya salió cuando
// se compró el item. Aquí solo se distribuye el costo entre inversiones.
function agregarGastoDesdeItem($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $inversionId = intval($data['inversion_id']);
    $itemId = intval($data['item_id']);
    $fecha = !empty($data['fecha']) ? $data['fecha'] : date('Y-m-d');

    try {
        $stmt = $pdo->prepare("SELECT * FROM inventario_items WHERE id = ? AND user_id = ?");
        $stmt->execute([$itemId, $userId]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$item) { http_response_code(404); echo json_encode(['error' => 'Item de inventario no encontrado']); return; }

        $pdo->beginTransaction();

        if (in_array($item['tipo'], ['consumible', 'repuesto'])) {
            $cantidadUsada = floatval($data['cantidad_usada'] ?? 0);
            if ($cantidadUsada <= 0) {
                $pdo->rollBack();
                http_response_code(400); echo json_encode(['error' => 'Cantidad usada debe ser mayor a 0']); return;
            }
            if ($cantidadUsada > floatval($item['cantidad_restante'])) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['error' => "Solo quedan {$item['cantidad_restante']} {$item['unidad_medida']} de {$item['nombre']}"]);
                return;
            }

            $costoCalculado = round($cantidadUsada * floatval($item['costo_unitario']), 2);
            $concepto = $item['nombre'] . " ({$cantidadUsada} {$item['unidad_medida']})";

            $nuevaRestante = floatval($item['cantidad_restante']) - $cantidadUsada;
            $nuevoEstado = $nuevaRestante <= 0 ? 'agotado' : 'activo';
            $upd = $pdo->prepare("UPDATE inventario_items SET cantidad_restante = ?, estado = ? WHERE id = ? AND user_id = ?");
            $upd->execute([$nuevaRestante, $nuevoEstado, $itemId, $userId]);
        } else {
            // Herramienta reutilizable: solo se registra cuál se usó, sin costo ni descuento de stock
            $cantidadUsada = null;
            $costoCalculado = 0;
            $concepto = $item['nombre'] . ' (herramienta)';
        }

        $stmtGasto = $pdo->prepare("INSERT INTO inversion_gastos (user_id, inversion_id, item_id, cantidad_usada, monto, concepto, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmtGasto->execute([$userId, $inversionId, $itemId, $cantidadUsada, $costoCalculado, $concepto, $fecha]);
        $gastoId = $pdo->lastInsertId();

        $stmtUso = $pdo->prepare("INSERT INTO inventario_usos (user_id, item_id, inversion_id, inversion_gasto_id, cantidad_usada, costo_calculado, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmtUso->execute([$userId, $itemId, $inversionId, $gastoId, $cantidadUsada, $costoCalculado, $fecha]);

        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

function actualizarGastoInversion($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['id']) || empty($data['monto']) || empty($data['concepto'])) {
        http_response_code(400); echo json_encode(['error' => 'Faltan datos obligatorios para actualizar el gasto']); return;
    }

    $check = $pdo->prepare("SELECT item_id FROM inversion_gastos WHERE id = ? AND user_id = ?");
    $check->execute([$data['id'], $userId]);
    $existing = $check->fetch(PDO::FETCH_ASSOC);
    if ($existing && $existing['item_id']) {
        http_response_code(400);
        echo json_encode(['error' => 'Este gasto viene de Herramientas. Ajusta la cantidad usada desde ahí, no aquí.']);
        return;
    }

    try {
        $stmt = $pdo->prepare("UPDATE inversion_gastos SET monto = ?, concepto = ?, fecha = ? WHERE id = ? AND user_id = ?");
        $stmt->execute([
            floatval($data['monto']), 
            $data['concepto'], 
            $data['fecha'] ?? date('Y-m-d'),
            intval($data['id']),
            $userId
        ]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

function eliminarGastoInversion($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['id'])) { http_response_code(400); echo json_encode(['error' => 'ID requerido']); return; }

    try {
        $pdo->beginTransaction();

        // Si el gasto venía de un item de inventario, devolverle la cantidad consumida
        $stmt = $pdo->prepare("SELECT item_id, cantidad_usada FROM inversion_gastos WHERE id = ? AND user_id = ?");
        $stmt->execute([$data['id'], $userId]);
        $gasto = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($gasto && $gasto['item_id'] && $gasto['cantidad_usada']) {
            $upd = $pdo->prepare("UPDATE inventario_items SET cantidad_restante = cantidad_restante + ?, estado = 'activo' WHERE id = ? AND user_id = ?");
            $upd->execute([floatval($gasto['cantidad_usada']), $gasto['item_id'], $userId]);
        }

        // El uso se guarda aparte para el historial del inventario; se elimina junto al gasto.
        $pdo->prepare("DELETE FROM inventario_usos WHERE inversion_gasto_id = ? AND user_id = ?")->execute([$data['id'], $userId]);
        $del = $pdo->prepare("DELETE FROM inversion_gastos WHERE id = ? AND user_id = ?");
        $del->execute([$data['id'], $userId]);

        $pdo->commit();
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500); echo json_encode(['error' => $e->getMessage()]);
    }
}

function obtenerGastosInversion() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $id = intval($_GET['inversion_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM inversion_gastos WHERE inversion_id = ? AND user_id = ? ORDER BY fecha DESC");
    $stmt->execute([$id, $userId]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}
?>