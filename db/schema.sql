-- SMART ITMS Database Schema
-- PostgreSQL

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  emp_no VARCHAR(50),
  role VARCHAR(100) NOT NULL DEFAULT 'Requester',
  must_change_pw BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  no VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  designation VARCHAR(255),
  manager VARCHAR(255),
  doj DATE,
  dol DATE,
  dept VARCHAR(100),
  location VARCHAR(255),
  email VARCHAR(255),
  mobile VARCHAR(50),
  tel VARCHAR(50),
  ext VARCHAR(20),
  status VARCHAR(20) DEFAULT 'Active',
  role VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(50) PRIMARY KEY,
  subject VARCHAR(500) NOT NULL,
  description TEXT,
  requester VARCHAR(50),
  dept VARCHAR(100),
  type VARCHAR(100),
  mode VARCHAR(100),
  category VARCHAR(255),
  sub VARCHAR(255),
  item VARCHAR(255),
  impact VARCHAR(50),
  urgency VARCHAR(50),
  priority VARCHAR(50),
  level VARCHAR(50),
  group_name VARCHAR(100),
  tech VARCHAR(255),
  asset VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT NOW(),
  respond_by TIMESTAMP,
  due_by TIMESTAMP,
  first_resp TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  resolution TEXT,
  closure VARCHAR(100),
  reopened INT DEFAULT 0,
  pending_with VARCHAR(255),
  problem VARCHAR(50),
  change_ref VARCHAR(50),
  solution VARCHAR(50),
  desk VARCHAR(100),
  manager VARCHAR(50),
  manager_name VARCHAR(255),
  notes JSONB DEFAULT '[]',
  work JSONB DEFAULT '[]',
  tasks JSONB DEFAULT '[]',
  approvals JSONB DEFAULT '[]',
  hist JSONB DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS hardware (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(100),
  subtype VARCHAR(255),
  description TEXT,
  comp_name VARCHAR(255),
  serial VARCHAR(255),
  purchase_date DATE,
  price NUMERIC(12,2),
  vendor VARCHAR(255),
  condition VARCHAR(50),
  status VARCHAR(50) DEFAULT 'In Stock',
  holder VARCHAR(50),
  issued_date DATE,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS software (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(100),
  sub_type VARCHAR(100),
  vendor VARCHAR(255),
  purchase_date DATE,
  expiry DATE,
  qty INT DEFAULT 0,
  unit_price NUMERIC(12,2),
  currency VARCHAR(10),
  serial_no VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consumables (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(100),
  subtype VARCHAR(100),
  brand VARCHAR(255),
  model VARCHAR(255),
  description TEXT,
  uom VARCHAR(20),
  reorder INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consumable_purchases (
  id VARCHAR(50) PRIMARY KEY,
  item_id VARCHAR(50) REFERENCES consumables(id),
  date DATE,
  qty INT,
  price NUMERIC(12,2),
  vat NUMERIC(5,2),
  total NUMERIC(12,2),
  vendor VARCHAR(255),
  po_no VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consumable_issues (
  id VARCHAR(50) PRIMARY KEY,
  item_id VARCHAR(50) REFERENCES consumables(id),
  date DATE,
  emp_no VARCHAR(50),
  dept VARCHAR(100),
  qty INT,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(50),
  dept VARCHAR(100),
  requester VARCHAR(50),
  items JSONB,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id VARCHAR(50) PRIMARY KEY,
  po_no VARCHAR(50) UNIQUE,
  vendor VARCHAR(255),
  approval VARCHAR(50),
  invoice VARCHAR(50),
  lines JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grns (
  id VARCHAR(50) PRIMARY KEY,
  grn_no VARCHAR(50) UNIQUE,
  po_no VARCHAR(50),
  date DATE,
  lines JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(50) PRIMARY KEY,
  po_no VARCHAR(50),
  grn_no VARCHAR(50),
  date DATE,
  due_date DATE,
  vendor VARCHAR(255),
  status VARCHAR(50),
  excl NUMERIC(12,2),
  vat NUMERIC(12,2),
  total NUMERIC(12,2),
  lines JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255),
  currency VARCHAR(10),
  contact VARCHAR(255),
  email VARCHAR(255),
  phone1 VARCHAR(50),
  phone2 VARCHAR(50),
  terms_id VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS amcs (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255),
  vendor_id VARCHAR(50),
  contact VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  start DATE,
  end DATE,
  sla TEXT,
  freq VARCHAR(50),
  cost NUMERIC(12,2),
  terms VARCHAR(50),
  coverage TEXT,
  exclusions TEXT,
  invoice VARCHAR(255),
  inv_no VARCHAR(50),
  inv_date DATE,
  gl VARCHAR(20),
  link TEXT,
  notes TEXT,
  assets JSONB,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255),
  vendor VARCHAR(255),
  type VARCHAR(100),
  start DATE,
  end DATE,
  value NUMERIC(12,2),
  owner VARCHAR(255),
  assets JSONB,
  status VARCHAR(50),
  inv_no VARCHAR(50),
  inv_date DATE,
  gl VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255),
  category VARCHAR(100),
  type VARCHAR(100),
  brand VARCHAR(100),
  model VARCHAR(100),
  uom VARCHAR(20),
  price NUMERIC(12,2),
  gl VARCHAR(20),
  vendor VARCHAR(255),
  description TEXT,
  active VARCHAR(10) DEFAULT 'Yes',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_jv (
  id VARCHAR(50) PRIMARY KEY,
  at TIMESTAMP,
  month VARCHAR(7),
  no VARCHAR(20),
  type VARCHAR(50),
  ref VARCHAR(50),
  description TEXT,
  total NUMERIC(12,2),
  lines JSONB,
  paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_expenses (
  id VARCHAR(50) PRIMARY KEY,
  emp_no VARCHAR(50),
  date DATE,
  category VARCHAR(100),
  description TEXT,
  amount NUMERIC(12,2),
  status VARCHAR(50),
  approver VARCHAR(50),
  paid_at DATE,
  at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_payments (
  id VARCHAR(50) PRIMARY KEY,
  po_no VARCHAR(50),
  vendor VARCHAR(255),
  amount NUMERIC(12,2),
  date DATE,
  mode VARCHAR(50),
  ref VARCHAR(255),
  at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_coa (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS finance_catgl (
  category VARCHAR(100) PRIMARY KEY,
  gl_code VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS finance_depruns (
  month VARCHAR(7) PRIMARY KEY,
  ran_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_seen (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB
);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  at TIMESTAMP DEFAULT NOW(),
  area VARCHAR(100),
  event TEXT,
  ref VARCHAR(100),
  by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS notif_log (
  id VARCHAR(50) PRIMARY KEY,
  at TIMESTAMP DEFAULT NOW(),
  channel VARCHAR(50),
  to_addr VARCHAR(255),
  subject VARCHAR(500),
  body TEXT
);

CREATE TABLE IF NOT EXISTS email_log (
  id VARCHAR(50) PRIMARY KEY,
  at TIMESTAMP DEFAULT NOW(),
  to_addr VARCHAR(255),
  subject VARCHAR(500),
  body TEXT,
  status VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS email_config (
  id INT PRIMARY KEY DEFAULT 1,
  service VARCHAR(50),
  public_key VARCHAR(255),
  service_id VARCHAR(255),
  template_id VARCHAR(255),
  smtp_host VARCHAR(255),
  smtp_port INT,
  smtp_user VARCHAR(255),
  smtp_pass VARCHAR(255),
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  notify_on_request VARCHAR(10),
  notify_on_resolve VARCHAR(10),
  notify_on_major_incident VARCHAR(10),
  notify_manager VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS sso_config (
  id INT PRIMARY KEY DEFAULT 1,
  provider VARCHAR(50),
  authority VARCHAR(500),
  client_id VARCHAR(255),
  client_secret VARCHAR(255),
  redirect_uri VARCHAR(500),
  scope VARCHAR(255),
  enforce_mfa VARCHAR(10),
  auto_provision VARCHAR(10)
);

CREATE TABLE IF NOT EXISTS sso_log (
  id VARCHAR(50) PRIMARY KEY,
  at TIMESTAMP DEFAULT NOW(),
  event VARCHAR(255),
  status VARCHAR(50),
  by VARCHAR(255)
);

-- Seed default COA
INSERT INTO finance_coa (code, name, type) VALUES
  ('1110', 'Cash & Bank', 'Asset'),
  ('1410', 'Inventory - Consumables', 'Asset'),
  ('1430', 'VAT Input', 'Asset'),
  ('1510', 'IT Hardware', 'Asset'),
  ('1520', 'Software & Licences', 'Asset'),
  ('1590', 'Accumulated Depreciation', 'Asset'),
  ('2110', 'Accounts Payable', 'Liability'),
  ('5110', 'Staff Costs', 'Expense'),
  ('5220', 'Consumables Consumed', 'Expense'),
  ('5230', 'Maintenance & AMC', 'Expense'),
  ('5240', 'Software & Licences', 'Expense'),
  ('5290', 'Other IT Expenses', 'Expense'),
  ('5410', 'Depreciation', 'Expense'),
  ('5510', 'Disposal Loss', 'Expense')
ON CONFLICT (code) DO NOTHING;

-- Seed default category GL mapping
INSERT INTO finance_catgl (category, gl_code) VALUES
  ('Hardware', '1510'), ('Software & Licences', '1520'), ('Consumables', '1410'),
  ('AMC & Maintenance', '5230'), ('Network & Infrastructure', '1510'),
  ('Cloud & Services', '5240'), ('Security', '5290'), ('Staffing & Training', '5110'),
  ('Other', '5290')
ON CONFLICT (category) DO NOTHING;