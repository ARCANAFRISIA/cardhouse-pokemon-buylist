# Card House Pokémon catalog - TCG API cache patch

Replace:

- `src/lib/pokemonTcgApi.ts`

This patch prevents a temporary Pokémon TCG/Scrydex Cloudflare 504 on `/v2/sets` from breaking the catalog dry run/import.

It adds:

- request timeout + retry
- lower page size for `/sets`
- DB cache in `BuylistSetting` under `pokemonTcgSetsCacheJson`
- stale cache fallback
- emergency static set fallback

No Prisma migration is needed.
