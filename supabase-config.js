/* =========================================================
   Gotiastudio — Conexión con Supabase (estadísticas y panel admin)
   Pega aquí los datos de tu proyecto: Supabase → Project Settings → API.
     · url:     "Project URL"  (https://xxxx.supabase.co)
     · anonKey: la "Publishable key" (sb_publishable_…). Es pública por diseño: la
                base de datos solo deja AGREGAR visitas; leerlas exige entrar como admin.
                (La antigua "anon public", eyJ…, también sirve hasta que Supabase la apague
                a fines de 2026.) Nunca la "secret" (sb_secret_…) ni la "service_role".
   Mientras esté vacío, la web no registra nada y admin.html se abre en
   modo demostración, con datos de ejemplo.
   ========================================================= */
window.GOTIA_SUPABASE = {
  url: 'https://lfxdotatbkbnukjzhbzq.supabase.co',
  anonKey: 'sb_publishable_ZtVrc3c4f5AjvaZvBtz8Pg_QznE62DS'
};
