-- vetcare pro database schema

DROP DATABASE IF EXISTS vetcare_pro;
CREATE DATABASE vetcare_pro;
USE vetcare_pro;

-- user (base table for owner / veterinarian / admin)
CREATE TABLE User (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('owner','veterinarian','receptionist','admin') NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- owner
CREATE TABLE Owner (
    owner_id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    address             VARCHAR(255),
    emergency_contact   VARCHAR(100),
    emergency_phone     VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- veterinarian
CREATE TABLE Veterinarian (
    vet_id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    specialisation      VARCHAR(100),
    bio                 TEXT,
    years_experience    INT DEFAULT 0,
    is_available        BOOLEAN DEFAULT TRUE,
    registration_no     VARCHAR(50) UNIQUE,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- schedule
CREATE TABLE Schedule (
    schedule_id     INT AUTO_INCREMENT PRIMARY KEY,
    vet_id          INT NOT NULL,
    day_of_week     ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (vet_id) REFERENCES Veterinarian(vet_id) ON DELETE CASCADE
);

-- pet
CREATE TABLE Pet (
    pet_id          INT AUTO_INCREMENT PRIMARY KEY,
    owner_id        INT NOT NULL,
    name            VARCHAR(100) NOT NULL,
    species         VARCHAR(50) NOT NULL,
    breed           VARCHAR(100),
    date_of_birth   DATE,
    weight_kg       DECIMAL(5,2),
    gender          ENUM('male','female','unknown') DEFAULT 'unknown',
    microchip_no    VARCHAR(50) UNIQUE,
    photo_url       VARCHAR(255),
    is_active       BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (owner_id) REFERENCES Owner(owner_id) ON DELETE CASCADE
);

-- vaccine
CREATE TABLE Vaccine (
    vaccine_id      INT AUTO_INCREMENT PRIMARY KEY,
    pet_id          INT NOT NULL,
    vet_id          INT NOT NULL,
    vaccine_name    VARCHAR(100) NOT NULL,
    batch_number    VARCHAR(50),
    date_given      DATE NOT NULL,
    due_date        DATE NOT NULL,
    FOREIGN KEY (pet_id) REFERENCES Pet(pet_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES Veterinarian(vet_id)
);

-- service
CREATE TABLE Service (
    service_id          INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    category            VARCHAR(50),
    base_price          DECIMAL(10,2) NOT NULL,
    duration_minutes    INT NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE
);

-- appointment
CREATE TABLE Appointment (
    appt_id             INT AUTO_INCREMENT PRIMARY KEY,
    pet_id              INT NOT NULL,
    vet_id              INT NOT NULL,
    service_id          INT NOT NULL,
    receptionist_id     INT,
    date_time           DATETIME NOT NULL,
    end_time            DATETIME NOT NULL,
    status              ENUM('pending','confirmed','checked_in','completed','cancelled') DEFAULT 'pending',
    cancellation_reason VARCHAR(255),
    owner_notes         TEXT,
    FOREIGN KEY (pet_id) REFERENCES Pet(pet_id) ON DELETE CASCADE,
    FOREIGN KEY (vet_id) REFERENCES Veterinarian(vet_id),
    FOREIGN KEY (service_id) REFERENCES Service(service_id),
    FOREIGN KEY (receptionist_id) REFERENCES User(user_id),
    UNIQUE KEY no_double_booking (vet_id, date_time)
);

-- medical record
CREATE TABLE MedicalRecord (
    record_id           INT AUTO_INCREMENT PRIMARY KEY,
    appt_id             INT NOT NULL UNIQUE,
    diagnosis           TEXT,
    symptoms            TEXT,
    treatment           TEXT,
    prescription        TEXT,
    follow_up_date      DATE,
    weight_at_visit     DECIMAL(5,2),
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appt_id) REFERENCES Appointment(appt_id) ON DELETE CASCADE
);

-- invoice
CREATE TABLE Invoice (
    invoice_id      INT AUTO_INCREMENT PRIMARY KEY,
    appt_id         INT NOT NULL UNIQUE,
    owner_id        INT NOT NULL,
    subtotal        DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    tax_amount      DECIMAL(10,2) DEFAULT 0.00,
    total_amount    DECIMAL(10,2) NOT NULL,
    status          ENUM('unpaid','paid','overdue','refunded') DEFAULT 'unpaid',
    due_date        DATE,
    issued_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appt_id) REFERENCES Appointment(appt_id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES Owner(owner_id)
);

-- payment
CREATE TABLE Payment (
    payment_id          INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id          INT NOT NULL,
    amount              DECIMAL(10,2) NOT NULL,
    payment_method      ENUM('card','eft','cash','refund') NOT NULL,
    gateway_reference   VARCHAR(100) UNIQUE,
    status              ENUM('pending','success','failed','refunded') DEFAULT 'pending',
    paid_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES Invoice(invoice_id) ON DELETE CASCADE
);

-- notification
CREATE TABLE Notification (
    notif_id        INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    type            ENUM('confirmation','reminder','vaccination','invoice','cancellation') NOT NULL,
    message         TEXT NOT NULL,
    channel         ENUM('email','sms','in_app') DEFAULT 'in_app',
    is_read         BOOLEAN DEFAULT FALSE,
    sent_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivery_status ENUM('sent','delivered','failed') DEFAULT 'sent',
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

-- contact message (added in milestone 2, not in the original erd)
CREATE TABLE ContactMessage (
    message_id      INT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    subject         VARCHAR(150) NOT NULL,
    message         TEXT NOT NULL,
    submitted_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- sample seed data (for screenshots / testing)

-- Users: 1 admin, 2 vets, 1 receptionist, 2 owners
-- Password for ALL sample accounts is: Password123
INSERT INTO User (name, email, password_hash, role, phone) VALUES
('Site Admin',     'admin@vetcarepro.co.za',  '$2a$10$wE5yBC1Hxk3W3/g7N..SJusCCEAy8dpz081.GM4jehJW3G68422s2', 'admin', '0111234567'),
('Dr Sarah Smith',  'sarah.smith@vetcarepro.co.za', '$2a$10$wE5yBC1Hxk3W3/g7N..SJusCCEAy8dpz081.GM4jehJW3G68422s2', 'veterinarian', '0822223333'),
('Dr James Nkosi',  'james.nkosi@vetcarepro.co.za', '$2a$10$wE5yBC1Hxk3W3/g7N..SJusCCEAy8dpz081.GM4jehJW3G68422s2', 'veterinarian', '0833334444'),
('Front Desk Lerato','lerato@vetcarepro.co.za', '$2a$10$wE5yBC1Hxk3W3/g7N..SJusCCEAy8dpz081.GM4jehJW3G68422s2', 'receptionist', '0844445555'),
('John Smith',      'john.smith@example.com',  '$2a$10$wE5yBC1Hxk3W3/g7N..SJusCCEAy8dpz081.GM4jehJW3G68422s2', 'owner', '0721112222'),
('Amy Lee',         'amy.lee@example.com',     '$2a$10$wE5yBC1Hxk3W3/g7N..SJusCCEAy8dpz081.GM4jehJW3G68422s2', 'owner', '0739998888');

INSERT INTO Veterinarian (user_id, specialisation, bio, years_experience, registration_no) VALUES
(2, 'General Practitioner', 'Experienced general vet focused on preventive care.', 10, 'SAVC-2014-001'),
(3, 'Surgeon', 'Specialises in soft tissue and orthopaedic surgery.', 8, 'SAVC-2016-002');

INSERT INTO Schedule (vet_id, day_of_week, start_time, end_time) VALUES
(1, 'Monday', '08:00:00', '17:00:00'),
(1, 'Wednesday', '08:00:00', '17:00:00'),
(2, 'Tuesday', '09:00:00', '16:00:00'),
(2, 'Thursday', '09:00:00', '16:00:00');

INSERT INTO Owner (user_id, address, emergency_contact, emergency_phone) VALUES
(5, '12 Oak Avenue, Sandton, Johannesburg', 'Mary Smith', '0827776666'),
(6, '45 Pine Street, Rosebank, Johannesburg', 'Tom Lee', '0738887777');

INSERT INTO Service (name, description, category, base_price, duration_minutes) VALUES
('General Consultation', 'Routine health check-up and examination.', 'Medical', 350.00, 30),
('Vaccination', 'Core and non-core vaccine administration.', 'Preventive', 180.00, 15),
('Dental Cleaning', 'Professional dental scale and polish.', 'Dental', 850.00, 60),
('Minor Surgery', 'Day procedures such as sterilisation.', 'Surgical', 1800.00, 90);

INSERT INTO Pet (owner_id, name, species, breed, date_of_birth, weight_kg, gender, microchip_no) VALUES
(1, 'Buddy', 'Dog', 'Golden Retriever', '2022-03-12', 28.50, 'male', '9530000012345'),
(2, 'Whiskers', 'Cat', 'Persian', '2020-01-15', 4.20, 'female', '9530000067890');

INSERT INTO Appointment (pet_id, vet_id, service_id, receptionist_id, date_time, end_time, status) VALUES
(1, 1, 1, 4, '2026-04-09 09:00:00', '2026-04-09 09:30:00', 'confirmed'),
(2, 2, 3, 4, '2026-04-15 14:00:00', '2026-04-15 15:00:00', 'pending');

INSERT INTO Vaccine (pet_id, vet_id, vaccine_name, batch_number, date_given, due_date) VALUES
(1, 1, 'Rabies', 'B2024-RB-091', '2024-03-12', '2025-03-12'),
(1, 1, 'Parvovirus', 'B2024-PV-044', '2024-01-15', '2025-01-15');
