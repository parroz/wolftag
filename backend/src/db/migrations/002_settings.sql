CREATE TABLE IF NOT EXISTS printer_settings (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  print_mode    TEXT    NOT NULL DEFAULT 'mock',
  printer_ip    TEXT    NOT NULL DEFAULT '192.168.1.122',
  printer_port  INTEGER NOT NULL DEFAULT 9100,
  printer_model TEXT    NOT NULL DEFAULT 'PT-P750W',
  label_width_mm INTEGER NOT NULL DEFAULT 12,
  updated_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO printer_settings (id) VALUES (1);
