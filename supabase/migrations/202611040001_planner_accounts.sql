-- Keep existing planner document boundaries and IDs so backups can be imported intact.
create table public.planner_documents (
  owner uuid not null references auth.users(id) on delete cascade,
  path text not null check (length(path) <= 1024 and (path = '' or path ~ '^([^/]+/[^/]+)(/[^/]+/[^/]+)*$')),
  version integer not null check (version > 0),
  data jsonb check (data is null or jsonb_typeof(data) = 'object'),
  primary key (owner, path)
);

create table public.planner_write_receipts (
  owner uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  primary key (owner, request_id)
);

alter table public.planner_documents enable row level security;
alter table public.planner_write_receipts enable row level security;
revoke all on public.planner_documents, public.planner_write_receipts from public, anon, authenticated;
grant select on public.planner_documents to authenticated;
create policy planner_read_own on public.planner_documents for select to authenticated
  using (owner = (select auth.uid()));

-- A null document is a tombstone. Its version prevents an old device from
-- resurrecting a deleted record. A request receipt makes network retries safe.
create function public.planner_apply(p_owner uuid, p_request uuid, p_changes jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  change jsonb;
  record_path text;
  expected integer;
  payload jsonb;
begin
  if auth.uid() is null or p_owner is distinct from auth.uid() then
    raise exception 'Workspace access denied' using errcode = '42501';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'Invalid write batch' using errcode = '22023';
  end if;
  if jsonb_array_length(p_changes) not between 1 and 400 then
    raise exception 'Invalid write batch size' using errcode = '22023';
  end if;
  insert into public.planner_write_receipts values (p_owner, p_request)
    on conflict do nothing;
  if not found then return; end if;

  for change in select value from jsonb_array_elements(p_changes) loop
    record_path := change->>'path';
    expected := (change->>'expected')::integer;
    payload := nullif(change->'data', 'null'::jsonb);
    if expected = 0 then
      insert into public.planner_documents values (p_owner, record_path, 1, payload)
        on conflict do nothing;
    else
      update public.planner_documents set version = version + 1, data = payload
        where owner = p_owner and path = record_path and version = expected;
    end if;
    if not found then
      raise exception 'A newer copy exists for %', record_path using errcode = '40001';
    end if;
  end loop;
end;
$$;
revoke all on function public.planner_apply(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.planner_apply(uuid, uuid, jsonb) to authenticated;

alter publication supabase_realtime add table public.planner_documents;

insert into storage.buckets (id, name, public) values ('planner-files', 'planner-files', false);
create policy planner_files_select on storage.objects for select to authenticated
  using (bucket_id = 'planner-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy planner_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'planner-files' and cardinality(storage.foldername(name)) = 1
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy planner_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'planner-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
