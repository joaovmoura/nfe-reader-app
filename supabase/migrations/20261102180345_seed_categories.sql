-- The 7 broad categories (RF05). Reference data needed in production, so it
-- lives in a migration rather than seed.sql (which only runs locally).
insert into public.categories (name, sort_order) values
  ('Não perecíveis', 1),
  ('Laticínios e frios', 2),
  ('Carnes', 3),
  ('Perecíveis', 4),
  ('Hortifruti', 5),
  ('Bebidas', 6),
  ('Limpeza e higiene', 7);
