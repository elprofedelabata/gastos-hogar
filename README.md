# Mi casa

PWA móvil-first para registrar gastos compartidos del hogar y mantener
actualizado el balance de quién debe a quién. Todos los gastos corresponden a
Dani y Tati a partes iguales.

## Qué incluye

- Diseño responsive con prioridad móvil.
- Gastos con uno o varios pagadores y reparto automático a partes iguales.
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

## Firebase

El entorno principal usa el proyecto `mi-casa-gastos-dani`, con Authentication
por correo y contraseña y una base de datos Firestore en Europa. Las reglas
solo permiten acceder a quienes tengan un documento de miembro dentro del
hogar.

Para trabajar desde otro equipo, copia `.env.example` como `.env.local` y
completa las variables `VITE_FIREBASE_*` con la configuración de la aplicación
web. Para volver a publicar la configuración del backend:

```bash
npx firebase-tools deploy --only auth,firestore
```

La aplicación nunca incluye contraseñas ni credenciales administrativas.
La configuración web de Firebase identifica el proyecto; Authentication y
`firestore.rules` son quienes protegen los datos.

## Publicar en GitHub Pages

El flujo `.github/workflows/deploy-pages.yml` construye y publica la PWA con
cada cambio de la rama `main`.

GitHub Pages ya está configurado para usar Actions. Si se crea otro repositorio,
añade estos secretos:

1. `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` y
   `VITE_FIREBASE_HOUSEHOLD_ID` con valor `main`.

Sin esos secretos, la versión publicada funciona en modo local y conserva los
gastos únicamente en el navegador utilizado.
