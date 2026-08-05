# Diseño: Fila de movimientos, agrupación por fecha, jerarquía cuotas/fijas, y auditoría de Agosto 2026

## Contexto

Trabajo continúa sobre el worktree `movimientos-cuenta-tabbar-revamp` (rama `worktree-movimientos-cuenta-tabbar-revamp`), que ya tiene sin commitear: categorías fijas (`es_fija`, `fixed_series_id`), candado de movimientos de ingreso recurrente, `MovementDetailSheet` (hoy solo lectura), búsqueda/filtro de movimientos, y el rediseño de Cuenta. Master no tiene ninguna de estas piezas, así que los 4 puntos se implementan sobre este worktree.

Las migraciones 0004-0006 (columnas `tipo`, `es_fija`, `fixed_series_id`, permisos `service_role`) ya están aplicadas en la base real — verificado con una consulta directa.

## 0. Instrucciones globales

Agregar a `AGENTS.md` (raíz y worktree) una línea indicando usar `/model opusplan` para sesiones de este proyecto, junto al protocolo de cierre existente.

## A. Fila de movimientos: más espacio para el concepto

- `MovementListItem.tsx`: se elimina la fila fija de `[monto][switch][editar][eliminar]` y se deja `[monto][switch Pagado/Pendiente]` únicamente. El switch y el monto conservan su comportamiento actual (tap en switch cambia estado; tap en fila/monto abre `MovementDetailSheet`).
- `MovementDetailSheet.tsx` (hoy solo lectura) gana dos botones de acción — "Editar" y "Eliminar" — al fondo del sheet, reutilizando los mismos handlers (`onEdit`, `onDelete`) que hoy recibe `MovementListItem` desde `movimientos.tsx`. Eliminar desde el sheet reutiliza los mismos diálogos de confirmación existentes (`useConfirmDialog`, casos especiales de ingreso recurrente / cuotas).
- Movimientos bloqueados (`isRecurringGeneratedMovement`) siguen sin mostrar editar/eliminar, igual que hoy.
- Efecto esperado: el concepto (`Text numberOfLines=1`) recupera ~72px de ancho (dos slots de `ACTION_SLOT_WIDTH` + gap), suficiente para que "Zapatillas (cuota 5/6)" no trunque en dispositivos angostos.

## B. Agrupación por fecha (estilo Mercado Pago)

- `movimientos.tsx` cambia de `FlatList` a `SectionList`. `MonthSelector` + `MovementSearchBar` se mantienen en `ListHeaderComponent`.
- Nueva función pura `groupMovementsByDate(movements: Movement[]): { fecha: string; totalDelDia: number; data: Movement[] }[]` en `features/movements/date.ts` (o archivo nuevo `features/movements/dateGrouping.ts`), ordenada descendente por fecha (ya es el orden por defecto). `totalDelDia` = suma con signo (ingresos +, gastos -) de los movimientos de ese día — coherente con cómo se pinta el monto en `MovementListItem` (rojo con "-" para gasto, verde sin signo para ingreso).
- `renderSectionHeader`: texto con formato "HOY · 04 de agosto" cuando la fecha es la de hoy (usar la fecha real del dispositivo), o "03 de agosto" para el resto, más el total del día formateado en CLP con color según signo. Reutiliza `formatLongDate`/`MONTH_NAMES` ya existentes.
- El agrupamiento se aplica sobre `visibleMovements` (después de búsqueda/orden/filtro de categoría), así que sigue funcionando con los filtros existentes.
- Test unitario nuevo para `groupMovementsByDate` (casos: vacío, un día, varios días, orden, signo del total).

## C. Jerarquía cuotas vs. categoría fija (override)

Hoy `computeFixedCategoryReplications` (`features/movements/fixedCategoryReplication.ts`) toma la última instancia de cada `fixed_series_id` y la replica indefinidamente al mes visto, sin mirar `cuota_numero`/`cuota_total`. Esto es el bug confirmado en los datos de prueba actuales (Zapatillas y Crédito auto replicándose sin avanzar la cuota ni detenerse).

