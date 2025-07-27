-- Drop existing tables in reverse order of dependency to avoid foreign key conflicts
DROP TABLE IF EXISTS quote_items;
DROP TABLE IF EXISTS quotes;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS companies;

-- Table to store company information
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(255),
    email VARCHAR(255),
    website VARCHAR(255),
    address TEXT,
    siret VARCHAR(255),
    logo_path VARCHAR(255),
    -- Theme colors for quote documents
    theme_primary_color VARCHAR(7) DEFAULT '#2563eb',
    theme_secondary_color VARCHAR(7) DEFAULT '#64748b',
    theme_accent_color VARCHAR(7) DEFAULT '#059669',
    theme_text_color VARCHAR(7) DEFAULT '#1f2937'
);

-- Table to store user information
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super-admin', 'admin', 'user')),
    company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to store client information
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    address TEXT,
    phone VARCHAR(255),
    email VARCHAR(255),
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table to store quotes and invoices
CREATE TABLE quotes (
    id SERIAL PRIMARY KEY,
    quote_ref VARCHAR(255) UNIQUE NOT NULL,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('quote', 'invoice')),
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    total_ht NUMERIC(10, 2) NOT NULL,
    total_tva NUMERIC(10, 2) NOT NULL,
    total_ttc NUMERIC(10, 2) NOT NULL,
    deduction_prime NUMERIC(10, 2) DEFAULT 0,
    deduction_renov NUMERIC(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    due_date DATE,
    -- New fields for quote/invoice footer
    down_payment_text TEXT,
    iban VARCHAR(255),
    installer_ref VARCHAR(255),
    capacity_attestation_no VARCHAR(255),
    civil_liability_insurance VARCHAR(255)
);

-- Table to store items within a quote/invoice
CREATE TABLE quote_items (
    id SERIAL PRIMARY KEY,
    quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    tva_rate NUMERIC(5, 2) NOT NULL
);