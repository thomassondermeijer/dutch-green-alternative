-- The scraper flattened the source newsletter to text and dropped every
-- outbound link, so the generator had no study to cite and wrote none.
-- Citable sources are now captured separately from the prose, which is
-- truncated before it reaches the model.
--
-- Applied 2026-09-25.
alter table budmed_articles
  add column if not exists source_links jsonb not null default '[]'::jsonb;

comment on column budmed_articles.source_links is
  'Research links found in the source issue, resolved against PubMed: [{url, pmid, title, journal, year}]. Only allowlisted research domains; never the newsletter itself.';
