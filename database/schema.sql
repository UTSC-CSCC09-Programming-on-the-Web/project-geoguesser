-- This file is not in use yet.

BEGIN;

-- Users table
CREATE TABLE IF NOT EXISTS "Users" (
    user_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    CONSTRAINT users_username_not_empty CHECK (length(trim(username)) > 0)
);

-- Locations table
CREATE TABLE IF NOT EXISTS "Locations" (
    image_id VARCHAR(50) PRIMARY KEY,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    location VARCHAR(255) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    CONSTRAINT locations_lat_range CHECK (lat BETWEEN -90 AND 90),
    CONSTRAINT locations_lng_range CHECK (lng BETWEEN -180 AND 180)
);

-- Games table
CREATE TABLE IF NOT EXISTS "Games" (
    game_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'in_progress',

    CONSTRAINT game_status_valid CHECK (status in ('in_progress', 'completed', 'abandoned')),

    CONSTRAINT games_user_foreign_key
        FOREIGN KEY (user_id)
        REFERENCES "Users"(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

-- enforce unique game in progress for each user
CREATE UNIQUE INDEX one_game_in_progress_per_user
    on "Games" (user_id)
    WHERE status = 'in_progress';

-- Rounds table
CREATE TABLE IF NOT EXISTS "Rounds" (
    round_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    round_number INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    image_id VARCHAR(50) NOT NULL,
    guess_lat DOUBLE PRECISION,
    guess_lng DOUBLE PRECISION,
    distance DOUBLE PRECISION,

    CONSTRAINT rounds_number_range CHECK (round_number BETWEEN 1 AND 3),

    CONSTRAINT rounds_guess_lat_range CHECK (guess_lat IS NULL OR guess_lat BETWEEN -90 AND 90),

    CONSTRAINT rounds_guess_lng_range CHECK (guess_lng IS NULL OR guess_lng BETWEEN -180 AND 180),

    CONSTRAINT rounds_distance_positive CHECK (distance IS NULL OR distance >= 0),

    CONSTRAINT rounds_game_foreign_key
        FOREIGN KEY (game_id)
        REFERENCES "Games"(game_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT rounds_image_foreign_key
        FOREIGN KEY (image_id)
        REFERENCES "Locations"(image_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT one_round_number_per_game
        UNIQUE (game_id, round_number)
);

COMMIT;