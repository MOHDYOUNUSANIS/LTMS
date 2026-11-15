CREATE DATABASE IF NOT EXISTS ltms_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE ltms_db;

CREATE TABLE IF NOT EXISTS supervisors (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supervisor_code VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','SUPERVISOR','STOREKEEPER','OPERATOR') NOT NULL DEFAULT 'SUPERVISOR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(160) NOT NULL,
  company_code VARCHAR(40) UNIQUE,
  address TEXT,
  contact_person VARCHAR(120),
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drums (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  drum_code VARCHAR(50) NOT NULL,
  drum_type VARCHAR(80) DEFAULT 'WOODEN',
  capacity_kg DECIMAL(12,3),
  location VARCHAR(120),
  status ENUM('AVAILABLE','RUNNING','MAINTENANCE','INACTIVE') DEFAULT 'AVAILABLE',
  UNIQUE KEY uq_company_drum (company_id, drum_code),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS chemicals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chemical_code VARCHAR(50) UNIQUE,
  chemical_name VARCHAR(160) NOT NULL,
  category VARCHAR(80),
  unit ENUM('KG','LITRE','PCS') NOT NULL DEFAULT 'KG',
  current_stock DECIMAL(14,3) NOT NULL DEFAULT 0,
  minimum_stock DECIMAL(14,3) NOT NULL DEFAULT 0,
  storage_location VARCHAR(120),
  supplier VARCHAR(160),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  chemical_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('OPENING','RECEIPT','ISSUE','RETURN','ADJUSTMENT') NOT NULL,
  quantity DECIMAL(14,3) NOT NULL,
  reference_note VARCHAR(255),
  supervisor_id BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chemical_id) REFERENCES chemicals(id),
  FOREIGN KEY (supervisor_id) REFERENCES supervisors(id)
);

CREATE TABLE IF NOT EXISTS process_templates (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NULL,
  template_name VARCHAR(160) NOT NULL,
  species VARCHAR(60),
  product_name VARCHAR(120),
  colour VARCHAR(60),
  thickness_min_mm DECIMAL(5,2),
  thickness_max_mm DECIMAL(5,2),
  reference_weight_kg DECIMAL(12,3),
  reference_hides_sides VARCHAR(60),
  source_document VARCHAR(255),
  verification_status ENUM('DRAFT','CHEMIST_VERIFIED','APPROVED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  notes TEXT,
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (created_by) REFERENCES supervisors(id)
);

CREATE TABLE IF NOT EXISTS process_steps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_id BIGINT UNSIGNED NOT NULL,
  stage_name VARCHAR(120) NOT NULL,
  sequence_no INT NOT NULL,
  float_percent DECIMAL(7,3),
  water_percent DECIMAL(7,3),
  target_ph_min DECIMAL(4,2),
  target_ph_max DECIMAL(4,2),
  duration_minutes INT,
  instruction TEXT,
  FOREIGN KEY (template_id) REFERENCES process_templates(id) ON DELETE CASCADE,
  UNIQUE KEY uq_template_sequence (template_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS process_step_chemicals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  process_step_id BIGINT UNSIGNED NOT NULL,
  chemical_id BIGINT UNSIGNED NULL,
  chemical_label VARCHAR(160) NOT NULL,
  dosage_percent DECIMAL(8,4),
  dosage_basis ENUM('PERCENT_OF_PELT_WEIGHT','PERCENT_OF_FLOAT','FIXED_QUANTITY') DEFAULT 'PERCENT_OF_PELT_WEIGHT',
  fixed_quantity DECIMAL(14,3),
  unit ENUM('KG','LITRE','PCS') DEFAULT 'KG',
  addition_order INT,
  notes TEXT,
  FOREIGN KEY (process_step_id) REFERENCES process_steps(id) ON DELETE CASCADE,
  FOREIGN KEY (chemical_id) REFERENCES chemicals(id)
);

CREATE TABLE IF NOT EXISTS production_batches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  drum_id BIGINT UNSIGNED NOT NULL,
  template_id BIGINT UNSIGNED,
  batch_code VARCHAR(60) NOT NULL UNIQUE,
  product_name VARCHAR(120),
  species VARCHAR(60),
  colour VARCHAR(60),
  hides_sides_count INT,
  input_weight_kg DECIMAL(12,3) NOT NULL,
  thickness_min_mm DECIMAL(5,2),
  thickness_max_mm DECIMAL(5,2),
  status ENUM('PLANNED','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED') DEFAULT 'PLANNED',
  started_at DATETIME,
  completed_at DATETIME,
  created_by BIGINT UNSIGNED,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (drum_id) REFERENCES drums(id),
  FOREIGN KEY (template_id) REFERENCES process_templates(id),
  FOREIGN KEY (created_by) REFERENCES supervisors(id)
);

CREATE TABLE IF NOT EXISTS batch_step_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id BIGINT UNSIGNED NOT NULL,
  process_step_id BIGINT UNSIGNED,
  stage_name VARCHAR(120) NOT NULL,
  started_at DATETIME,
  ended_at DATETIME,
  actual_ph DECIMAL(4,2),
  actual_temperature_c DECIMAL(5,2),
  operator_notes TEXT,
  completed_by BIGINT UNSIGNED,
  FOREIGN KEY (batch_id) REFERENCES production_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (process_step_id) REFERENCES process_steps(id),
  FOREIGN KEY (completed_by) REFERENCES supervisors(id)
);

CREATE INDEX idx_chemicals_low_stock ON chemicals(current_stock, minimum_stock);
CREATE INDEX idx_batches_status ON production_batches(status);
CREATE INDEX idx_templates_product ON process_templates(product_name, species);