Cambio:
- `computeFixedCategoryReplications` filtra fuera cualquier serie cuya última instancia tenga `cuota_total != null && cuota_numero != null && cuota_numero >= cuota_total` (la cuota ya se completó → no se replica más, sin importar que la categoría sea fija).
- Para series con cuotas que sí siguen (`cuota_numero < cuota_total`), la fila generada incrementa `cuota_numero: m.cuota_numero + 1` y conserva `cuota_total`, además de la fecha desplazada (`shiftFechaToMonth`) — hoy `NewFixedMovementRow` no incluye estos dos campos, hay que agregarlos al tipo y al insert en `fixedCategories.ts`.
- Series sin cuotas (`cuota_numero`/`cuota_total` null) siguen replicándose indefinidamente igual que hoy (Luz, Agua, Polla, Bupa, IPTV, gimnasio, etc.).
- Tests nuevos/actualizados en `__tests__/fixedCategoryReplication.test.ts`: cuota intermedia incrementa y se replica; última cuota no se replica; sin cuotas replica indefinido (regresión del comportamiento actual).

## D. Auditoría y sincronización de Agosto 2026

**Decisiones ya confirmadas contigo:**
- El Sueldo mensual ($946.833) **no** se agrega como movimiento suelto — se actualiza el `recurring_income` existente del usuario (`532e07c0-...`, tipo `fijo`) a `monto: 946833`, y se regenera/corrige el movimiento materializado de agosto (fecha `2026-08-01`, `estado: pagado`).
- Las 3 fechas de julio que forman parte del ciclo "Agosto" en tu PDF — Sueldo (31/07), Ingreso adicional $40.403 (30/07), Agua (31/07) — se guardan con fecha dentro de agosto (`2026-08-01`) para que la pantalla "Agosto 2026" de la app calcule el saldo real usando el motor existente (`calculateMonthSummary`, filtro estricto de mes calendario), en vez de hardcodear el número.
- Se limpian primero los movimientos de prueba de sesiones anteriores (julio/agosto/septiembre 2026, y los `recurring_income` duplicados de otros `user_id` de prueba no se tocan — pertenecen a otros usuarios).
- Se corre `scripts/seed-presupuesto.js --dry-run` primero, te muestro el plan completo (qué se borra, qué se inserta, categorías `es_fija` resultantes, saldo calculado), y solo después de tu confirmación explícita se corre sin `--dry-run`.
- Verificación final: correr `scripts/verify-presupuesto.js` y confirmar `Saldo disponible (agosto) = $271.114` usando la misma fórmula que `calculateMonthSummary` (pagado, filtrado por mes calendario de agosto).

**Cambios a los scripts existentes:**
- `datos_presupuesto.json` se reemplaza por el JSON exacto de tu mensaje (con las 3 fechas movidas a agosto según lo anterior).
- `seed-presupuesto.js` necesita: (1) un paso de limpieza de movimientos existentes del usuario para julio-septiembre 2026 antes de insertar, (2) dejar de insertar "Sueldo mensual" como movimiento y en su lugar hacer upsert del `recurring_income` + su movimiento materializado de agosto, (3) escribir `fixed_series_id` (uuid nuevo por serie: Luz, Agua, WOM, ENTEL, IPTV, Polla, Claude, Bupa, Gimnasio, Falabella-impuesto, Servicio-administración, Ahorro x2) en las filas `es_fijo: true` sin cuotas, y `installment_group_id`/`cuota_numero`/`cuota_total` en Zapatillas (2 de 6 → 5/6 este mes, sigue vía instalments no fixed_series_id ya que es cuota, ver nota) y Crédito auto (4/36).

  Nota sobre Zapatillas y Crédito auto: son ítems con cuotas dentro de una categoría fija (CMR Falabella, Cuotas/Crédito). Para que la lógica del punto C aplique, se les asigna `fixed_series_id` (son parte del ciclo de replicación mensual de su categoría) **y** `cuota_numero`/`cuota_total`, no `installment_group_id` (ese campo es para el mecanismo de cuotas "clásico", pre-generado en bloque, que es un mecanismo distinto y no correspondiente a categorías fijas). Esto es exactamente el caso que el punto C está diseñado para manejar.
- `verify-presupuesto.js` no necesita cambios de fondo, ya imprime lo necesario para confirmar.

## Fuera de alcance

- No se toca el mecanismo de `installment_group_id` (cuotas clásicas fuera de categorías fijas) — sigue igual.
- No se migran/tocan datos de otros usuarios de prueba (los otros dos `recurring_income` con distinto `user_id`).
- No se implementa swipe-actions (se descartó a favor del modal de detalle).
