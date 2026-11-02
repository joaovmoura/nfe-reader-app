-- Access for the single shared household account (role authenticated).
-- anon gets nothing: no policy, and table privileges revoked as a second layer.
-- The item_prices view is security_invoker, so it follows these policies.

revoke all on all tables in schema public from anon;

-- Categories are reference data: read-only for the app.
create policy "authenticated can read categories"
  on public.categories for select to authenticated
  using (true);

-- Settings: one row, read and update only.
create policy "authenticated can read settings"
  on public.app_settings for select to authenticated
  using (true);

create policy "authenticated can update settings"
  on public.app_settings for update to authenticated
  using (true) with check (true);

-- Everything else: full access for the household.
create policy "authenticated has full access"
  on public.item_classes for all to authenticated
  using (true) with check (true);

create policy "authenticated has full access"
  on public.markets for all to authenticated
  using (true) with check (true);

create policy "authenticated has full access"
  on public.purchases for all to authenticated
  using (true) with check (true);

create policy "authenticated has full access"
  on public.purchase_payments for all to authenticated
  using (true) with check (true);

create policy "authenticated has full access"
  on public.products for all to authenticated
  using (true) with check (true);

create policy "authenticated has full access"
  on public.purchase_items for all to authenticated
  using (true) with check (true);
