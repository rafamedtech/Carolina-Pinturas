-- Rollback (pierde la bitácora; revertir antes el código que llama a recordAuditEvent):
--   DROP TABLE public.audit_events;
--   DROP FUNCTION private.audit_events_immutable();
-- Bitácora de cambios (CVR-02). Solo inserción: guarda la foto del registro
-- antes de editarlo o eliminarlo, sin cambiar la semántica de las tablas que lee CVR.
CREATE TABLE public.audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  entity_type VARCHAR(64) NOT NULL,
  entity_id TEXT NOT NULL,
  action VARCHAR(32) NOT NULL,
  actor_id UUID,
  actor_email TEXT NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  reason TEXT,
  effective_date DATE,
  source_type VARCHAR(64),
  source_id TEXT,
  snapshot JSONB NOT NULL,
  changes JSONB,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_events_pkey PRIMARY KEY (id),
  CONSTRAINT audit_events_action CHECK (action IN ('create', 'update', 'delete', 'void', 'reverse'))
);

CREATE INDEX audit_events_entity_idx ON public.audit_events(entity_type, entity_id, created_at);
CREATE INDEX audit_events_source_idx ON public.audit_events(source_type, source_id);
CREATE INDEX audit_events_created_at_idx ON public.audit_events(created_at);

CREATE SCHEMA IF NOT EXISTS private;
CREATE FUNCTION private.audit_events_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'La bitácora de cambios es inmutable'; END $$;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION private.audit_events_immutable();
CREATE TRIGGER audit_events_no_truncate BEFORE TRUNCATE ON public.audit_events FOR EACH STATEMENT EXECUTE FUNCTION private.audit_events_immutable();

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_events FROM anon, authenticated;
REVOKE ALL ON FUNCTION private.audit_events_immutable() FROM PUBLIC;
