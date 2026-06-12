BEGIN;

DELETE FROM "PokemonPrice"
WHERE "cardKey" IN (
  SELECT "cardKey"
  FROM "PokemonCard"
  WHERE
    "setName" ILIKE '%Additionals%'
    OR "setName" ILIKE '%Gem Pack%'
    OR "setName" ILIKE '%Terastal Gathering%'
    OR "setName" ILIKE '%Battle Partners%'
    OR "setName" ILIKE '%Heat Wave Arena%'
    OR "setName" ILIKE '%Hot Wind Arena%'
    OR "setName" ILIKE '%Glory of Team Rocket%'
    OR "setCode" ILIKE 'CSV%'
    OR "setCode" ILIKE 'XCR%'
    OR "setCode" ILIKE 'CRB%C'
    OR ("setCode" ILIKE '%C' AND length("setCode") >= 5)
);

DELETE FROM "PokemonCard"
WHERE
  "setName" ILIKE '%Additionals%'
  OR "setName" ILIKE '%Gem Pack%'
  OR "setName" ILIKE '%Terastal Gathering%'
  OR "setName" ILIKE '%Battle Partners%'
  OR "setName" ILIKE '%Heat Wave Arena%'
  OR "setName" ILIKE '%Hot Wind Arena%'
  OR "setName" ILIKE '%Glory of Team Rocket%'
  OR "setCode" ILIKE 'CSV%'
  OR "setCode" ILIKE 'XCR%'
  OR "setCode" ILIKE 'CRB%C'
  OR ("setCode" ILIKE '%C' AND length("setCode") >= 5);

COMMIT;
