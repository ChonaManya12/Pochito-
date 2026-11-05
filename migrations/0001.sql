CREATE TABLE devices (id TEXT PRIMARY KEY, subscription TEXT NOT NULL, schedule TEXT NOT NULL, zone TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE deliveries (device TEXT NOT NULL, occurrence TEXT NOT NULL, state TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY(device, occurrence));
