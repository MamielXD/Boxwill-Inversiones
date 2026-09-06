<?php
require_once 'config.php';

session_start();
if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
    http_response_code(401);
    echo json_encode(['error' => 'No autenticado']);
    exit();
}

header('Content-Type: application/json');

const DIAS_SIN_INTERES = 10;
const DIAS_COMERCIALES_MES = 30;
const DIAS_GRACIA_MORA = 5;

ensureTables();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($method) {
    case 'GET':
        if ($action === 'metrics') getMetrics();
        elseif ($action === 'tabla' && isset($_GET['id'])) getTablaAmortizacion(intval($_GET['id']));
        elseif ($action === 'liquidacion' && isset($_GET['id'])) getLiquidacion(intval($_GET['id']), $_GET['fecha'] ?? null);
        else getPrestamos();
        break;
        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);
            $action = $_GET['action'] ?? '';
            
            if ($action === 'pago') {
                addPago($data);
            } elseif ($action === 'calcular_refinanciacion') {
                calcularRefinanciacion($data);
            } elseif ($action === 'ejecutar_refinanciacion') {
                ejecutarRefinanciacion($data);
            } else {
                addPrestamo($data);
            }
            break;
    case 'PUT':
        $data = json_decode(file_get_contents('php://input'), true);
        updatePrestamo($data);
        break;
    case 'DELETE':
        $data = json_decode(file_get_contents('php://input'), true);
        if ($action === 'pago') deletePago($data);
        else deletePrestamo($data);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
}

