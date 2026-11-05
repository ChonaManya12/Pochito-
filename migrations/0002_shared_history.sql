CREATE TABLE care_history (
  day TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('food','walk')),
  done INTEGER NOT NULL CHECK(done IN (0,1)),
  at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(day,id)
);
