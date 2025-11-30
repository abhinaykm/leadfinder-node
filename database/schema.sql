-- =====================================================
-- LeadFinder Database Schema
-- Run this file to create all tables, functions, and seed data
-- Command: psql -U postgres -d gorilla -f database/schema.sql
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- DROP EXISTING TABLES (if recreating)
-- Uncomment these lines if you want to reset the database
-- =====================================================
-- DROP TABLE IF EXISTS credit_transactions CASCADE;
-- DROP TABLE IF EXISTS user_credits CASCADE;
-- DROP TABLE IF EXISTS user_api_keys CASCADE;
-- DROP TABLE IF EXISTS payments CASCADE;
-- DROP TABLE IF EXISTS subscriptions CASCADE;
-- DROP TABLE IF EXISTS saved_leads CASCADE;
-- DROP TABLE IF EXISTS campaigns CASCADE;
-- DROP TABLE IF EXISTS campaign_groups CASCADE;
-- DROP TABLE IF EXISTS ai_documents CASCADE;
-- DROP TABLE IF EXISTS templates CASCADE;
-- DROP TABLE IF EXISTS credit_costs CASCADE;
-- DROP TABLE IF EXISTS plans CASCADE;
-- DROP TABLE IF EXISTS searches CASCADE;
-- DROP TABLE IF EXISTS tokens CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    provider VARCHAR(50) DEFAULT 'local',
    provider_id VARCHAR(255),
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);

-- =====================================================
-- TOKENS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tokens (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    token TEXT NOT NULL,
    token_type VARCHAR(50) DEFAULT 'auth',
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   
    updated_at TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_uuid);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);

