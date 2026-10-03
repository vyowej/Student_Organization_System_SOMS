-- DATA RELATED: Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- STUDENT, OFFICER, ADVISER, ADMIN
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, PENDING
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DATA RELATED: Organizations Table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    acronym VARCHAR(50),
    description TEXT,
    logo VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PENDING',
    adviser_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DATA RELATED: Events Table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'DRAFT',
    created_by UUID REFERENCES users(id)
);
