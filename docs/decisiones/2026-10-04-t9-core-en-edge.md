# T9: packages/core en las Edge Functions · 4 de octubre de 2026

Pedido (informe de eng review, T9): verificar que las Edge Functions puedan importar `packages/core`; si no pueden, copiarlo al hacer deploy. Fran eligió T9 como siguiente paso porque el aviso de cierre de las 20:00 necesita `statementFor` y `cardState` dentro de una Edge Function.

## Qué se probó (`supabase functions serve`, edge runtime 1.77.1, Deno 2.1.4)

1. **Una función importa `../../../packages/core/src/index.ts`.**
   - El runtime llega bien a archivos de afuera de `supabase/functions`.
   - Falla con `Module not found ".../packages/core/src/money"`: core importaba sin extensión (`'./money'`) y Deno pide la extensión explícita.
2. **`deno.json` con `"unstable": ["sloppy-imports"]`:** el runtime de Edge Functions lo ignora y sigue el mismo error.
3. **Imports con la extensión `.ts` en core:** anda.
   - `statementFor` de una compra del 25/9 con cierre el 24 devuelve `2026-10`.
   - `money` y `rate` devuelven lo esperado.

## Decisión

- **Imports de core:** todos los relativos llevan `.ts` (93 imports en 25 archivos, tests incluidos).
- **TypeScript:** `allowImportingTsExtensions` en `tsconfig.base.json` y en `apps/mobile/tsconfig.json`. Se puede porque los dos tienen `noEmit` (Expo usa Metro y no `tsc` para compilar).
- **Verificado:**
  - Vitest, con 142 tests;
  - `pnpm typecheck` de core y de mobile;
  - `pnpm gen:sql-fixtures --check`;
  - `npx expo export --platform web`, que incluye `/g/[token]`, la pantalla que usa core.
- **Se descartó copiar core** a `supabase/functions/_shared` en cada deploy: serían dos copias que se pueden desincronizar.
- **La función de prueba se borró.** La primera función real que use core va a ser la del aviso de cierre.

## Abierto

- **Deploy:** `serve` lee los archivos del disco, pero el deploy arma un paquete, y el CLI no tiene `--dry-run` para probarlo sin publicar. En el primer deploy al proyecto real hay que confirmar que una función que usa core arranca.
  - Si el paquete no incluye `packages/core`, el plan B es un script que copie `packages/core/src` a `supabase/functions/_shared/core` antes del deploy, ignorado por git.
- **Regla nueva para core:** todo import relativo lleva `.ts`. Si se olvida, Vitest y la app siguen andando y la falla aparece recién en la Edge Function. Conviene un chequeo en CI cuando haya.
