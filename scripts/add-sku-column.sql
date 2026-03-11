-- Run this in Supabase SQL Editor BEFORE running the migration script
-- Dashboard → SQL Editor → New Query → Paste & Run

-- 1. Add SKU column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku text UNIQUE;

-- 2. Add index for fast SKU lookups (needed for Acut fulfillment)
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- 3. Ensure customers table has unique email constraint for upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customers_email_key'
    ) THEN
        ALTER TABLE customers ADD CONSTRAINT customers_email_key UNIQUE (email);
    END IF;
END $$;

-- 4. Allow anon key to insert customers (for migration script)
-- RLS policy for insert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'Allow insert for migration'
    ) THEN
        CREATE POLICY "Allow insert for migration" ON customers
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;