function ensureTables() {
    global $pdo;
    $pdo->exec("CREATE TABLE IF NOT EXISTS prestamos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        prestatario VARCHAR(150) NOT NULL,
        monto_original DECIMAL(12,2) NOT NULL,
        tasa_mensual DECIMAL(6,4) NOT NULL,
        comision DECIMAL(12,2) DEFAULT 0.00,
        num_cuotas INT NOT NULL,
        fecha_inicio DATE NOT NULL,
        notas TEXT NULL,
        estado ENUM('activo','pagado','vencido') DEFAULT 'activo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    try { $pdo->exec("ALTER TABLE prestamos ADD COLUMN comision DECIMAL(12,2) DEFAULT 0.00"); } catch (Exception $e) {}

    $pdo->exec("CREATE TABLE IF NOT EXISTS prestamo_pagos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        prestamo_id INT NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        fecha DATE NOT NULL,
        notas TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prestamo_id) REFERENCES prestamos(id) ON DELETE CASCADE
    )");

    $pdo->exec("CREATE TABLE IF NOT EXISTS cuenta_movimientos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tipo ENUM('deposito','retiro','rendimiento','gasto','nomina','ingreso_esperado') NOT NULL,
        monto DECIMAL(12,2) NOT NULL,
        fecha DATE NOT NULL,
        notas TEXT NULL,
        inversion_ref VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    try { $pdo->exec("ALTER TABLE cuenta_movimientos MODIFY COLUMN tipo ENUM('deposito','retiro','rendimiento','gasto','nomina','ingreso_esperado') NOT NULL"); } catch (Exception $e) {}
}

function parseDateOnly($value) {
    return new DateTime(($value ?: date('Y-m-d')) . ' 00:00:00');
}

function diffDays($from, $to) {
    $start = parseDateOnly($from);
    $end = parseDateOnly($to);
    if ($end < $start) {
        return 0;
    }
    return (int) $start->diff($end)->days;
}

function addMonthsToDate($value, $months) {
    $date = parseDateOnly($value);
    $date->modify('+' . intval($months) . ' month');
    return $date->format('Y-m-d');
}

function calcularCuotaFija($monto, $tasaMensual, $numCuotas) {
    if ($tasaMensual == 0) return $monto / $numCuotas;
    $r = $tasaMensual / 100;
    return $monto * ($r * pow(1 + $r, $numCuotas)) / (pow(1 + $r, $numCuotas) - 1);
}

function construirTablaAmortizacion($monto, $tasaMensual, $numCuotas, $fechaInicio, $comision = 0.0) {
    $cuotaBase = calcularCuotaFija($monto, $tasaMensual, $numCuotas);
    $cuotaComision = $comision / $numCuotas;
    $cuota = $cuotaBase + $cuotaComision;
    $r = $tasaMensual / 100;
    $saldo = floatval($monto);
    $tabla = [];

    for ($i = 1; $i <= $numCuotas; $i++) {
        $interesBase = $saldo * $r;
        $interes = $interesBase + $cuotaComision;
        $capital = $cuota - $interes;
        $saldo = max(0, $saldo - $capital);
        $tabla[] = [
            'cuota_num' => $i,
            'fecha_vencimiento' => addMonthsToDate($fechaInicio, $i),
            'cuota_total' => round($cuota, 2),
            'interes' => round($interes, 2),
            'capital' => round($capital, 2),
            'saldo_restante' => round($saldo, 2),
        ];
    }

    return ['cuota' => $cuota, 'tabla' => $tabla];
}

function calcularEstadoPrestamo($prestamo, $totalPagado, $fechaCorte) {
    $monto = floatval($prestamo['monto_original']);
    $tasaMensual = floatval($prestamo['tasa_mensual']);
    $numCuotas = intval($prestamo['num_cuotas']);
    $fechaInicio = $prestamo['fecha_inicio'];
    $comision = isset($prestamo['comision']) ? floatval($prestamo['comision']) : 0.0;

    $resultadoTabla = construirTablaAmortizacion($monto, $tasaMensual, $numCuotas, $fechaInicio, $comision);
    $cuota = $resultadoTabla['cuota'];
    $tabla = $resultadoTabla['tabla'];

    $restante = max(0, floatval($totalPagado));
    $capitalPagado = 0.0;
    $interesPagado = 0.0;
    $cuotaActualIndex = 0;
    $abonoCuotaActual = 0.0;

    foreach ($tabla as $index => $cuotaItem) {
        $pendienteCuota = floatval($cuotaItem['cuota_total']) - $abonoCuotaActual;

        if ($restante + 0.0001 >= $pendienteCuota) {
            $pagoEnCuota = $abonoCuotaActual + $pendienteCuota;
            $interesCubierto = min(floatval($cuotaItem['interes']), $pagoEnCuota);
            $capitalCubierto = min(floatval($cuotaItem['capital']), max(0, $pagoEnCuota - floatval($cuotaItem['interes'])));
            $interesPagado += $interesCubierto;
            $capitalPagado += $capitalCubierto;
            $restante -= $pendienteCuota;
            $cuotaActualIndex = $index + 1;
            $abonoCuotaActual = 0.0;
        } else {
            $pagoEnCuota = $abonoCuotaActual + $restante;
            $interesCubierto = min(floatval($cuotaItem['interes']), $pagoEnCuota);
            $capitalCubierto = min(floatval($cuotaItem['capital']), max(0, $pagoEnCuota - floatval($cuotaItem['interes'])));
            $interesPagado += $interesCubierto;
            $capitalPagado += $capitalCubierto;
            $abonoCuotaActual = $pagoEnCuota;
            $restante = 0.0;
            $cuotaActualIndex = $index;
            break;
        }
    }

    $saldoCapital = max(0, $monto - $capitalPagado);
    $fechaEvaluacion = $fechaCorte ?: date('Y-m-d');
    $diasDesdeInicio = diffDays($fechaInicio, $fechaEvaluacion);
    $proximaCuota = $tabla[$cuotaActualIndex] ?? null;
    $inicioPeriodo = $cuotaActualIndex === 0 ? $fechaInicio : addMonthsToDate($fechaInicio, $cuotaActualIndex);
    $diasPeriodoActual = diffDays($inicioPeriodo, $fechaEvaluacion);

    // Calcular Total Deuda Real para Liquidación (garantizando el cobro total de la comisión)
    $cuotaComision = $comision / max(1, $numCuotas);
    $sumPureInt = 0.0;
    for ($i = 0; $i < $cuotaActualIndex; $i++) {
        $sumPureInt += max(0.0, floatval($tabla[$i]['interes']) - $cuotaComision);
    }

    $saldoBaseProrrateo = $cuotaActualIndex === 0 ? $monto : floatval($tabla[$cuotaActualIndex - 1]['saldo_restante']);
    $intProrrat = 0.0;

    if ($saldoCapital > 0 && $diasDesdeInicio >= DIAS_SIN_INTERES) {
        if ($tasaMensual > 0) {
            $tasa = $tasaMensual / 100;
            $diasProrrateo = max(0, $diasPeriodoActual);
            $intProrrat = $saldoBaseProrrateo * $tasa * ($diasProrrateo / DIAS_COMERCIALES_MES);
        }
    }

    $totalDeudaAbsoluta = $monto + $comision + $sumPureInt + $intProrrat;
    $montoLiquidacionReal = max(0.0, $totalDeudaAbsoluta - floatval($totalPagado));
    $interesLiquidacion = max(0.0, $montoLiquidacionReal - $saldoCapital);

    return [
        'cuota' => $cuota,
        'tabla' => $tabla,
        'capital_pagado' => $capitalPagado,
        'interes_pagado' => $interesPagado,
        'saldo_capital' => round($saldoCapital, 2),
        'interes_liquidacion' => round($interesLiquidacion, 2),
        'monto_liquidacion' => round(max(0, $saldoCapital + $interesLiquidacion), 2),
        'total_programado' => round($cuota * $numCuotas, 2),
        'abono_cuota_actual' => $abonoCuotaActual,
        'dias_desde_inicio' => $diasDesdeInicio,
        'proxima_cuota' => $proximaCuota,
    ];
}

function getPrestamos() {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $stmt = $pdo->prepare("
        SELECT p.*,
            COALESCE((SELECT SUM(monto) FROM prestamo_pagos pp WHERE pp.prestamo_id = p.id AND pp.user_id = ?), 0) AS total_pagado,
            (SELECT COUNT(*) FROM prestamo_pagos pp WHERE pp.prestamo_id = p.id AND pp.user_id = ?) AS num_pagos
        FROM prestamos p
        WHERE p.user_id = ?
        ORDER BY p.fecha_inicio DESC
    ");
    $stmt->execute([$userId, $userId, $userId]);
    $prestamos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $hoy = date('Y-m-d');
    $resultado = array_map(function ($prestamo) use ($hoy) {
        return enriquecerPrestamo($prestamo, floatval($prestamo['total_pagado']), $hoy);
    }, $prestamos);

    echo json_encode($resultado);
}

/**
 * Combina la fila cruda de la tabla `prestamos` con todos los campos
 * derivados de calcularEstadoPrestamo, listos para consumir en el frontend
 * sin que el cliente tenga que reimplementar la amortización francesa.
 */
function enriquecerPrestamo($prestamo, $totalPagado, $fechaEvaluacion) {
    $estado = calcularEstadoPrestamo($prestamo, $totalPagado, $fechaEvaluacion);

    $fechaVencimientoActual = $estado['proxima_cuota']['fecha_vencimiento'] ?? null;
    $enMora = $prestamo['estado'] !== 'pagado'
        && $fechaVencimientoActual
        && diffDays($fechaVencimientoActual, $fechaEvaluacion) > DIAS_GRACIA_MORA;

    return array_merge($prestamo, [
        'total_pagado' => round($totalPagado, 2),
        'cuota' => round($estado['cuota'], 2),
        'capital_pagado' => round($estado['capital_pagado'], 2),
        'interes_pagado' => round($estado['interes_pagado'], 2),
        'saldo_capital' => $estado['saldo_capital'],
        'interes_liquidacion' => $estado['interes_liquidacion'],
        'monto_liquidacion' => $estado['monto_liquidacion'],
        'total_programado' => $estado['total_programado'],
        'total_intereses_programados' => round($estado['total_programado'] - floatval($prestamo['monto_original']), 2),
        'saldo_programado' => round(max(0, $estado['total_programado'] - $totalPagado), 2),
        'abono_cuota_actual' => round($estado['abono_cuota_actual'], 2),
        'dias_desde_inicio' => $estado['dias_desde_inicio'],
        'proxima_cuota' => $estado['proxima_cuota'],
        'en_mora' => $enMora,
    ]);
}

function getTablaAmortizacion($id) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $stmt = $pdo->prepare("SELECT * FROM prestamos WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    $prestamo = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$prestamo) {
        http_response_code(404);
        echo json_encode(['error' => 'No encontrado']);
        return;
    }

    $totalPagadoStmt = $pdo->prepare("SELECT COALESCE(SUM(monto), 0) FROM prestamo_pagos WHERE prestamo_id = ? AND user_id = ?");
    $totalPagadoStmt->execute([$id, $userId]);
    $totalPagado = floatval($totalPagadoStmt->fetchColumn() ?: 0);

    $hoy = date('Y-m-d');
    $estado = calcularEstadoPrestamo($prestamo, $totalPagado, $hoy);

    // El índice de la próxima cuota (0-based) marca cuántas cuotas anteriores
    // ya están completamente pagadas; se calcula con cuota_num - 1 de la
    // próxima cuota pendiente, o num_cuotas si el préstamo ya se pagó del todo.
    $cuotasPagadas = $estado['proxima_cuota']
        ? intval($estado['proxima_cuota']['cuota_num']) - 1
        : intval($prestamo['num_cuotas']);

    echo json_encode([
        'prestamo' => $prestamo,
        'tabla' => $estado['tabla'],
        'cuotas_pagadas' => $cuotasPagadas,
        'abono_cuota_actual' => round($estado['abono_cuota_actual'], 2),
    ]);
}

/**
 * Recalcula saldo/interés de liquidación a una fecha arbitraria (no necesariamente hoy).
 * Usado por el formulario de "Registrar Pago" cuando el usuario cambia la fecha de pago,
 * sin tener que reimplementar calcularEstadoPrestamo en el cliente.
 */
function getLiquidacion($id, $fecha) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    $stmt = $pdo->prepare("SELECT * FROM prestamos WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $userId]);
    $prestamo = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$prestamo) {
        http_response_code(404);
        echo json_encode(['error' => 'No encontrado']);
        return;
    }

    $totalPagadoStmt = $pdo->prepare("SELECT COALESCE(SUM(monto), 0) FROM prestamo_pagos WHERE prestamo_id = ? AND user_id = ?");
    $totalPagadoStmt->execute([$id, $userId]);
    $totalPagado = floatval($totalPagadoStmt->fetchColumn() ?: 0);

    $fechaEvaluacion = $fecha ?: date('Y-m-d');
    $estado = calcularEstadoPrestamo($prestamo, $totalPagado, $fechaEvaluacion);

    echo json_encode([
        'fecha' => $fechaEvaluacion,
        'saldo_capital' => $estado['saldo_capital'],
        'interes_liquidacion' => $estado['interes_liquidacion'],
        'monto_liquidacion' => $estado['monto_liquidacion'],
        'dias_desde_inicio' => $estado['dias_desde_inicio'],
    ]);
}

