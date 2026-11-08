-- New broad category: spices and seasonings, listed right after "Não perecíveis".
update public.categories set sort_order = sort_order + 1 where sort_order >= 2;

insert into public.categories (name, sort_order) values ('Temperos', 2);
