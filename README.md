# Mi casa

PWA móvil-first para registrar gastos compartidos del hogar, repartir cada
movimiento entre varias personas y mantener actualizado el balance de quién
debe a quién.

## Estado actual

- Pantalla de inicio responsive.
- Alta de gastos con uno o varios pagadores.
- Reparto independiente entre miembros del hogar.
- Validación exacta de importes y redondeo en céntimos.
- Actualización inmediata del resumen, historial y balance.
- Manifiesto PWA.
- Cliente de Firebase preparado para conectar el backend compartido.

Mientras Firebase no esté configurado, los gastos añadidos se conservan solo
durante la sesión de demostración.

## Desarrollo

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev
```

Para validar la versión de producción:

```bash
npm run build
node --test tests/rendered-html.test.mjs
```

## Firebase

1. Crea un proyecto gratuito de Firebase.
2. Habilita Authentication y Cloud Firestore.
3. Copia `.env.example` como `.env.local`.
4. Completa las variables `NEXT_PUBLIC_FIREBASE_*` con la configuración web
   del proyecto.

Las credenciales locales `.env*` no se incluyen en Git.
