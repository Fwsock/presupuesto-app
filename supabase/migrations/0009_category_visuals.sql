alter table categories
  add column icono text not null default 'pricetag-outline',
  add column color text not null default '#2563EB';
