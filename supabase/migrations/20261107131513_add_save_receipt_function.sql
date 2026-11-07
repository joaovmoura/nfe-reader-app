-- Saves an extracted receipt in one transaction (RF02-RF03). Called by the
-- extract-receipt Edge Function with the user's own token, so RLS applies
-- (security invoker). The payload was already validated by the function.
--
-- Payload: { market: {cnpj, legal_name, address}, access_key, issued_at,
--   items: [{line_number, code, description, quantity, unit, unit_price, total_price}],
--   products_total, discount_total, paid_total, payments: [{method, amount}] }
create function public.save_receipt(payload jsonb)
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

  -- Each line is kept; the class comes from the classification memory (RF06).
  insert into public.purchase_items (
    purchase_id, line_number, product_id, code, description,
    quantity, unit, unit_price, total_price, class_id
  )
  select
    v_purchase_id, i.line_number, pr.id, i.code, i.description,
    i.quantity, i.unit, i.unit_price, i.total_price, pr.class_id
  from jsonb_to_recordset(payload -> 'items') as i (
    line_number smallint, code text, description text,
    quantity numeric, unit text, unit_price numeric, total_price numeric
  )
  left join public.products pr on pr.cnpj_root = v_cnpj_root and pr.code = i.code;

  return jsonb_build_object(
    'purchase_id', v_purchase_id,
    'market_id', v_market_id,
    'new_market', v_new_market
  );
end;
$$;

revoke execute on function public.save_receipt(jsonb) from public, anon;
grant execute on function public.save_receipt(jsonb) to authenticated;
