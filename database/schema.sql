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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_uuid);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);

-- =====================================================
-- SEARCHES TABLE (Search History)
-- =====================================================
CREATE TABLE IF NOT EXISTS searches (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    query VARCHAR(500),
    location VARCHAR(255),
    radius INTEGER,
    results_count INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_searches_user ON searches(user_uuid);
CREATE INDEX IF NOT EXISTS idx_searches_created ON searches(created_at DESC);

-- =====================================================
-- PLANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS plans (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    credits_monthly INTEGER NOT NULL,
    features JSONB DEFAULT '[]',
    is_popular BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plans_slug ON plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active);

-- =====================================================
-- USER CREDITS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_credits (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID UNIQUE REFERENCES users(uuid) ON DELETE CASCADE,
    credits_balance INTEGER DEFAULT 0,
    credits_used INTEGER DEFAULT 0,
    is_trial BOOLEAN DEFAULT true,
    trial_credits_given BOOLEAN DEFAULT false,
    use_own_keys BOOLEAN DEFAULT false,
    keys_valid BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_credits_user ON user_credits(user_uuid);

-- =====================================================
-- CREDIT TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    action_type VARCHAR(50),
    reference_uuid UUID,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_trans_user ON credit_transactions(user_uuid);
CREATE INDEX IF NOT EXISTS idx_credit_trans_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_trans_action ON credit_transactions(action_type);
CREATE INDEX IF NOT EXISTS idx_credit_trans_created ON credit_transactions(created_at DESC);

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
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    plan_uuid UUID REFERENCES plans(uuid),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMP,
    payment_provider VARCHAR(50),
    external_subscription_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_uuid);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    subscription_uuid UUID REFERENCES subscriptions(uuid),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_type VARCHAR(50),
    payment_provider VARCHAR(50),
    external_payment_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_uuid);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);

-- =====================================================
-- CAMPAIGN GROUPS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS campaign_groups (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#4F46E5',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaign_groups_user ON campaign_groups(user_uuid);

-- =====================================================
-- CAMPAIGNS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS campaigns (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    group_uuid UUID REFERENCES campaign_groups(uuid) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    leads_count INTEGER DEFAULT 0,
    target_industry VARCHAR(255),
    target_location VARCHAR(255),
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_uuid);
CREATE INDEX IF NOT EXISTS idx_campaigns_group ON campaigns(group_uuid);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- =====================================================
-- SAVED LEADS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS saved_leads (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    campaign_uuid UUID REFERENCES campaigns(uuid) ON DELETE SET NULL,
    place_id VARCHAR(255),
    business_name VARCHAR(500) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    website TEXT,
    email VARCHAR(255),
    rating DECIMAL(2,1),
    reviews_count INTEGER,
    business_type VARCHAR(255),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    google_maps_url TEXT,
    photo_url TEXT,
    opening_hours JSONB,
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost')),
    is_favorite BOOLEAN DEFAULT false,
    notes TEXT,
    tags JSONB DEFAULT '[]',
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    last_contacted TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_leads_user ON saved_leads(user_uuid);
CREATE INDEX IF NOT EXISTS idx_saved_leads_campaign ON saved_leads(campaign_uuid);
CREATE INDEX IF NOT EXISTS idx_saved_leads_status ON saved_leads(status);
CREATE INDEX IF NOT EXISTS idx_saved_leads_favorite ON saved_leads(is_favorite);
CREATE INDEX IF NOT EXISTS idx_saved_leads_place ON saved_leads(place_id);
CREATE INDEX IF NOT EXISTS idx_saved_leads_created ON saved_leads(created_at DESC);

-- =====================================================
-- AI DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_documents (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    lead_uuid UUID REFERENCES saved_leads(uuid) ON DELETE SET NULL,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('proposal', 'email', 'follow_up', 'custom')),
    title VARCHAR(500) NOT NULL,
    subject VARCHAR(500),
    content TEXT NOT NULL,
    template_uuid UUID,
    metadata JSONB,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_documents_user ON ai_documents(user_uuid);
CREATE INDEX IF NOT EXISTS idx_ai_documents_lead ON ai_documents(lead_uuid);
CREATE INDEX IF NOT EXISTS idx_ai_documents_type ON ai_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_ai_documents_created ON ai_documents(created_at DESC);

-- =====================================================
-- TEMPLATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS templates (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_uuid UUID REFERENCES users(uuid) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('proposal', 'email', 'follow_up', 'custom')),
    subject VARCHAR(500),
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_uuid);
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(template_type);

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
