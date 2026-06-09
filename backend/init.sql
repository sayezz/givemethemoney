-- Users Table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Positions Table
CREATE TABLE positions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  ticker VARCHAR(10) NOT NULL,
  quantity DECIMAL(10, 4) NOT NULL,
  purchase_cost DECIMAL(12, 2) NOT NULL,
  purchase_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  purchase_fee_fixed DECIMAL(10, 2) NOT NULL DEFAULT 0,
  purchase_fee_percent DECIMAL(8, 4) NOT NULL DEFAULT 0,
  sell_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  sell_fee_fixed DECIMAL(10, 2) NOT NULL DEFAULT 0,
  sell_fee_percent DECIMAL(8, 4) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 26.375,
  quote_provider VARCHAR(20) NOT NULL DEFAULT 'yahoo',
  trailing_stop_active BOOLEAN NOT NULL DEFAULT FALSE,
  ts_notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
  highest_price DECIMAL(12, 4),
  trailing_stop_percent DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_users_email ON users(email);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to positions table
CREATE TRIGGER update_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
