-- ==============================================================================
-- TallyAI Cloud Database Schema (Supabase PostgreSQL)
-- Execute this script in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'Senior Accountant' CHECK (role IN ('CA', 'Firm Admin', 'Senior Accountant', 'Junior Auditor', 'SME Owner', 'Other')),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Index on email & role
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. Organization Settings Table
CREATE TABLE IF NOT EXISTS public.organization_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL DEFAULT 'Primary Enterprise Books',
    gstin TEXT NOT NULL DEFAULT '27AABCU9603R1ZM',
    tally_port INTEGER DEFAULT 9000,
    tally_host TEXT DEFAULT 'http://localhost:9000',
    financial_year TEXT DEFAULT '2025-2026',
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Vouchers / Transactions Table
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_number TEXT NOT NULL,
    voucher_type TEXT NOT NULL CHECK (voucher_type IN ('Purchase', 'Sales', 'Payment', 'Receipt', 'Journal', 'Contra')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    party_ledger TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    narration TEXT,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    confidence_overall NUMERIC(4, 2) DEFAULT 0.95,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON public.vouchers(date);
CREATE INDEX IF NOT EXISTS idx_vouchers_party ON public.vouchers(party_ledger);

-- 5. Audit Trail Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 6. OTP Verification Logs Table
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON public.otp_verifications(phone);

-- 7. Seed Initial Default Organization Settings
INSERT INTO public.organization_settings (company_name, gstin, tally_port, financial_year)
VALUES ('Stalwart Global Solutions Ltd.', '27AABCU9603R1ZM', 9000, '2025-2026')
ON CONFLICT DO NOTHING;

-- 8. Seed Default CA Profile
INSERT INTO public.profiles (email, full_name, phone, role)
VALUES ('ca.auditor@stalwartgroup.com', 'CA Vikram Malhotra (FCA)', '+919876543210', 'CA')
ON CONFLICT (email) DO NOTHING;

-- 9. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- 10. Permissive Public Policies for Web Application
CREATE POLICY "Public profiles can be read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public profiles can be inserted" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public profiles can be updated" ON public.profiles FOR UPDATE USING (true);

CREATE POLICY "Public settings read" ON public.organization_settings FOR SELECT USING (true);
CREATE POLICY "Public settings update" ON public.organization_settings FOR UPDATE USING (true);

CREATE POLICY "Public vouchers read" ON public.vouchers FOR SELECT USING (true);
CREATE POLICY "Public vouchers write" ON public.vouchers FOR ALL USING (true);

CREATE POLICY "Public audit logs read" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Public audit logs write" ON public.audit_logs FOR INSERT WITH CHECK (true);
