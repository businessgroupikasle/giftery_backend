-- PostgreSQL initialization script
-- Runs once when the postgres container is first created

SELECT 'CREATE DATABASE ecommerce'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce')\gexec

\c ecommerce;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

SELECT 'Database initialized successfully' AS status;
