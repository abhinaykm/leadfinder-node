-- =====================================================
-- LeadFinder Database Migration
-- Credits, Plans, Campaigns, and AI Tools Schema
-- =====================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. PLANS TABLE - Subscription Plans
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
-- 2. USER_CREDITS TABLE - User Credit Balances
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
-- 3. CREDIT_TRANSACTIONS TABLE - Credit Usage History
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
-- 4. SUBSCRIPTIONS TABLE - User Subscriptions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_uuid ON public.subscriptions(user_uuid);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- =====================================================
-- 5. PAYMENTS TABLE - Payment Records
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
-- 6. CAMPAIGN_GROUPS TABLE - Campaign Groups/Folders
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
-- 7. CAMPAIGNS TABLE - Lead Campaigns
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
-- 8. SAVED_LEADS TABLE - Leads Saved to Campaigns
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
-- 9. AI_DOCUMENTS TABLE - AI Generated Documents
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ai_documents (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() NOT NULL UNIQUE,
    user_uuid UUID NOT NULL REFERENCES public.users(uuid) ON DELETE CASCADE,
    lead_uuid UUID REFERENCES public.saved_leads(uuid) ON DELETE SET NULL,
    document_type VARCHAR(50) NOT NULL, -- 'proposal', 'email', 'follow_up'
    title VARCHAR(500),
    content TEXT NOT NULL,
    prompt_used TEXT,
    -- Lead context used for generation
    lead_context JSONB,
    -- Template info
    template_name VARCHAR(100),
    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, archived
    sent_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_documents_user_uuid ON public.ai_documents(user_uuid);
CREATE INDEX IF NOT EXISTS idx_ai_documents_lead_uuid ON public.ai_documents(lead_uuid);
CREATE INDEX IF NOT EXISTS idx_ai_documents_document_type ON public.ai_documents(document_type);

-- =====================================================
-- 10. CREDIT_COSTS TABLE - Action Credit Costs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.credit_costs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(100) NOT NULL UNIQUE,
    credits_required INTEGER NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Insert default credit costs
INSERT INTO public.credit_costs (action_type, credits_required, description) VALUES
('google_search', 10, 'Google Places search'),
('seo_analysis', 25, 'Website SEO analysis'),
('ai_proposal', 50, 'AI business proposal generation'),
('ai_email', 20, 'AI email generation'),
('ai_follow_up', 15, 'AI follow-up email generation'),
('lead_export', 5, 'Export leads to CSV/Excel'),
('bulk_email', 30, 'Bulk email sending')
ON CONFLICT (action_type) DO NOTHING;

-- =====================================================
-- 11. TEMPLATES TABLE - Email/Proposal Templates
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
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
        AND table_name IN ('user_credits', 'subscriptions', 'payments', 'campaign_groups',
                          'campaigns', 'saved_leads', 'ai_documents', 'templates', 'plans')
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I;
            CREATE TRIGGER update_%I_updated_at
            BEFORE UPDATE ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END;
$$;

-- Function to initialize user credits on signup
CREATE OR REPLACE FUNCTION initialize_user_credits()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_credits (user_uuid, credits_balance, is_trial, trial_credits_given)
    VALUES (NEW.uuid, 1000, true, true);

    INSERT INTO public.credit_transactions (user_uuid, transaction_type, amount, balance_after, action_type, description)
    VALUES (NEW.uuid, 'credit', 1000, 1000, 'trial', 'Welcome bonus - 1000 trial credits');

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-create user_credits on user creation
DROP TRIGGER IF EXISTS create_user_credits ON public.users;
CREATE TRIGGER create_user_credits
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION initialize_user_credits();

-- Function to update campaign leads count
CREATE OR REPLACE FUNCTION update_campaign_leads_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.campaigns SET leads_count = leads_count + 1 WHERE uuid = NEW.campaign_uuid;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.campaigns SET leads_count = leads_count - 1 WHERE uuid = OLD.campaign_uuid;
    ELSIF TG_OP = 'UPDATE' AND OLD.campaign_uuid IS DISTINCT FROM NEW.campaign_uuid THEN
        IF OLD.campaign_uuid IS NOT NULL THEN
            UPDATE public.campaigns SET leads_count = leads_count - 1 WHERE uuid = OLD.campaign_uuid;
        END IF;
        IF NEW.campaign_uuid IS NOT NULL THEN
            UPDATE public.campaigns SET leads_count = leads_count + 1 WHERE uuid = NEW.campaign_uuid;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_leads_count ON public.saved_leads;
CREATE TRIGGER update_leads_count
AFTER INSERT OR UPDATE OR DELETE ON public.saved_leads
FOR EACH ROW
EXECUTE FUNCTION update_campaign_leads_count();

-- =====================================================
-- Initialize credits for existing users
-- =====================================================
INSERT INTO public.user_credits (user_uuid, credits_balance, is_trial, trial_credits_given)
SELECT uuid, 1000, true, true FROM public.users
WHERE uuid NOT IN (SELECT user_uuid FROM public.user_credits)
ON CONFLICT (user_uuid) DO NOTHING;

-- Add trial credit transactions for existing users
INSERT INTO public.credit_transactions (user_uuid, transaction_type, amount, balance_after, action_type, description)
SELECT uuid, 'credit', 1000, 1000, 'trial', 'Welcome bonus - 1000 trial credits'
FROM public.users
WHERE uuid NOT IN (
    SELECT DISTINCT user_uuid FROM public.credit_transactions WHERE action_type = 'trial'
);

-- =====================================================
-- GRANT PERMISSIONS (adjust as needed)
-- =====================================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
