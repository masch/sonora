-- Migration: 0008_payment_infrastructure
-- Adds: payment_provider, purchase_status, access_source, platform, currency, language enums
-- Adds: free, price, currency columns to experiences
-- Creates: purchases, experience_accesses tables
-- Alters: translations.lang to language enum

-- Create new enums
DO $$ BEGIN
  CREATE TYPE sonora.payment_provider AS ENUM ('mercadopago', 'stripe', 'paypal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sonora.purchase_status AS ENUM ('pending', 'approved', 'rejected', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sonora.access_source AS ENUM ('free', 'paid', 'restored');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sonora.platform AS ENUM ('ios', 'android', 'web');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sonora.currency AS ENUM ('ARS', 'USD', 'MXN', 'BRL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sonora.language AS ENUM ('en', 'es');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add columns to experiences table
ALTER TABLE sonora.experiences
  ADD COLUMN IF NOT EXISTS free boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS price integer,
  ADD COLUMN IF NOT EXISTS currency sonora.currency DEFAULT 'ARS';

-- Drop priceLabel if it still exists
ALTER TABLE sonora.experiences DROP COLUMN IF EXISTS price_label;

-- Create purchases table
CREATE TABLE IF NOT EXISTS sonora.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  experience_id uuid NOT NULL REFERENCES sonora.experiences(id) ON DELETE CASCADE,
  provider sonora.payment_provider NOT NULL,
  provider_payment_id text NOT NULL UNIQUE,
  status sonora.purchase_status NOT NULL DEFAULT 'pending',
  amount integer NOT NULL,
  currency sonora.currency NOT NULL DEFAULT 'ARS',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Create experience_accesses table
CREATE TABLE IF NOT EXISTS sonora.experience_accesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id uuid NOT NULL REFERENCES sonora.experiences(id) ON DELETE CASCADE,
  email text,
  source sonora.access_source NOT NULL,
  price_at_access integer,
  platform sonora.platform,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- Alter translations.lang to use language enum
-- Safe because existing values ('en', 'es') are valid in the enum
ALTER TABLE sonora.translations ALTER COLUMN lang TYPE sonora.language USING lang::sonora.language;