-- =====================================================
-- SEARCHES TABLE (Search History)
-- =====================================================
CREATE TABLE IF NOT EXISTS searches (
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_uuid UUID NOT NULL,
    query VARCHAR(500) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    radius INTEGER NOT NULL,
    category VARCHAR(50),
    results JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_searches_user ON searches(user_uuid);
CREATE INDEX IF NOT EXISTS idx_searches_created ON searches(created_at DESC);

-- =====================================================
-- PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.plans (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    credits INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_period VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
    features JSONB, -- Array of feature strings
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Insert default plans
INSERT INTO public.plans (name, slug, description, credits, price, features, sort_order) VALUES
('Trial', 'trial', 'Free trial credits for new users', 1000, 0.00, '["1000 Credits", "Google Search", "SEO Analysis", "Save Leads", "Basic Support"]', 0),
('Starter', 'starter', 'Perfect for individuals and small teams', 3000, 19.00, '["3000 Credits/month", "Google Search", "SEO Analysis", "Campaign Management", "AI Writing Tools", "Email Support"]', 1),
('Agency', 'agency', 'Best for growing agencies', 5000, 34.00, '["5000 Credits/month", "Everything in Starter", "Priority Support", "Advanced Analytics", "Team Collaboration"]', 2),
('Enterprise', 'enterprise', 'For large organizations', 10000, 59.00, '["10000 Credits/month", "Everything in Agency", "Dedicated Support", "Custom Integrations", "API Access", "White Label Options"]', 3)
ON CONFLICT (slug) DO NOTHING;


-- =====================================================
-- USER CREDITS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_credits (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    user_uuid UUID NOT NULL REFERENCES public.users(uuid) ON DELETE CASCADE,
    credits_balance INTEGER DEFAULT 0,
    credits_used INTEGER DEFAULT 0,
    is_trial BOOLEAN DEFAULT true,
    trial_credits_given BOOLEAN DEFAULT false,
    -- BYOK (Bring Your Own Keys) fields
    use_own_keys BOOLEAN DEFAULT false,
    google_api_key VARCHAR(255),
    openai_api_key VARCHAR(255),
    keys_valid BOOLEAN DEFAULT true,
    keys_last_checked TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT unique_user_credits UNIQUE (user_uuid)
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user_uuid ON public.user_credits(user_uuid);

-- =====================================================
-- CREDIT TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    user_uuid UUID NOT NULL REFERENCES public.users(uuid) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'debit', 'credit', 'purchase', 'refund', 'trial'
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    action_type VARCHAR(100), -- 'google_search', 'seo_analysis', 'ai_proposal', 'ai_email', 'subscription'
    description TEXT,
    reference_uuid UUID, -- Reference to search/lead/document UUID
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_uuid ON public.credit_transactions(user_uuid);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_action_type ON public.credit_transactions(action_type);


-- =====================================================
-- CREDIT COSTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS credit_costs (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(50) UNIQUE NOT NULL,
    credits_required INTEGER NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- USER API KEYS TABLE (BYOK - Bring Your Own Keys)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_api_keys (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    key_type VARCHAR(50) NOT NULL,
    encrypted_key TEXT NOT NULL,
    is_valid BOOLEAN DEFAULT true,
    last_validated TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_uuid, key_type)
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_uuid);

-- =====================================================
-- SUBSCRIPTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subscriptions (
     id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    user_uuid UUID NOT NULL REFERENCES public.users(uuid) ON DELETE CASCADE,
    plan_uuid UUID NOT NULL REFERENCES public.plans(uuid) ON DELETE RESTRICT,
    status VARCHAR(50) DEFAULT 'active', -- active, cancelled, expired, paused
    payment_provider VARCHAR(50), -- stripe, razorpay, paypal
    payment_provider_subscription_id VARCHAR(255),
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_uuid);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    user_uuid UUID NOT NULL REFERENCES public.users(uuid) ON DELETE CASCADE,
    subscription_uuid UUID REFERENCES public.subscriptions(uuid) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, refunded
    payment_provider VARCHAR(50),
    payment_provider_payment_id VARCHAR(255),
    payment_method VARCHAR(50), -- card, upi, netbanking
    receipt_url VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_user_uuid ON public.payments(user_uuid);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
-- =====================================================
-- CAMPAIGN GROUPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.campaign_groups (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    user_uuid UUID NOT NULL REFERENCES public.users(uuid) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color code
    icon VARCHAR(50) DEFAULT 'folder',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaign_groups_user_uuid ON public.campaign_groups(user_uuid);


-- =====================================================
-- CAMPAIGNS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    user_uuid UUID NOT NULL REFERENCES public.users(uuid) ON DELETE CASCADE,
    group_uuid UUID REFERENCES public.campaign_groups(uuid) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active', -- active, paused, completed, archived
    color VARCHAR(7) DEFAULT '#10B981',
    tags JSONB, -- Array of tags
    metadata JSONB,
    leads_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_uuid ON public.campaigns(user_uuid);
CREATE INDEX IF NOT EXISTS idx_campaigns_group_uuid ON public.campaigns(group_uuid);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);


-- =====================================================
-- SAVED LEADS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.saved_leads (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    user_uuid UUID NOT NULL REFERENCES public.users(uuid) ON DELETE CASCADE,
    campaign_uuid UUID REFERENCES public.campaigns(uuid) ON DELETE SET NULL,
    search_uuid UUID REFERENCES public.searches(uuid) ON DELETE SET NULL,
    -- Lead Details
    place_id VARCHAR(255),
    business_name VARCHAR(500) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    website VARCHAR(500),
    email VARCHAR(255),
    rating DECIMAL(2,1),
    total_ratings INTEGER,
    business_type VARCHAR(100),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    -- Additional Data
    opening_hours JSONB,
    photos JSONB,
    reviews JSONB,
    -- Status & Notes
    status VARCHAR(50) DEFAULT 'new', -- new, contacted, qualified, converted, lost
    notes TEXT,
    tags JSONB,
    custom_fields JSONB,
    -- Contact tracking
    last_contacted_at TIMESTAMP,
    contact_count INTEGER DEFAULT 0,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_leads_user_uuid ON public.saved_leads(user_uuid);
CREATE INDEX IF NOT EXISTS idx_saved_leads_campaign_uuid ON public.saved_leads(campaign_uuid);
CREATE INDEX IF NOT EXISTS idx_saved_leads_status ON public.saved_leads(status);
CREATE INDEX IF NOT EXISTS idx_saved_leads_place_id ON public.saved_leads(place_id);
CREATE INDEX IF NOT EXISTS idx_saved_leads_is_favorite ON public.saved_leads(is_favorite);
-- =====================================================
-- AI DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_documents (
     id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    user_uuid UUID NOT NULL REFERENCES public.users(uuid) ON DELETE CASCADE,
    lead_uuid UUID REFERENCES public.saved_leads(uuid) ON DELETE SET NULL,
    document_type VARCHAR(50) NOT NULL, -- 'proposal', 'email', 'follow_up'
    title VARCHAR(500),
    content TEXT NOT NULL,
    prompt_used TEXT,
    lead_context JSONB,
    template_name VARCHAR(100),
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, archived
    sent_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_documents_user ON ai_documents(user_uuid);
CREATE INDEX IF NOT EXISTS idx_ai_documents_lead ON ai_documents(lead_uuid);
CREATE INDEX IF NOT EXISTS idx_ai_documents_type ON ai_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_ai_documents_created ON ai_documents(created_at DESC);

-- =====================================================
-- TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.templates (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    user_uuid UUID REFERENCES public.users(uuid) ON DELETE CASCADE, -- NULL for system templates
    template_type VARCHAR(50) NOT NULL, -- 'proposal', 'email', 'follow_up'
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500), -- For emails
    content TEXT NOT NULL,
    variables JSONB, -- Available variables like {{business_name}}, {{owner_name}}
    is_system BOOLEAN DEFAULT false, -- System-provided templates
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_templates_user_uuid ON public.templates(user_uuid);
CREATE INDEX IF NOT EXISTS idx_templates_template_type ON public.templates(template_type);


-- Insert default system templates
INSERT INTO public.templates (template_type, name, subject, content, variables, is_system) VALUES
('email', 'Introduction Email', 'Partnership Opportunity for {{business_name}}',
'Dear {{business_name}} Team,

I came across your business and was impressed by your services. I believe there''s a great opportunity for us to work together.

{{custom_message}}

I''d love to schedule a quick call to discuss how we can help grow your business.

Best regards,
{{sender_name}}',
'["business_name", "custom_message", "sender_name"]', true),

('proposal', 'Business Proposal', NULL,
'# Business Proposal for {{business_name}}

## Executive Summary
{{executive_summary}}

## About Our Services
{{services_description}}

## Proposed Solution
{{proposed_solution}}

## Pricing
{{pricing_details}}

## Next Steps
{{next_steps}}

---
Prepared by: {{sender_name}}
Date: {{date}}',
'["business_name", "executive_summary", "services_description", "proposed_solution", "pricing_details", "next_steps", "sender_name", "date"]', true),

('follow_up', 'Follow-up Email', 'Following up - {{business_name}}',
'Hi {{contact_name}},

I wanted to follow up on my previous message regarding {{subject}}.

{{follow_up_message}}

Looking forward to hearing from you.

Best,
{{sender_name}}',
'["contact_name", "business_name", "subject", "follow_up_message", "sender_name"]', true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- SEO REPORTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS seo_reports (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    lead_uuid UUID REFERENCES saved_leads(uuid) ON DELETE SET NULL,
    url TEXT NOT NULL,
    overall_score INTEGER,
    performance_score INTEGER,
    seo_score INTEGER,
    accessibility_score INTEGER,
    best_practices_score INTEGER,
    issues JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seo_reports_user ON seo_reports(user_uuid);
CREATE INDEX IF NOT EXISTS idx_seo_reports_lead ON seo_reports(lead_uuid);
CREATE INDEX IF NOT EXISTS idx_seo_reports_created ON seo_reports(created_at DESC);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update campaign leads count
CREATE OR REPLACE FUNCTION update_campaign_leads_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE campaigns SET leads_count = leads_count + 1 WHERE uuid = NEW.campaign_uuid;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE campaigns SET leads_count = leads_count - 1 WHERE uuid = OLD.campaign_uuid;
    ELSIF TG_OP = 'UPDATE' AND OLD.campaign_uuid IS DISTINCT FROM NEW.campaign_uuid THEN
        IF OLD.campaign_uuid IS NOT NULL THEN
            UPDATE campaigns SET leads_count = leads_count - 1 WHERE uuid = OLD.campaign_uuid;
        END IF;
        IF NEW.campaign_uuid IS NOT NULL THEN
            UPDATE campaigns SET leads_count = leads_count + 1 WHERE uuid = NEW.campaign_uuid;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Function to initialize user credits on signup
CREATE OR REPLACE FUNCTION initialize_user_credits()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_credits (user_uuid, credits_balance, is_trial, trial_credits_given)
    VALUES (NEW.uuid, 1000, true, true)
    ON CONFLICT (user_uuid) DO NOTHING;

    INSERT INTO credit_transactions (user_uuid, transaction_type, amount, balance_after, action_type, description)
    VALUES (NEW.uuid, 'credit', 1000, 1000, 'trial', 'Welcome bonus - 1000 trial credits');

    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Updated at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_credits_updated_at ON user_credits;
CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON user_credits
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plans_updated_at ON plans;
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaign_groups_updated_at ON campaign_groups;
CREATE TRIGGER update_campaign_groups_updated_at BEFORE UPDATE ON campaign_groups
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_leads_updated_at ON saved_leads;
CREATE TRIGGER update_saved_leads_updated_at BEFORE UPDATE ON saved_leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_documents_updated_at ON ai_documents;
CREATE TRIGGER update_ai_documents_updated_at BEFORE UPDATE ON ai_documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_costs_updated_at ON credit_costs;
CREATE TRIGGER update_credit_costs_updated_at BEFORE UPDATE ON credit_costs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_api_keys_updated_at ON user_api_keys;
CREATE TRIGGER update_user_api_keys_updated_at BEFORE UPDATE ON user_api_keys
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Campaign leads count trigger
DROP TRIGGER IF EXISTS trigger_update_campaign_leads_count ON saved_leads;
CREATE TRIGGER trigger_update_campaign_leads_count
AFTER INSERT OR UPDATE OR DELETE ON saved_leads
FOR EACH ROW EXECUTE FUNCTION update_campaign_leads_count();

-- Auto-initialize credits for new users (optional - code also handles this)
-- DROP TRIGGER IF EXISTS trigger_initialize_user_credits ON users;
-- CREATE TRIGGER trigger_initialize_user_credits
-- AFTER INSERT ON users
-- FOR EACH ROW EXECUTE FUNCTION initialize_user_credits();

-- =====================================================
-- SEED DATA - PLANS
-- =====================================================
INSERT INTO plans (name, slug, description, price_monthly, price_yearly, credits_monthly, features, is_popular, sort_order)
VALUES
(
    'Starter',
    'starter',
    'Perfect for freelancers and small agencies getting started',
    19.00,
    190.00,
    3000,
    '[
        "3,000 credits/month",
        "Google Places Search",
        "Basic SEO Analysis",
        "Save up to 500 leads",
        "5 Campaigns",
        "Email templates",
        "Email support"
    ]'::jsonb,
    false,
    1
),
(
    'Agency',
    'agency',
    'Ideal for growing agencies with multiple clients',
    34.00,
    340.00,
    5000,
    '[
        "5,000 credits/month",
        "Google Places Search",
        "Advanced SEO Analysis",
        "Unlimited leads",
        "Unlimited Campaigns",
        "AI Proposal Generator",
        "AI Email Writer",
        "Custom templates",
        "Priority support"
    ]'::jsonb,
    true,
    2
),
(
    'Enterprise',
    'enterprise',
    'For large teams and agencies with high-volume needs',
    59.00,
    590.00,
    10000,
    '[
        "10,000 credits/month",
        "Everything in Agency",
        "Bulk lead export",
        "API access",
        "Team collaboration",
        "White-label reports",
        "Dedicated account manager",
        "Custom integrations"
    ]'::jsonb,
    false,
    3
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    credits_monthly = EXCLUDED.credits_monthly,
    features = EXCLUDED.features,
    is_popular = EXCLUDED.is_popular,
    sort_order = EXCLUDED.sort_order;

-- =====================================================
-- SEED DATA - CREDIT COSTS
-- =====================================================
INSERT INTO credit_costs (action_type, credits_required, description)
VALUES
    ('google_search', 5, 'Google Places nearby search'),
    ('place_details', 2, 'Get detailed place information'),
    ('seo_analysis', 10, 'Full SEO analysis of a website'),
    ('ai_proposal', 15, 'Generate AI business proposal'),
    ('ai_email', 5, 'Generate AI email'),
    ('ai_custom', 10, 'Generate custom AI content'),
    ('screenshot', 3, 'Capture website screenshot'),
    ('export_leads', 1, 'Export lead to CSV/Excel')
ON CONFLICT (action_type) DO UPDATE SET
    credits_required = EXCLUDED.credits_required,
    description = EXCLUDED.description;

-- =====================================================
-- SEED DATA - SYSTEM TEMPLATES
-- =====================================================
INSERT INTO templates (user_uuid, name, template_type, subject, content, is_system, variables)
VALUES
(
    NULL,
    'Professional Introduction Email',
    'email',
    'Partnership Opportunity for {{business_name}}',
    E'Dear {{contact_name}},\n\nI hope this email finds you well. I came across {{business_name}} and was impressed by your work in the {{business_type}} industry.\n\nI am reaching out because I believe there may be an opportunity for us to collaborate. Our services have helped similar businesses in your area achieve significant growth.\n\nI would love to schedule a brief call to discuss how we might be able to help {{business_name}} reach its goals.\n\nBest regards,\n{{sender_name}}',
    true,
    '["business_name", "contact_name", "business_type", "sender_name"]'::jsonb
),
(
    NULL,
    'Follow-up Email',
    'follow_up',
    'Following up - {{business_name}}',
    E'Hi {{contact_name}},\n\nI wanted to follow up on my previous email regarding a potential partnership with {{business_name}}.\n\nI understand you are busy, but I believe our services could provide significant value to your business. Would you have 15 minutes this week for a quick call?\n\nLooking forward to hearing from you.\n\nBest regards,\n{{sender_name}}',
    true,
    '["business_name", "contact_name", "sender_name"]'::jsonb
),
(
    NULL,
    'Business Proposal Template',
    'proposal',
    NULL,
    E'# Business Proposal for {{business_name}}\n\n## Executive Summary\nWe are pleased to present this proposal for {{business_name}}. Based on our analysis of your current online presence and market position, we have identified several opportunities for growth.\n\n## Current Situation\n{{business_name}} is a {{business_type}} located at {{address}}. With a rating of {{rating}} stars from {{reviews_count}} reviews, you have established a solid reputation.\n\n## Our Recommendations\n1. **Website Optimization** - Improve your online visibility\n2. **Local SEO** - Enhance your Google presence\n3. **Review Management** - Leverage your positive reviews\n\n## Investment\nWe offer flexible packages tailored to your needs and budget.\n\n## Next Steps\nWe would love to discuss this proposal in detail. Please contact us at your earliest convenience.\n\nBest regards,\n{{sender_name}}',
    true,
    '["business_name", "business_type", "address", "rating", "reviews_count", "sender_name"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify the setup

-- Check all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check plans were inserted
SELECT name, slug, price_monthly, credits_monthly FROM plans ORDER BY sort_order;

-- Check credit costs were inserted
SELECT action_type, credits_required, description FROM credit_costs ORDER BY action_type;

-- Check templates were inserted
SELECT name, template_type, is_system FROM templates WHERE is_system = true;

-- =====================================================
-- DONE!
-- =====================================================
-- Database schema created successfully.
--
-- Tables created:
--   - users
--   - tokens
--   - searches
--   - plans
--   - user_credits
--   - credit_transactions
--   - credit_costs
--   - user_api_keys
--   - subscriptions
--   - payments
--   - campaign_groups
--   - campaigns
--   - saved_leads
--   - ai_documents
--   - templates
--   - seo_reports
--
-- Functions created:
--   - update_updated_at_column()
--   - update_campaign_leads_count()
--   - initialize_user_credits()
--
-- Seed data inserted:
--   - 3 Plans (Starter, Agency, Enterprise)
--   - 8 Credit costs
--   - 3 System templates
-- =====================================================
