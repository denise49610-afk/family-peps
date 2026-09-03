# Backend Family Peps (Supabase)

L'app fonctionne **sans Supabase** (100% local). Pour le partage temps réel :

1. Créer un projet sur https://supabase.com
2. SQL Editor → coller `supabase/schema.sql` → Run
3. Settings → API : copier URL + anon key
4. Sur Vercel → Project Settings → Environment Variables :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Redeploy
