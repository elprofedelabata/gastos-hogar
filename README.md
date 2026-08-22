# Mi casa

PWA móvil-first para registrar gastos compartidos del hogar, repartir cada
movimiento entre varias personas y mantener actualizado el balance de quién
debe a quién.

## Qué incluye

- Diseño responsive con prioridad móvil.
- Gastos con uno o varios pagadores y reparto independiente.
- Validación exacta y redondeo en céntimos.
- Instalación como PWA y funcionamiento básico sin conexión.
- Persistencia automática en el navegador cuando Firebase no está configurado.
- Acceso mediante Firebase Authentication y sincronización en tiempo real con
  Cloud Firestore cuando se añaden las variables de entorno.
- Publicación automática en GitHub Pages mediante GitHub Actions.

## Desarrollo

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev
```

Validación completa:

```bash
npm test
npm run lint
```

## Configurar Firebase

1. Crea un proyecto gratuito en Firebase.
2. Registra una aplicación web.
3. Activa Authentication con correo y contraseña.
4. Crea manualmente la cuenta familiar en Authentication.
5. Activa Cloud Firestore.
6. Copia `.env.example` como `.env.local` y completa las variables
   `VITE_FIREBASE_*`.
7. En Firestore crea el documento
   `households/main/members/UID_DE_LA_CUENTA` con el campo `role: "admin"`.
8. Copia `.firebaserc.example` como `.firebaserc`, sustituye el identificador
   del proyecto y publica las reglas con `firebase deploy --only firestore`.

La aplicación nunca incluye contraseñas ni credenciales administrativas.
La configuración web de Firebase identifica el proyecto; Authentication y
`firestore.rules` son quienes protegen los datos.

## Publicar en GitHub Pages

El flujo `.github/workflows/deploy-pages.yml` construye y publica la PWA con
cada cambio de la rama `main`.

En el repositorio:

1. Activa **Settings → Pages → Source → GitHub Actions**.
2. Añade estos secretos de Actions:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` y
   `VITE_FIREBASE_HOUSEHOLD_ID` con valor `main`.
3. Añade el dominio `TU_USUARIO.github.io` a **Authentication → Settings →
   Authorized domains** en Firebase.

Sin esos secretos, la versión publicada funciona en modo local y conserva los
gastos únicamente en el navegador utilizado.
