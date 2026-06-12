# Card House catalog language filter patch

This patch prevents Asian-language Cardmarket Pokemon expansions/products from entering the English-only catalog/export.

Updated files:
- src/lib/pokemonCatalogImport.ts
- src/app/api/admin/catalog/export-powertools/route.ts
- src/app/admin/catalog/page.tsx

After copying the files, run:
npm run build
