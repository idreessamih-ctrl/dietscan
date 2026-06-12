-- Create the database role
CREATE ROLE dietscan WITH LOGIN PASSWORD 'change_me_in_production' SUPERUSER;

-- Create the 5 required databases for the DietScan platform
CREATE DATABASE dietscan_core;
CREATE DATABASE dietscan_auth;
CREATE DATABASE activepieces;
CREATE DATABASE glitchtip;
CREATE DATABASE umami;

