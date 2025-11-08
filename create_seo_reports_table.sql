-- Create seo_reports table with user_uuid
CREATE TABLE IF NOT EXISTS public.seo_reports (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    user_uuid UUID,
    website_url VARCHAR(500) NOT NULL,
    overall_score INTEGER,
    analysis_data JSONB,
    email VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_seo_reports_uuid ON public.seo_reports USING btree (uuid);
CREATE INDEX IF NOT EXISTS idx_seo_reports_user_uuid ON public.seo_reports USING btree (user_uuid);
CREATE INDEX IF NOT EXISTS idx_seo_reports_created_at ON public.seo_reports USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_reports_website_url ON public.seo_reports USING btree (website_url);

-- Add foreign key constraint to link with users table
ALTER TABLE public.seo_reports
ADD CONSTRAINT fk_seo_reports_user_uuid
FOREIGN KEY (user_uuid) REFERENCES public.users(uuid) ON DELETE SET NULL;

-- Add comment to table
COMMENT ON TABLE public.seo_reports IS 'Stores SEO analysis reports with user association';
