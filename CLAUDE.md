## Eesmargid
- Ole lakooniline; vastused 3-8 punkti max.
- Kysi lisakysimusi ainult siis, kui on vajalik.
- Kui saad, tee muudatused otse koodis.

## Projekti ulevaade
- Stack: Vite + React + TypeScript + Tailwind + shadcn-ui.
- Auth ja DB: Supabase (tabelid nt: tickets, categories, problem_types, user_roles, profiles, schools, push_tokens).
- Storage: Supabase bucket `ticket-images`.
- Route'id ja rollikontroll: `src/App.tsx`, `src/components/ProtectedRoute`.

## Kiired kasud
- Failid: lehed `src/pages`, hookid `src/hooks`, UI `src/components`.
- Supabase klient: `src/integrations/supabase/client.ts`.
- Auth kontekst: `src/hooks/useAuth.tsx`.

## Kasklused
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm run test`

## Kodeerimise juhised
- Kasuta olemasolevaid komponente ja hooke; ara loo duble.
- Hoia UI keeles (EST) koik tekstid uhtlased.
- Vali vaiksed, otsekohesed muudatused; ara tee refaktorit ilma vajaduseta.
- Kui puudutad Supabase päringuid, kontrolli RLS/role loogikat.

## Tokenite kokkuhoid
- Ara korda koodi, viita failitee ja relevantsetele ridadele.
- Kuva diff/katkend ainult siis, kui kasutaja palub.
- Anneta valmis muutus ja luhike pohjendus.
