-- Garantía a nivel de base de datos contra la DOBLE RESERVA.
--
-- Índice único PARCIAL sobre (scheduledDate, scheduledTime, professionalId)
-- limitado a las reservas ACTIVAS (status <> 'CANCELLED'): dos turnos cancelados
-- no bloquean el slot, pero no pueden coexistir dos turnos activos en el mismo
-- horario con el mismo profesional. Prisma no expresa índices parciales en el
-- schema, por eso se crea con SQL crudo (ver nota en prisma/schema.prisma).
--
-- IMPORTANTE: esta migración NO modifica datos. Si existen duplicados activos
-- preexistentes, ABORTA con un mensaje claro que apunta al script de reparación
-- separado, explícito y auditable. La reparación NO se hace desde acá.

DO $$
DECLARE
  dup_groups integer;
BEGIN
  SELECT count(*) INTO dup_groups FROM (
    SELECT "scheduledDate", "scheduledTime", "professionalId"
    FROM "Turn"
    WHERE "status" <> 'CANCELLED'
      AND "scheduledDate"  IS NOT NULL
      AND "scheduledTime"  IS NOT NULL
      AND "professionalId" IS NOT NULL
    GROUP BY "scheduledDate", "scheduledTime", "professionalId"
    HAVING count(*) > 1
  ) d;

  IF dup_groups > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'Migración abortada: existen %s combinaciones (fecha, hora, profesional) con reservas ACTIVAS duplicadas. Esta migración no modifica datos. Revisá el reporte con "npm run db:duplicates:report" y reparalo de forma auditable con "npm run db:duplicates:repair -- --apply" antes de volver a migrar.',
        dup_groups
      ),
      ERRCODE = 'unique_violation';
  END IF;
END $$;

CREATE UNIQUE INDEX "Turn_active_slot_unique"
  ON "Turn" ("scheduledDate", "scheduledTime", "professionalId")
  WHERE "status" <> 'CANCELLED';
