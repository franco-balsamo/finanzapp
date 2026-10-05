-- Marca de bienvenida hecha (spec de las primeras pantallas, D5, 5/10).
-- Nula hasta que la persona toca "Listo" en la bienvenida; la app la usa para elegir
-- entre la bienvenida y la Billetera. No se deduce de los datos porque la primera
-- tarjeta es opcional.

alter table public.user_settings add column onboarded_at timestamptz;

grant update (onboarded_at) on public.user_settings to authenticated;
