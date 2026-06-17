-- Taller Llave — schema completo
-- Correr en phpMyAdmin ANTES de iniciar la app

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(191) NOT NULL UNIQUE,
  email         VARCHAR(191) NOT NULL UNIQUE,
  first_name    VARCHAR(191) NOT NULL DEFAULT '',
  last_name     VARCHAR(191) NOT NULL DEFAULT '',
  password      VARCHAR(191) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'customer',
  phone         VARCHAR(191) NOT NULL DEFAULT '',
  dni           VARCHAR(191) NOT NULL DEFAULT '',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  date_joined   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS services (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(191) NOT NULL,
  description      TEXT         NOT NULL DEFAULT '',
  service_type     VARCHAR(20)  NOT NULL DEFAULT 'keys',
  duration_minutes INT          NOT NULL DEFAULT 30,
  price            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS working_hours (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  day_of_week   INT          NOT NULL UNIQUE,
  is_open       BOOLEAN      NOT NULL DEFAULT TRUE,
  open_time     VARCHAR(5)   NOT NULL DEFAULT '09:00',
  close_time    VARCHAR(5)   NOT NULL DEFAULT '18:00',
  slot_duration INT          NOT NULL DEFAULT 30
);

CREATE TABLE IF NOT EXISTS appointments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  customer_id   INT          NOT NULL,
  service_id    INT          NOT NULL,
  date          VARCHAR(10)  NOT NULL,
  time          VARCHAR(5)   NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending',
  vehicle_make  VARCHAR(191) NOT NULL DEFAULT '',
  vehicle_model VARCHAR(191) NOT NULL DEFAULT '',
  vehicle_year  INT,
  notes         TEXT         NOT NULL DEFAULT '',
  staff_notes   TEXT         NOT NULL DEFAULT '',
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (customer_id) REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (service_id)  REFERENCES services(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(191) NOT NULL,
  description VARCHAR(191) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS products (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT           NOT NULL,
  name        VARCHAR(191)  NOT NULL,
  description TEXT          NOT NULL DEFAULT '',
  sku         VARCHAR(191)  NOT NULL UNIQUE DEFAULT '',
  price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock       INT           NOT NULL DEFAULT 0,
  min_stock   INT           NOT NULL DEFAULT 5,
  image       VARCHAR(191),
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  product_id    INT          NOT NULL,
  movement_type VARCHAR(20)  NOT NULL,
  quantity      INT          NOT NULL,
  reason        VARCHAR(191) NOT NULL DEFAULT '',
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_by_id INT,
  FOREIGN KEY (product_id)    REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id)    ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS injector_parts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(191)  NOT NULL,
  description TEXT          NOT NULL DEFAULT '',
  part_number VARCHAR(191)  NOT NULL DEFAULT '',
  stock       INT           NOT NULL DEFAULT 0,
  min_stock   INT           NOT NULL DEFAULT 2,
  price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS injector_works (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  customer_name    VARCHAR(191)  NOT NULL,
  customer_phone   VARCHAR(191)  NOT NULL,
  customer_email   VARCHAR(191)  NOT NULL DEFAULT '',
  customer_id      INT,
  vehicle_make     VARCHAR(191)  NOT NULL,
  vehicle_model    VARCHAR(191)  NOT NULL,
  vehicle_year     INT,
  injector_quantity INT          NOT NULL DEFAULT 1,
  diagnosis        TEXT          NOT NULL DEFAULT '',
  work_done        TEXT          NOT NULL DEFAULT '',
  status           VARCHAR(20)   NOT NULL DEFAULT 'received',
  price            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  received_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at     DATETIME(3),
  assigned_to_id   INT,
  notes            TEXT          NOT NULL DEFAULT '',
  FOREIGN KEY (customer_id)    REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS work_part_usages (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  work_id  INT NOT NULL,
  part_id  INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  FOREIGN KEY (work_id) REFERENCES injector_works(id) ON DELETE CASCADE,
  FOREIGN KEY (part_id) REFERENCES injector_parts(id) ON DELETE RESTRICT
);

-- Horarios de atención por defecto (lun–vie abierto, sáb–dom cerrado)
INSERT IGNORE INTO working_hours (day_of_week, is_open, open_time, close_time, slot_duration) VALUES
  (0, TRUE,  '09:00', '18:00', 30),
  (1, TRUE,  '09:00', '18:00', 30),
  (2, TRUE,  '09:00', '18:00', 30),
  (3, TRUE,  '09:00', '18:00', 30),
  (4, TRUE,  '09:00', '18:00', 30),
  (5, FALSE, '09:00', '13:00', 30),
  (6, FALSE, '09:00', '13:00', 30);

-- Servicios de ejemplo
INSERT IGNORE INTO services (name, service_type, duration_minutes, price) VALUES
  ('Copia de llave',      'keys',      15,  1500.00),
  ('Llave con chip',      'keys',      30,  5000.00),
  ('Limpieza inyectores', 'injectors', 60,  8000.00),
  ('Reprogramación ECU',  'ecu',       120, 15000.00);

-- Usuario admin: crear ejecutando desde SSH:
--   node -e "require('bcryptjs').hash('admin1234', 12).then(h => console.log(h))"
-- Luego insertar manualmente con el hash generado.
