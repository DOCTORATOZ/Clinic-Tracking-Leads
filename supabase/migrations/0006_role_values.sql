-- PostgreSQL makes enum values available only after this migration commits.
-- Keep this isolated so the following Role Model migration can safely use them.
alter type public.app_role add value if not exists 'care_coordinator';
alter type public.app_role add value if not exists 'clinic_admin';