function getMetrics() {
    global $pdo;
    $userId = $_SESSION['user_id'];

    $stmt1 = $pdo->prepare("SELECT SUM(monto_original) FROM prestamos WHERE user_id = ?");
    $stmt1->execute([$userId]);
    $totalPrestado = floatval($stmt1->fetchColumn() ?: 0);

    $stmt2 = $pdo->prepare("SELECT SUM(monto) FROM prestamo_pagos WHERE user_id = ?");
    $stmt2->execute([$userId]);
    $totalRecuperado = floatval($stmt2->fetchColumn() ?: 0);

    $stmt3 = $pdo->prepare("
        SELECT SUM(monto_original) - SUM(COALESCE(pagado_por_capital, 0))
        FROM (
            SELECT p.id, p.monto_original,
                   LEAST(p.monto_original, COALESCE(SUM(pp.monto), 0)) as pagado_por_capital
            FROM prestamos p
            LEFT JOIN prestamo_pagos pp ON p.id = pp.prestamo_id
            WHERE p.estado != 'pagado' AND p.user_id = ?
            GROUP BY p.id
        ) as sub
    ");
    $stmt3->execute([$userId]);
    $capitalEnCalle = floatval($stmt3->fetchColumn() ?: 0);

    $stmt4 = $pdo->prepare("SELECT COUNT(*) FROM prestamos WHERE estado = 'activo' AND user_id = ?");
    $stmt4->execute([$userId]);
    $numActivos = $stmt4->fetchColumn();

    // Interés real recibido: se calcula con la misma amortización que usa cada
    // préstamo individual, no con una resta contable que mezclaba capital e interés.
    $stmtPrestamos = $pdo->prepare("
        SELECT p.*,
            COALESCE((SELECT SUM(monto) FROM prestamo_pagos pp WHERE pp.prestamo_id = p.id AND pp.user_id = ?), 0) AS total_pagado
        FROM prestamos p
        WHERE p.user_id = ?
    ");
    $stmtPrestamos->execute([$userId, $userId]);
    $totalInteresRecibido = 0.0;
    $hoy = date('Y-m-d');
    foreach ($stmtPrestamos->fetchAll(PDO::FETCH_ASSOC) as $prestamo) {
        $estado = calcularEstadoPrestamo($prestamo, floatval($prestamo['total_pagado']), $hoy);
        $totalInteresRecibido += $estado['interes_pagado'];
    }

    echo json_encode([
        'total_prestado' => $totalPrestado,
        'total_recuperado' => $totalRecuperado,
        'capital_en_calle' => max(0, $capitalEnCalle),
        'num_prestamos_activos' => $numActivos,
        'total_interes_recibido' => round($totalInteresRecibido, 2),
    ]);
}

function addPrestamo($data) {
    global $pdo;
    $required = ['prestatario', 'monto_original', 'tasa_mensual', 'num_cuotas', 'fecha_inicio'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            http_response_code(400);
            echo json_encode(['error' => "Campo requerido: $field"]);
            return;
        }
    }

    $monto = floatval($data['monto_original']);
    $tasa = floatval($data['tasa_mensual']);
    $cuotas = intval($data['num_cuotas']);
    $comision = isset($data['comision']) ? floatval($data['comision']) : 0.0;

    if ($monto <= 0 || $tasa < 0 || $cuotas <= 0 || $comision < 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Valores inválidos']);
        return;
    }

    $stmt = $pdo->prepare("INSERT INTO prestamos (user_id, prestatario, monto_original, tasa_mensual, comision, num_cuotas, fecha_inicio, notas) VALUES (?,?,?,?,?,?,?,?)");
    $stmt->execute([
        $_SESSION['user_id'],
        trim($data['prestatario']),
        $monto, $tasa, $comision, $cuotas,
        $data['fecha_inicio'],
        $data['notes'] ?? $data['notas'] ?? null
    ]);

    $id = $pdo->lastInsertId();

    if (!empty($data['registrar_en_cuenta'])) {
        try {
            $stmt2 = $pdo->prepare("INSERT INTO cuenta_movimientos (user_id, tipo, monto, fecha, inversion_ref, notas) VALUES (?, 'retiro',?,?,?,?)");
            $stmt2->execute([$_SESSION['user_id'], $monto, $data['fecha_inicio'], trim($data['prestatario']), 'Préstamo otorgado']);
        } catch (Throwable $e) {
            error_log("Error sincronizando préstamo con cuenta: " . $e->getMessage());
        }
    }

    $stmt = $pdo->prepare("SELECT * FROM prestamos WHERE id = ? AND user_id = ?");
    $stmt->execute([$id, $_SESSION['user_id']]);
    $prestamoCreado = $stmt->fetch(PDO::FETCH_ASSOC);
    http_response_code(201);
    echo json_encode(enriquecerPrestamo($prestamoCreado, 0.0, date('Y-m-d')));
}

function updatePrestamo($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];

    if (empty($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID requerido']);
        return;
    }

    $required = ['prestatario', 'monto_original', 'tasa_mensual', 'num_cuotas', 'fecha_inicio'];
    foreach ($required as $field) {
        if (!isset($data[$field]) || $data[$field] === '') {
            http_response_code(400);
            echo json_encode(['error' => "Campo requerido: $field"]);
            return;
        }
    }

    $monto = floatval($data['monto_original']);
    $tasa = floatval($data['tasa_mensual']);
    $cuotas = intval($data['num_cuotas']);
    $comision = isset($data['comision']) ? floatval($data['comision']) : 0.0;

    if ($monto <= 0 || $tasa < 0 || $cuotas <= 0 || $comision < 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Valores inválidos']);
        return;
    }

    $stmt = $pdo->prepare("
        UPDATE prestamos 
        SET prestatario = ?, monto_original = ?, tasa_mensual = ?, comision = ?, num_cuotas = ?, fecha_inicio = ?, notas = ?, estado = ? 
        WHERE id = ? AND user_id = ?
    ");
    $stmt->execute([
        trim($data['prestatario']),
        $monto,
        $tasa,
        $comision,
        $cuotas,
        $data['fecha_inicio'],
        $data['notas'] ?? null,
        $data['estado'] ?? 'activo',
        $data['id'],
        $userId
    ]);

    // Return the updated loan representation, enriquecida igual que getPrestamos
    $stmt = $pdo->prepare("
        SELECT p.*,
            COALESCE((SELECT SUM(monto) FROM prestamo_pagos pp WHERE pp.prestamo_id = p.id AND pp.user_id = ?), 0) AS total_pagado,
            (SELECT COUNT(*) FROM prestamo_pagos pp WHERE pp.prestamo_id = p.id AND pp.user_id = ?) AS num_pagos
        FROM prestamos p
        WHERE p.id = ? AND p.user_id = ?
    ");
    $stmt->execute([$userId, $userId, $data['id'], $userId]);
    $prestamo = $stmt->fetch(PDO::FETCH_ASSOC);
    echo json_encode(enriquecerPrestamo($prestamo, floatval($prestamo['total_pagado']), date('Y-m-d')));
}

function addPago($data) {
    global $pdo;
    if (empty($data['prestamo_id']) || empty($data['monto'])) {
        http_response_code(400);
        echo json_encode(['error' => 'prestamo_id y monto son requeridos']);
        return;
    }

    $userId = $_SESSION['user_id'];
    $prestamoId = intval($data['prestamo_id']);
    $monto = floatval($data['monto']);
    $fecha = $data['fecha'] ?? date('Y-m-d');

    $prestamoStmt = $pdo->prepare("SELECT * FROM prestamos WHERE id = ? AND user_id = ?");
    $prestamoStmt->execute([$prestamoId, $userId]);
    $prestamo = $prestamoStmt->fetch(PDO::FETCH_ASSOC);
    if (!$prestamo) {
        http_response_code(404);
        echo json_encode(['error' => 'Préstamo no encontrado']);
        return;
    }

    $totalPrevioStmt = $pdo->prepare("SELECT COALESCE(SUM(monto), 0) FROM prestamo_pagos WHERE prestamo_id = ? AND user_id = ?");
    $totalPrevioStmt->execute([$prestamoId, $userId]);
    $totalPrevio = floatval($totalPrevioStmt->fetchColumn() ?: 0);
    $estadoPrevio = calcularEstadoPrestamo($prestamo, $totalPrevio, $fecha);
    $umbralLiquidacion = round($totalPrevio + $estadoPrevio['monto_liquidacion'], 2);

    $stmt = $pdo->prepare("INSERT INTO prestamo_pagos (user_id, prestamo_id, monto, fecha, notas) VALUES (?,?,?,?,?)");
    $stmt->execute([$userId, $prestamoId, $monto, $fecha, $data['notas'] ?? null]);

    if (!empty($data['registrar_en_cuenta'])) {
        try {
            $stmt2 = $pdo->prepare("INSERT INTO cuenta_movimientos (user_id, tipo, monto, fecha, inversion_ref, notas) VALUES (?, 'deposito',?,?,?,?)");
            $stmt2->execute([$userId, $monto, $fecha, $prestamo['prestatario'], 'Pago de préstamo']);
        } catch (Throwable $e) {
            error_log("Error sincronizando pago con cuenta: " . $e->getMessage());
        }
    }

    $totalNuevo = $totalPrevio + $monto;
    $estaPagado = ($totalNuevo + 0.01 >= $umbralLiquidacion) || ($totalNuevo + 0.01 >= floatval($estadoPrevio['total_programado']));
    $nuevoEstado = $estaPagado ? 'pagado' : 'activo';

    $pdo->prepare("UPDATE prestamos SET estado = ? WHERE id = ? AND user_id = ?")->execute([$nuevoEstado, $prestamoId, $userId]);

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'estado' => $nuevoEstado,
        'monto_liquidacion' => $estadoPrevio['monto_liquidacion'],
    ]);
}

function deletePago($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID requerido']);
        return;
    }

    $prestamoStmt = $pdo->prepare("SELECT prestamo_id FROM prestamo_pagos WHERE id = ? AND user_id = ?");
    $prestamoStmt->execute([$data['id'], $userId]);
    $prestamoId = $prestamoStmt->fetchColumn();

    $pdo->prepare("DELETE FROM prestamo_pagos WHERE id = ? AND user_id = ?")->execute([$data['id'], $userId]);

    if ($prestamoId) {
        $pdo->prepare("UPDATE prestamos SET estado = 'activo' WHERE id = ? AND user_id = ?")->execute([$prestamoId, $userId]);
    }

    echo json_encode(['success' => true]);
}

