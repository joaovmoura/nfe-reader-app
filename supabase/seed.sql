-- Development-only sample data (runs on `npx supabase db reset`, never on the
-- remote project). Dates are relative to now() so the 3-month window always
-- has data. CNPJs and access keys are fake.
--
-- Scenarios:
--   Arroz branco     package item, latest price ~+30% over the median -> high
--   Tomate           sold by KG, latest price well below the median   -> low
--   Café em pó       bought only once                                 -> no flag
--   Feijão carioca   stable, bought in both markets                   -> comparison
--   Leite UHT        per litre, bought in both markets                -> comparison
--   Molho de tomate  unit item with no package size                   -> not normalized

do $$
declare
  atacadao bigint;
  bairro bigint;
  arroz bigint;
  feijao bigint;
  tomate bigint;
  leite bigint;
  cafe bigint;
  molho bigint;
  p bigint;
begin
  insert into public.markets (cnpj, legal_name, nickname, address) values
    ('11222333000181', 'WMS SUPERMERCADOS DO BRASIL LTDA', 'Atacadão Teste', 'Av. Exemplo, 100, Campina Grande - PB')
    returning id into atacadao;
  insert into public.markets (cnpj, legal_name, nickname, address) values
    ('44555666000199', 'MERCADINHO DO BAIRRO LTDA', 'Mercadinho Teste', 'Rua Exemplo, 50, Campina Grande - PB')
    returning id into bairro;

  insert into public.item_classes (name, category_id, base_unit)
    select v.name, c.id, v.base_unit
    from (values
      ('Arroz branco', 'Não perecíveis', 'kg'),
      ('Feijão carioca', 'Não perecíveis', 'kg'),
      ('Tomate', 'Hortifruti', 'kg'),
      ('Leite UHT integral', 'Laticínios e frios', 'l'),
      ('Café em pó', 'Não perecíveis', 'kg'),
      ('Molho de tomate', 'Não perecíveis', 'kg')
    ) as v (name, category, base_unit)
    join public.categories c on c.name = v.category;

  select id into arroz from public.item_classes where name = 'Arroz branco';
  select id into feijao from public.item_classes where name = 'Feijão carioca';
  select id into tomate from public.item_classes where name = 'Tomate';
  select id into leite from public.item_classes where name = 'Leite UHT integral';
  select id into cafe from public.item_classes where name = 'Café em pó';
  select id into molho from public.item_classes where name = 'Molho de tomate';

  insert into public.products (cnpj_root, code, description, class_id, package_size, package_unit) values
    ('11222333', 'AR0461', 'ARROZ BCO TIO JOAO T1 5KG', arroz, 5, 'kg'),
    ('11222333', 'FJ0102', 'FEIJAO CARIOCA KICALDO 1KG', feijao, 1, 'kg'),
    ('11222333', 'HT0001', 'TOMATE KG', tomate, null, null),
    ('11222333', 'LT0330', 'LEITE UHT ITALAC INT', leite, 1, 'l'),
    ('11222333', 'CF0210', 'CAFE SAO BRAZ 250G', cafe, 0.25, 'kg'),
    ('11222333', 'MT0777', 'MOLHO TOM POMAROLA TRAD', molho, null, null),
    ('44555666', '7891', 'FEIJAO CARIOCA 1KG', feijao, 1, 'kg'),
    ('44555666', '7892', 'LEITE INTEGRAL 1L', leite, 1, 'l');

  -- Atacadão, 80 days ago
  insert into public.purchases (market_id, access_key, issued_at, products_total, paid_total)
    values (atacadao, '25261111222333000181650010000000011000000011', now() - interval '80 days', 0, 0)
    returning id into p;
  insert into public.purchase_items (purchase_id, line_number, product_id, code, description, quantity, unit, unit_price, total_price, class_id)
    select p, v.line, pr.id, pr.code, pr.description, v.qty, v.unit, v.price, round(v.qty * v.price, 2), pr.class_id
    from (values
      (1, 'AR0461', 1.000, 'UND', 25.00),
      (2, 'FJ0102', 2.000, 'UND', 7.49),
      (3, 'HT0001', 1.230, 'KG', 7.99),
      (4, 'LT0330', 12.000, 'UND', 4.79)
    ) as v (line, code, qty, unit, price)
    join public.products pr on pr.cnpj_root = '11222333' and pr.code = v.code;

  -- Atacadão, 50 days ago
  insert into public.purchases (market_id, access_key, issued_at, products_total, paid_total)
    values (atacadao, '25261111222333000181650010000000021000000021', now() - interval '50 days', 0, 0)
    returning id into p;
  insert into public.purchase_items (purchase_id, line_number, product_id, code, description, quantity, unit, unit_price, total_price, class_id)
    select p, v.line, pr.id, pr.code, pr.description, v.qty, v.unit, v.price, round(v.qty * v.price, 2), pr.class_id
    from (values
      (1, 'AR0461', 1.000, 'UND', 24.50),
      (2, 'HT0001', 0.985, 'KG', 8.49),
      (3, 'CF0210', 2.000, 'UND', 9.98),
      (4, 'MT0777', 3.000, 'UND', 2.89)
    ) as v (line, code, qty, unit, price)
    join public.products pr on pr.cnpj_root = '11222333' and pr.code = v.code;

  -- Atacadão, 20 days ago
  insert into public.purchases (market_id, access_key, issued_at, products_total, paid_total)
    values (atacadao, '25261111222333000181650010000000031000000031', now() - interval '20 days', 0, 0)
    returning id into p;
  insert into public.purchase_items (purchase_id, line_number, product_id, code, description, quantity, unit, unit_price, total_price, class_id)
    select p, v.line, pr.id, pr.code, pr.description, v.qty, v.unit, v.price, round(v.qty * v.price, 2), pr.class_id
    from (values
      (1, 'AR0461', 1.000, 'UND', 25.50),
      (2, 'FJ0102', 2.000, 'UND', 7.69),
      (3, 'HT0001', 1.410, 'KG', 7.49),
      (4, 'LT0330', 12.000, 'UND', 4.89)
    ) as v (line, code, qty, unit, price)
    join public.products pr on pr.cnpj_root = '11222333' and pr.code = v.code;

  -- Atacadão, 3 days ago: arroz up, tomate down
  insert into public.purchases (market_id, access_key, issued_at, products_total, paid_total)
    values (atacadao, '25261111222333000181650010000000041000000041', now() - interval '3 days', 0, 0)
    returning id into p;
  insert into public.purchase_items (purchase_id, line_number, product_id, code, description, quantity, unit, unit_price, total_price, class_id)
    select p, v.line, pr.id, pr.code, pr.description, v.qty, v.unit, v.price, round(v.qty * v.price, 2), pr.class_id
    from (values
      (1, 'AR0461', 2.000, 'UND', 32.90),
      (2, 'HT0001', 1.100, 'KG', 5.49),
      (3, 'HT0001', 0.870, 'KG', 5.49)
    ) as v (line, code, qty, unit, price)
    join public.products pr on pr.cnpj_root = '11222333' and pr.code = v.code;

  -- Mercadinho, 40 days ago
  insert into public.purchases (market_id, access_key, issued_at, products_total, paid_total)
    values (bairro, '25261144555666000199650010000000011000000012', now() - interval '40 days', 0, 0)
    returning id into p;
  insert into public.purchase_items (purchase_id, line_number, product_id, code, description, quantity, unit, unit_price, total_price, class_id)
    select p, v.line, pr.id, pr.code, pr.description, v.qty, v.unit, v.price, round(v.qty * v.price, 2), pr.class_id
    from (values
      (1, '7891', 1.000, 'UND', 8.29),
      (2, '7892', 6.000, 'UND', 5.19)
    ) as v (line, code, qty, unit, price)
    join public.products pr on pr.cnpj_root = '44555666' and pr.code = v.code;

  -- Mercadinho, 10 days ago
  insert into public.purchases (market_id, access_key, issued_at, products_total, paid_total)
    values (bairro, '25261144555666000199650010000000021000000022', now() - interval '10 days', 0, 0)
    returning id into p;
  insert into public.purchase_items (purchase_id, line_number, product_id, code, description, quantity, unit, unit_price, total_price, class_id)
    select p, v.line, pr.id, pr.code, pr.description, v.qty, v.unit, v.price, round(v.qty * v.price, 2), pr.class_id
    from (values
      (1, '7891', 2.000, 'UND', 7.99),
      (2, '7892', 12.000, 'UND', 4.99)
    ) as v (line, code, qty, unit, price)
    join public.products pr on pr.cnpj_root = '44555666' and pr.code = v.code;

  -- Totals and a single payment per purchase, derived from the items.
  update public.purchases pu
    set products_total = t.total, paid_total = t.total
    from (select purchase_id, sum(total_price) as total from public.purchase_items group by purchase_id) t
    where t.purchase_id = pu.id;

  insert into public.purchase_payments (purchase_id, method, amount)
    select id, 'Cartão de Débito', paid_total from public.purchases;
end $$;
