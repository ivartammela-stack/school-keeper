# AGENTS.md

## Eesmargid
- Ole lakooniline; vastused 3-8 punkti max.
- Kysi lisakysimusi ainult siis, kui on vajalik.
- Kui saad, tee muudatused otse koodis.

## Projekti ulevaade
- Stack: Vite + React + TypeScript + Tailwind + shadcn-ui + Capacitor.
- Auth ja DB: Firebase (Firestore, Auth).
- Storage: Firebase Storage (ticketi pildid on download URL-id).
- Funktsioonid: Firebase Cloud Functions (setUserRole, deleteUser).

## Kiired kasud
- Failid: lehed `src/pages`, hookid `src/hooks`, UI `src/components`.
- Firebase kliendid: `src/lib/firebase.ts` + teenused `src/lib/firestore.ts`, `src/lib/firebase-auth.ts`, `src/lib/firebase-storage.ts`.
- Auth kontekst: `src/hooks/useAuth.tsx`.

## Kasklused
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Deploy: `firebase deploy --only hosting,functions`

## Kodeerimise juhised
- Hoia muudatused Firebase-pohised; ara too tagasi Supabase.
- Kasuta olemasolevaid komponente ja hooke; ara loo duble.
- Hoia UI tekstid eesti keeles uhtlased.
- Kui puudutad rollilogikat, uuenda `users.role` ja vajadusel custom claims.
