CREATE TABLE IF NOT EXISTS position_history (
  id          SERIAL PRIMARY KEY,
  latitude    FLOAT   NOT NULL,
  longitude   FLOAT   NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW()
);
