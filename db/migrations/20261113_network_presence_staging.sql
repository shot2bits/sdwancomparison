-- PREPARED ONLY. Do not apply to production without explicit approval.
-- Harry's workbook and published-source intake share one versioned, auditable path.
BEGIN;
CREATE TABLE IF NOT EXISTS network_presence_import_batches (
 id text PRIMARY KEY, origin text NOT NULL CHECK (origin IN ('harry_workbook','published_source')),
 file_name text NOT NULL, file_sha256 text NOT NULL, schema_version text NOT NULL,
 imported_by text NOT NULL, imported_at timestamptz NOT NULL DEFAULT now(),
 raw_rows jsonb NOT NULL, validation_errors jsonb NOT NULL DEFAULT '[]',
 status text NOT NULL DEFAULT 'staged' CHECK(status IN ('staged','reviewed','rejected')),
 UNIQUE(file_sha256,schema_version)
);
CREATE TABLE IF NOT EXISTS network_presence_sources (
 id text PRIMARY KEY, url text NOT NULL, publisher text NOT NULL,
 checked_at timestamptz NOT NULL, source_updated_at date,
 review_due_at timestamptz NOT NULL, original_metadata jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS network_presence_record_versions (
 record_id text NOT NULL, revision integer NOT NULL CHECK(revision>0),
 batch_id text NOT NULL REFERENCES network_presence_import_batches(id),
 source_id text REFERENCES network_presence_sources(id), provider_id text NOT NULL,
 service_kind text NOT NULL CHECK(service_kind IN ('sase_pop','cloud_edge','government_edge_region','geo_localised_ip_not_physical_pop','cloud_compute_region','cloud_on_ramp')),
 city text NOT NULL, country_code text NOT NULL, latitude double precision, longitude double precision,
 coordinate_accuracy text NOT NULL CHECK(coordinate_accuracy IN ('approximate_city','source_coordinate','unplaced','country_only')),
 source_status text NOT NULL, review_status text NOT NULL DEFAULT 'staged' CHECK(review_status IN ('staged','approved','rejected','superseded')),
 checked_at timestamptz, review_due_at timestamptz,
 reviewer text, reviewed_at timestamptz, original_row jsonb NOT NULL, canonical_record jsonb NOT NULL,
 PRIMARY KEY(record_id,revision), CHECK((latitude IS NULL)=(longitude IS NULL)),
 CHECK(latitude IS NULL OR latitude BETWEEN -85 AND 85), CHECK(longitude IS NULL OR longitude BETWEEN -180 AND 180),
 CHECK(review_status<>'approved' OR (reviewer IS NOT NULL AND reviewed_at IS NOT NULL AND source_id IS NOT NULL))
);
-- Staging and private authoring are not exposed to public or anonymous DB roles.
ALTER TABLE network_presence_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_presence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_presence_record_versions ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE VIEW network_presence_current AS
 SELECT DISTINCT ON(record_id) * FROM network_presence_record_versions
 WHERE review_status='approved' ORDER BY record_id,revision DESC;
COMMIT;
