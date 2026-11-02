-- Core schema for the MVP (RF02–RF11).
-- RLS is enabled on every table with no policies yet: nothing is reachable
-- through the API until step 3 adds policies for the authenticated user.
-- Money is numeric(12,2); quantities numeric(12,3). No consumer CPF anywhere.

-- Broad categories (fixed list, seeded in a later migration).
create table public.categories (
  id smallint generated always as identity primary key,
  name text not null unique,
  sort_order smallint not null,
  created_at timestamptz not null default now()
);

-- Comparable product type across markets, e.g. "Arroz branco" (RF05).
-- base_unit says how the class is compared: per kg, per litre, or per unit.
create table public.item_classes (
  id bigint generated always as identity primary key,
  name text not null,
  category_id smallint not null references public.categories (id),
  base_unit text not null default 'kg' check (base_unit in ('kg', 'l', 'un')),
  created_at timestamptz not null default now()
);

create unique index item_classes_name_key on public.item_classes (lower(name));
create index item_classes_category_id_idx on public.item_classes (category_id);

-- A market is a full CNPJ (each branch is its own market) (RF04).
-- cnpj_root (first 8 digits) identifies the chain.
create table public.markets (
  id bigint generated always as identity primary key,
  cnpj char(14) not null unique check (cnpj ~ '^\d{14}$'),
  cnpj_root char(8) generated always as (left(cnpj, 8)) stored,
  legal_name text not null,
  nickname text,
  address text,
  created_at timestamptz not null default now()
);

-- One NFC-e. The access key identifies the note and is unique (RF03).
create table public.purchases (
  id bigint generated always as identity primary key,
  market_id bigint not null references public.markets (id),
  access_key char(44) not null unique check (access_key ~ '^\d{44}$'),
  issued_at timestamptz not null,
  products_total numeric(12, 2) not null check (products_total >= 0),
  discount_total numeric(12, 2) not null default 0 check (discount_total >= 0),
  paid_total numeric(12, 2) not null check (paid_total >= 0),
  created_at timestamptz not null default now()
);

create index purchases_market_id_issued_at_idx on public.purchases (market_id, issued_at);
create index purchases_issued_at_idx on public.purchases (issued_at);

-- Payment methods as printed on the note; a purchase may have several.
create table public.purchase_payments (
  id bigint generated always as identity primary key,
  purchase_id bigint not null references public.purchases (id) on delete cascade,
  method text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create index purchase_payments_purchase_id_idx on public.purchase_payments (purchase_id);

-- A chain's product, keyed by item code + CNPJ root. Holds both memories:
-- the remembered class (RF06) and the package size (RF08), always in kg or l.
create table public.products (
  id bigint generated always as identity primary key,
  cnpj_root char(8) not null,
  code text not null,
  description text not null,
  class_id bigint references public.item_classes (id),
  package_size numeric(12, 4) check (package_size > 0),
  package_unit text check (package_unit in ('kg', 'l')),
  created_at timestamptz not null default now(),
  unique (cnpj_root, code),
  check ((package_size is null) = (package_unit is null))
);

create index products_class_id_idx on public.products (class_id);

-- One line of the receipt. class_id here is what queries use; products.class_id
-- only pre-fills future receipts. unit_price is the unit value actually paid.
create table public.purchase_items (
  id bigint generated always as identity primary key,
  purchase_id bigint not null references public.purchases (id) on delete cascade,
  line_number smallint not null check (line_number > 0),
  product_id bigint references public.products (id),
  code text,
  description text not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  total_price numeric(12, 2) not null check (total_price >= 0),
  class_id bigint references public.item_classes (id),
  created_at timestamptz not null default now(),
  unique (purchase_id, line_number)
);

create index purchase_items_class_id_idx on public.purchase_items (class_id);
create index purchase_items_product_id_idx on public.purchase_items (product_id);

-- Single-row settings table (RF10 threshold, default 20%).
create table public.app_settings (
  id boolean primary key default true check (id),
  price_alert_pct smallint not null default 20 check (price_alert_pct between 1 and 100),
  updated_at timestamptz not null default now()
);

insert into public.app_settings default values;

-- Flattened prices for history (RF10) and market comparison (RF11).
-- Normalization and medians are computed in TypeScript (src/domain).
-- security_invoker makes the view respect the caller's RLS.
create view public.item_prices with (security_invoker = true) as
select
  pi.id,
  pi.purchase_id,
  pi.product_id,
  pi.class_id,
  pi.description,
  pi.quantity,
  pi.unit,
  pi.unit_price,
  p.issued_at,
  p.market_id,
  m.nickname as market_nickname,
  c.base_unit,
  pr.package_size,
  pr.package_unit
from public.purchase_items pi
join public.purchases p on p.id = pi.purchase_id
join public.markets m on m.id = p.market_id
left join public.item_classes c on c.id = pi.class_id
left join public.products pr on pr.id = pi.product_id;

alter table public.categories enable row level security;
alter table public.item_classes enable row level security;
alter table public.markets enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_payments enable row level security;
alter table public.products enable row level security;
alter table public.purchase_items enable row level security;
alter table public.app_settings enable row level security;
