-- Web de invitados (W-1, spec docs/specs/2026-10-06-epica-web-de-invitados.md, D2).
-- El link se guarda para que cualquier integrante lo vuelva a compartir. Lo leen
-- solo los integrantes, como el resto del grupo (RLS de groups). La búsqueda
-- sigue por la huella: get_guest_group y claim_member no cambian.

alter table public.groups add column invite_token text;

-- Igual que antes, y además guarda el token.
create or replace function public.rotate_invite_token(gid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  token text;
begin
  if not public.is_group_member(gid) then
    raise exception 'not a member of group %', gid using errcode = '42501';
  end if;

  token := rtrim(translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');
  update public.groups
  set invite_token = token,
      invite_token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex'),
      invite_token_created_at = now()
  where id = gid;

  return token;
end;
$$;

-- Sin huella no hay link: revoke_invite_token y delete_group borran la huella y
-- este trigger borra también el token, sin tener que redefinirlas.
create function private.clear_invite_token() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.invite_token_hash is null then
    new.invite_token := null;
  end if;
  return new;
end;
$$;

create trigger groups_clear_invite_token before update of invite_token_hash on public.groups
  for each row execute function private.clear_invite_token();