function deletePrestamo($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    if (empty($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID requerido']);
        return;
    }
    $pdo->prepare("DELETE FROM prestamo_pagos WHERE prestamo_id = ? AND user_id = ?")->execute([$data['id'], $userId]);
    $pdo->prepare("DELETE FROM prestamos WHERE id = ? AND user_id = ?")->execute([$data['id'], $userId]);
    echo json_encode(['success' => true]);
}

// ===================== REFINANCIACIÓN =====================

function calcularRefinanciacion($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    
    if (empty($data['prestamo_id']) || empty($data['fecha_refinanciacion'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID y fecha de refinanciación son obligatorios']);
        return;
    }

    $prestamoId = intval($data['prestamo_id']);
    $fechaRefinanciacion = $data['fecha_refinanciacion'];
    $nuevaTasa = isset($data['nueva_tasa']) ? floatval($data['nueva_tasa']) : null;
    $nuevoPlazo = isset($data['nuevo_plazo']) ? intval($data['nuevo_plazo']) : null;
    $perdonIntereses = isset($data['perdon_intereses']) ? floatval($data['perdon_intereses']) : 0;

    try {
        $stmt = $pdo->prepare("SELECT * FROM prestamos WHERE id = ? AND user_id = ? AND estado IN ('activo', 'vencido')");
        $stmt->execute([$prestamoId, $userId]);
        $prestamo = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$prestamo) {
            http_response_code(404);
            echo json_encode(['error' => 'Préstamo no encontrado o ya liquidado']);
            return;
        }

        // Obtener total pagado hasta la fecha
        $stmtPagos = $pdo->prepare("SELECT COALESCE(SUM(monto), 0) FROM prestamo_pagos WHERE prestamo_id = ? AND user_id = ?");
        $stmtPagos->execute([$prestamoId, $userId]);
        $totalPagado = floatval($stmtPagos->fetchColumn() ?: 0);

        // Calcular estado actual del préstamo
        $estadoActual = calcularEstadoPrestamo($prestamo, $totalPagado, $fechaRefinanciacion);
        $saldoPendiente = $estadoActual['saldo_capital'];
        $interesPendiente = $estadoActual['interes_liquidacion'];

        $fechaCreacion = new DateTime($prestamo['fecha_inicio']);
        $fechaRefi = new DateTime($fechaRefinanciacion);
        $mesesAtraso = $fechaCreacion->diff($fechaRefi)->m + ($fechaCreacion->diff($fechaRefi)->y * 12);
        
        if ($mesesAtraso <= 0) {
            $mesesAtraso = 1; // Mínimo 1 mes para refinanciar
        }

        $tasaMensual = floatval($prestamo['tasa_mensual']) / 100;
        $tasaOriginal = floatval($prestamo['tasa_mensual']);
        
        // Interés compuesto acumulado desde creación
        $interesCompuesto = $saldoPendiente * (pow(1 + $tasaMensual, $mesesAtraso) - 1);
        $interesCompuesto = round($interesCompuesto, 2);
        
        // Aplicar perdón de intereses
        $perdonAplicado = min($perdonIntereses, $interesCompuesto);
        $interesCapitalizado = $interesCompuesto - $perdonAplicado;

        // Nuevo saldo = capital pendiente + intereses capitalizados
        $nuevoSaldo = $saldoPendiente + $interesCapitalizado;
        $tasaFinal = $nuevaTasa ?? $tasaOriginal;
        $plazoFinal = $nuevoPlazo ?? intval($prestamo['num_cuotas']);

        // Calcular nueva cuota mensual con amortización francesa
        $cuotaMensual = 0;
        $tablaPreview = [];
        if ($plazoFinal > 0 && $tasaFinal > 0) {
            $r = $tasaFinal / 100;
            if ($r > 0) {
                $cuotaMensual = $nuevoSaldo * $r * pow(1 + $r, $plazoFinal) / (pow(1 + $r, $plazoFinal) - 1);
                $cuotaMensual = round($cuotaMensual, 2);
                
                // Generar tabla preview (primeras 5 cuotas + última)
                $saldoTemp = $nuevoSaldo;
                for ($i = 1; $i <= min($plazoFinal, 5); $i++) {
                    $interesCuota = $saldoTemp * $r;
                    $capitalCuota = $cuotaMensual - $interesCuota;
                    $saldoTemp -= $capitalCuota;
                    $tablaPreview[] = [
                        'cuota' => $i,
                        'fecha' => addMonthsToDate($fechaRefinanciacion, $i),
                        'cuota_total' => round($cuotaMensual, 2),
                        'capital' => round($capitalCuota, 2),
                        'interes' => round($interesCuota, 2),
                        'saldo' => round(max(0, $saldoTemp), 2)
                    ];
                }
                if ($plazoFinal > 5) {
                    // Última cuota
                    $ultimaCuota = $tablaPreview[4] ?? end($tablaPreview);
                    $tablaPreview[] = ['...' => '...'];
                    // Recalcular saldo restante para la última cuota
                    $saldoTemp = $nuevoSaldo;
                    for ($i = 1; $i <= $plazoFinal; $i++) {
                        $interesCuota = $saldoTemp * $r;
                        $capitalCuota = $cuotaMensual - $interesCuota;
                        $saldoTemp -= $capitalCuota;
                    }
                    $tablaPreview[] = [
                        'cuota' => $plazoFinal,
                        'fecha' => addMonthsToDate($fechaRefinanciacion, $plazoFinal),
                        'cuota_total' => round($cuotaMensual, 2),
                        'capital' => round($capitalCuota, 2),
                        'interes' => round($interesCuota, 2),
                        'saldo' => round(max(0, $saldoTemp), 2)
                    ];
                }
            }
        } else {
            // Sin interés: cuota fija
            $cuotaMensual = round($nuevoSaldo / $plazoFinal, 2);
        }

        $fechaPrimerPago = (new DateTime($fechaRefinanciacion))->modify('+1 month')->format('Y-m-d');

        echo json_encode([
            'success' => true,
            'prestamo_id' => $prestamoId,
            'deudor' => $prestamo['prestatario'],
            'fecha_refinanciacion' => $fechaRefinanciacion,
            'saldo_original_capital' => $saldoPendiente,
            'interes_acumulado_bruto' => $interesCompuesto,
            'perdon_intereses' => $perdonAplicado,
            'interes_capitalizado' => $interesCapitalizado,
            'nuevo_saldo' => round($nuevoSaldo, 2),
            'tasa_original' => $tasaOriginal,
            'tasa_nueva' => $tasaFinal,
            'plazo_original' => intval($prestamo['num_cuotas']),
            'plazo_nuevo' => $plazoFinal,
            'meses_atraso' => $mesesAtraso,
            'cuota_mensual' => $cuotaMensual,
            'total_a_pagar' => round($cuotaMensual * $plazoFinal, 2),
            'intereses_totales' => round(($cuotaMensual * $plazoFinal) - $nuevoSaldo, 2),
            'fecha_primer_pago' => $fechaPrimerPago,
            'tabla_preview' => $tablaPreview,
            'estado_actual' => $estadoActual
        ]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al calcular refinanciación: ' . $e->getMessage()]);
    }
}

function ejecutarRefinanciacion($data) {
    global $pdo;
    $userId = $_SESSION['user_id'];
    
    if (empty($data['prestamo_id']) || empty($data['fecha_refinanciacion']) || empty($data['nuevo_plazo'])) {
        http_response_code(400);
        echo json_encode(['error' => 'ID, fecha de refinanciación y nuevo plazo son obligatorios']);
        return;
    }

    $prestamoId = intval($data['prestamo_id']);
    $fechaRefinanciacion = $data['fecha_refinanciacion'];
    $nuevoPlazo = intval($data['nuevo_plazo']);
    $nuevaTasa = isset($data['nueva_tasa']) ? floatval($data['nueva_tasa']) : null;
    $perdonIntereses = isset($data['perdon_intereses']) ? floatval($data['perdon_intereses']) : 0;
    $notasAdicionales = isset($data['notas']) ? trim($data['notas']) : '';

    try {
        $pdo->beginTransaction();

        // Obtener préstamo original
        $stmt = $pdo->prepare("SELECT * FROM prestamos WHERE id = ? AND user_id = ? AND estado IN ('activo', 'vencido')");
        $stmt->execute([$prestamoId, $userId]);
        $prestamo = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$prestamo) {
            http_response_code(404);
            echo json_encode(['error' => 'Préstamo no encontrado o ya liquidado']);
            return;
        }

        if ($prestamo['refinanciado'] ?? false) {
            http_response_code(400);
            echo json_encode(['error' => 'Este préstamo ya fue refinanciado']);
            return;
        }

        // Obtener total pagado
        $stmtPagos = $pdo->prepare("SELECT COALESCE(SUM(monto), 0) FROM prestamo_pagos WHERE prestamo_id = ? AND user_id = ?");
        $stmtPagos->execute([$prestamoId, $userId]);
        $totalPagado = floatval($stmtPagos->fetchColumn() ?: 0);

        // Calcular estado actual
        $estadoActual = calcularEstadoPrestamo($prestamo, $totalPagado, $fechaRefinanciacion);
        $saldoPendiente = $estadoActual['saldo_capital'];
        $interesPendiente = $estadoActual['interes_liquidacion'];

        $fechaCreacion = new DateTime($prestamo['fecha_inicio']);
        $fechaRefi = new DateTime($fechaRefinanciacion);
        $mesesAtraso = $fechaCreacion->diff($fechaRefi)->m + ($fechaCreacion->diff($fechaRefi)->y * 12);
        if ($mesesAtraso <= 0) $mesesAtraso = 1;

        $tasaMensual = floatval($prestamo['tasa_mensual']) / 100;
        $tasaOriginal = floatval($prestamo['tasa_mensual']);
        
        // Interés compuesto
        $interesCompuesto = $saldoPendiente * (pow(1 + $tasaMensual, $mesesAtraso) - 1);
        $interesCompuesto = round($interesCompuesto, 2);
        
        $perdonAplicado = min($perdonIntereses, $interesCompuesto);
        $interesCapitalizado = $interesCompuesto - $perdonAplicado;

        $nuevoSaldo = $saldoPendiente + $interesCapitalizado;
        $tasaFinal = $nuevaTasa ?? $tasaOriginal;
        $plazoFinal = $nuevoPlazo;

        // Calcular cuota
        $cuotaMensual = 0;
        if ($plazoFinal > 0 && $tasaFinal > 0) {
            $r = $tasaFinal / 100;
            if ($r > 0) {
                $cuotaMensual = $nuevoSaldo * $r * pow(1 + $r, $plazoFinal) / (pow(1 + $r, $plazoFinal) - 1);
                $cuotaMensual = round($cuotaMensual, 2);
            } else {
                $cuotaMensual = round($nuevoSaldo / $plazoFinal, 2);
            }
        } else {
            $cuotaMensual = round($nuevoSaldo / $plazoFinal, 2);
        }

        // 1. Marcar préstamo original como refinanciado
        $stmt = $pdo->prepare("UPDATE prestamos SET 
            refinanciado = 1,
            estado = 'refinanciado',
            fecha_refinanciacion = ?,
            intereses_capitalizados = ?,
            saldo_original = ?,
            tasa_refinanciada = ?,
            plazo_original = ?,
            perdon_intereses = ?
        WHERE id = ? AND user_id = ?");
        
        $stmt->execute([
            $fechaRefinanciacion,
            $interesCapitalizado,
            $saldoPendiente,
            $tasaFinal,
            $prestamo['num_cuotas'],
            $perdonAplicado,
            $prestamoId,
            $userId
        ]);

        // 2. Crear nuevo préstamo refinanciado
        $notas = "REFINANCIACIÓN del préstamo #{$prestamoId}\n" .
                 "Deudor: {$prestamo['prestatario']}\n" .
                 "Capital pendiente original: $" . number_format($saldoPendiente, 2) . "\n" .
                 "Interés compuesto acumulado: $" . number_format($interesCompuesto, 2) . "\n" .
                 "Perdón de intereses: $" . number_format($perdonAplicado, 2) . "\n" .
                 "Interés capitalizado: $" . number_format($interesCapitalizado, 2) . "\n" .
                 "Nuevo saldo: $" . number_format($nuevoSaldo, 2) . "\n" .
                 "Meses atrasados: {$mesesAtraso}\n" .
                 "Tasa original: {$tasaOriginal}%\n" .
                 "Nueva tasa: {$tasaFinal}%\n" .
                 "Plazo original: {$prestamo['num_cuotas']} meses\n" .
                 "Nuevo plazo: {$plazoFinal} meses\n" .
                 "Cuota mensual: $" . number_format($cuotaMensual, 2) . "\n" .
                 ($notasAdicionales ? "Notas adicionales: {$notasAdicionales}" : "");

        $stmt = $pdo->prepare("INSERT INTO prestamos (
            user_id, prestatario, monto_original, tasa_mensual, comision, num_cuotas, fecha_inicio, 
            estado, notas, prestamo_original_id, refinanciado, fecha_refinanciacion, 
            intereses_capitalizados, saldo_original, tasa_refinanciada, plazo_original, perdon_intereses
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

        $stmt->execute([
            $userId,
            $prestamo['prestatario'] . ' (REFI)',
            $nuevoSaldo,
            $tasaFinal,
            0, // comisión 0 en refinanciación
            $plazoFinal,
            $fechaRefinanciacion,
            'activo',
            $notas,
            $prestamoId,
            1,
            $fechaRefinanciacion,
            $interesCapitalizado,
            $saldoPendiente,
            $tasaFinal,
            $prestamo['num_cuotas'],
            $perdonAplicado
        ]);

        $nuevoPrestamoId = $pdo->lastInsertId();

        // 3. Crear plan de pagos para el nuevo préstamo
        $r = $tasaFinal / 100;
        $saldoTemp = $nuevoSaldo;
        $fechaPago = new DateTime($fechaRefinanciacion);
        $fechaPago->modify('+1 month');

        for ($i = 1; $i <= $plazoFinal; $i++) {
            if ($r > 0) {
                $interesCuota = $saldoTemp * $r;
                $capitalCuota = $cuotaMensual - $interesCuota;
            } else {
                $interesCuota = 0;
                $capitalCuota = $cuotaMensual;
            }
            $saldoTemp -= $capitalCuota;

            $stmt = $pdo->prepare("INSERT INTO cuotas_prestamo (
                prestamo_id, numero_cuota, fecha_vencimiento, monto_total, 
                capital, interes, saldo_restante, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')");

            $stmt->execute([
                $nuevoPrestamoId,
                $i,
                $fechaPago->format('Y-m-d'),
                round($cuotaMensual, 2),
                round($capitalCuota, 2),
                round($interesCuota, 2),
                round(max(0, $saldoTemp), 2)
            ]);

            $fechaPago->modify('+1 month');
        }

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'nuevo_prestamo_id' => $nuevoPrestamoId,
            'resumen' => [
                'saldo_original' => $saldoPendiente,
                'interes_acumulado' => $interesCompuesto,
                'perdon_intereses' => $perdonAplicado,
                'interes_capitalizado' => $interesCapitalizado,
                'nuevo_saldo' => $nuevoSaldo,
                'meses_atraso' => $mesesAtraso,
                'tasa_nueva' => $tasaFinal,
                'plazo_nuevo' => $plazoFinal,
                'cuota_mensual' => $cuotaMensual,
                'total_pagar' => round($cuotaMensual * $plazoFinal, 2),
                'interes_total' => round(($cuotaMensual * $plazoFinal) - $nuevoSaldo, 2),
                'fecha_primer_pago' => (new DateTime($fechaRefinanciacion))->modify('+1 month')->format('Y-m-d')
            ]
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Error en refinanciación: ' . $e->getMessage()]);
    }
}
?>