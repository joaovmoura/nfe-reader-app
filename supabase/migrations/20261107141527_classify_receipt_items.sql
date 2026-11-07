-- RF05-RF06: classes on receipt items and the classification memory.

-- save_receipt now also receives the AI's class suggestion per item:
--   items[].class = {name, category, base_unit} | null
-- Items whose product already has a class (the memory) keep it; the
-- suggestion only fills empty memories, so a user correction always wins.
create or replace function public.save_receipt(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_market_id bigint;
  v_new_market boolean;
  v_cnpj_root char(8);
  v_purchase_id bigint;
  v_classes_created integer;
begin
  -- Market by full CNPJ; keeps the nickname the user gave (RF04).
  insert into public.markets as m (cnpj, legal_name, address)
  values (
    payload -> 'market' ->> 'cnpj',
    payload -> 'market' ->> 'legal_name',
    payload -> 'market' ->> 'address'
  )
  on conflict (cnpj) do update
    set legal_name = excluded.legal_name,
        address = coalesce(excluded.address, m.address)
  returning m.id, (xmax = 0), m.cnpj_root
  into v_market_id, v_new_market, v_cnpj_root;

  -- A duplicate access key raises unique_violation (23505) and rolls back (RF03).
  insert into public.purchases (
    market_id, access_key, issued_at, products_total, discount_total, paid_total
  ) values (
    v_market_id,
    payload ->> 'access_key',
    (payload ->> 'issued_at')::timestamptz,
    (payload ->> 'products_total')::numeric,
    (payload ->> 'discount_total')::numeric,
    (payload ->> 'paid_total')::numeric
  )
  returning id into v_purchase_id;

  insert into public.purchase_payments (purchase_id, method, amount)
  select v_purchase_id, p.method, p.amount
  from jsonb_to_recordset(payload -> 'payments') as p (method text, amount numeric);

  -- New classes suggested by the AI; an existing name (any case) is reused.
  insert into public.item_classes (name, category_id, base_unit)
  select distinct on (lower(s.name)) s.name, c.id, s.base_unit
  from jsonb_to_recordset(payload -> 'items') as i (class jsonb)
  cross join lateral jsonb_to_record(i.class) as s (name text, category text, base_unit text)
  join public.categories c on c.name = s.category
  where jsonb_typeof(i.class) = 'object'
  order by lower(s.name)
  on conflict ((lower(name))) do nothing;
  get diagnostics v_classes_created = row_count;

  -- One product per (chain, code). The same code can repeat in a receipt
  -- (bulk items weighed separately), and ON CONFLICT DO UPDATE cannot touch
  -- the same row twice in one statement, hence DISTINCT ON.
  insert into public.products as pr (cnpj_root, code, description)
  select distinct on (i.code) v_cnpj_root, i.code, i.description
  from jsonb_to_recordset(payload -> 'items') as i (code text, description text, line_number int)
  where i.code is not null
  order by i.code, i.line_number desc
  on conflict (cnpj_root, code) do update
    set description = excluded.description;

  -- The AI suggestion fills an empty memory only (RF06).
  update public.products pr
    set class_id = ic.id
  from jsonb_to_recordset(payload -> 'items') as i (code text, class jsonb)
  join public.item_classes ic on lower(ic.name) = lower(i.class ->> 'name')
  where pr.cnpj_root = v_cnpj_root
    and pr.code = i.code
    and pr.class_id is null;

  -- Each line is kept; remembered class first, then the AI suggestion.
  insert into public.purchase_items (
    purchase_id, line_number, product_id, code, description,
    quantity, unit, unit_price, total_price, class_id
  )
  select
    v_purchase_id, i.line_number, pr.id, i.code, i.description,
    i.quantity, i.unit, i.unit_price, i.total_price, coalesce(pr.class_id, ic.id)
  from jsonb_to_recordset(payload -> 'items') as i (
    line_number smallint, code text, description text,
    quantity numeric, unit text, unit_price numeric, total_price numeric, class jsonb
  )
  left join public.products pr on pr.cnpj_root = v_cnpj_root and pr.code = i.code
  left join public.item_classes ic on lower(ic.name) = lower(i.class ->> 'name');

  return jsonb_build_object(
    'purchase_id', v_purchase_id,
    'market_id', v_market_id,
    'new_market', v_new_market,
    'classes_created', v_classes_created
  );
end;
$$;

-- RF06/RF07: the user's class correction. Applies to the item, to the other
-- lines of the same product (fixing history) and to the memory, so future
-- receipts of the chain reuse it. Items without a product change alone.
create function public.set_item_class(item_id bigint, class_id bigint)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product_id bigint;
  v_updated integer;
begin
  select pi.product_id into v_product_id
  from public.purchase_items pi
  where pi.id = set_item_class.item_id;
  if not found then
    raise exception 'purchase item % not found', item_id using errcode = 'P0002';
  end if;

  if v_product_id is null then
    update public.purchase_items pi
      set class_id = set_item_class.class_id
    where pi.id = set_item_class.item_id;
  else
    update public.products pr
      set class_id = set_item_class.class_id
    where pr.id = v_product_id;

    update public.purchase_items pi
      set class_id = set_item_class.class_id
    where pi.product_id = v_product_id;
  end if;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke execute on function public.set_item_class(bigint, bigint) from public, anon;
grant execute on function public.set_item_class(bigint, bigint) to authenticated;
