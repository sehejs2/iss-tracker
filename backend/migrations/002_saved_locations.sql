CREATE TABLE IF NOT EXISTS saved_locations (
  id         SERIAL PRIMARY KEY,
  latitude   FLOAT  NOT NULL,
  longitude  FLOAT  NOT NULL,
  label      TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
