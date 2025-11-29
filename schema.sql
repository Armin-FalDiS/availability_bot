-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT PRIMARY KEY,
    display_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Availability table
CREATE TABLE IF NOT EXISTS availability (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hour INT NOT NULL CHECK (hour >= 0 AND hour <= 23),
    status TEXT NOT NULL CHECK (status IN ('green', 'yellow', 'red', 'gray')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date, hour)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_availability_user_date_hour ON availability(user_id, date, hour);
CREATE INDEX IF NOT EXISTS idx_availability_date ON availability(date);
