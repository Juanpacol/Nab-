# Despliegue de Nab — runbook

Hay dos rutas de despliegue documentadas aquí:

- **Ruta A — 100% gratis, sin tarjeta de crédito** (recomendada para arrancar la beta sin presupuesto): web en Vercel, Postgres en Neon, Redis en Upstash, API y workers en Render (free tier).
- **Ruta B — VPS de pago** (~€6/mes, cuando haya presupuesto): web en Vercel, todo el backend (Postgres + Redis + API + workers) en un VPS propio con Docker Compose y Caddy. Más control, sin los límites de los free tiers, pero no es gratis.

Ambas comparten el mismo código y Dockerfiles — la diferencia es solo dónde corren.

---

## Ruta A — 100% gratis (Vercel + Neon + Upstash + Render)

### A0. Cuentas necesarias (todas gratis, sin tarjeta)

| Servicio | Para qué | Límite gratis relevante |
|---|---|---|
| [Neon](https://neon.tech) | Postgres + pgvector | 0.5 GB/proyecto, se autosuspende a los 5 min de inactividad (despierta solo en ~1s, sin perder datos) |
| [Upstash](https://upstash.com) | Redis (BullMQ + rate limiting) | 256 MB, ~500K comandos/mes |
| [Render](https://render.com) | API y workers (Docker) | Free web service, se duerme a los 15 min sin tráfico HTTP entrante |
| [Vercel](https://vercel.com) | Web (Next.js) | Gratis, sin límites relevantes para una beta |
| [Resend](https://resend.com) | Email transaccional | 3k emails/mes |
| [Sentry](https://sentry.io) | Errores en producción | Free tier |
| [cron-job.org](https://cron-job.org) o [UptimeRobot](https://uptimerobot.com) | Ping periódico anti-sleep | Gratis |
| GitHub | Imágenes en GHCR (opcional en esta ruta) | Gratis |

No hace falta dominio propio para empezar: Render y Vercel dan subdominios gratis (`nab-api.onrender.com`, `nab.vercel.app`). Se puede añadir un dominio propio más adelante sin cambiar nada de esta arquitectura.

**Limitación a aceptar conscientemente**: Render free duerme cada servicio tras 15 min sin tráfico HTTP. Los workers (que no reciben tráfico HTTP por naturaleza) incluyen un servidor HTTP mínimo solo para esto (`apps/workers/src/health-server.ts`, puerto `4100`). Con un ping externo cada ~10 min a `/health` (api) y `/` (workers), ambos se mantienen despiertos casi siempre — pero un pico de tráfico tras un período sin pings puede sufrir un cold start de hasta ~1 min, y notificaciones en tiempo real (WebSocket) se cortan si el servicio llega a dormirse. Aceptable para una beta con tráfico intermitente; no para producción con SLA.

### A1. Setup de Neon (Postgres)

1. Crea un proyecto en Neon → copia el **connection string** (con `?sslmode=require`) → ese es tu `DATABASE_URL`.
2. No hace falta crear la extensión `vector` a mano: la migración inicial de Prisma la crea sola (`CREATE EXTENSION IF NOT EXISTS "vector"`), y Neon la permite por defecto.

### A2. Setup de Upstash (Redis)

1. Crea una base Redis en Upstash → copia el `REDIS_URL` (formato `rediss://...`, con TLS).
2. **Importante**: en la configuración de la base, cambia la política de eviction de `volatile-lru` (default) a **`noeviction`** — si no, BullMQ puede fallar al intentar escribir cuando la base esté cerca del límite de memoria.
3. Ten en cuenta el límite de comandos/mes: BullMQ hace polling continuo de las colas incluso sin trabajos pendientes. Si ves que se agota la cuota, aumenta los intervalos de polling/lock-renewal en `apps/workers`.

### A3. Variables de entorno

Usa `.env.example` como referencia. Con `AI_MOCK=true` e `INGEST_MOCK=true` (los defaults en `render.yaml`) no necesitas `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` ni boards de ingesta para arrancar — actívalos cuando tengas presupuesto para IA real, cambiando esas dos variables a `false` (o quitándolas) y añadiendo las claves.

Para storage (CVs subidos) necesitas igualmente un S3 compatible — Cloudflare R2 tiene free tier generoso sin tarjeta (10 GB gratis) y es la opción recomendada aquí también.

### A4. Deploy de API y workers en Render

El repo incluye `render.yaml` (Blueprint) con ambos servicios ya definidos, apuntando a `docker/api.Dockerfile` y `docker/workers.Dockerfile`, plan `free`.

1. En Render → **New → Blueprint** → conecta el repo `Juanpacol/Nab-`. Render detecta `render.yaml` y propone crear `nab-api` y `nab-workers`.
2. Completa las variables marcadas `sync: false` (secretos) en el dashboard de cada servicio: `JWT_SECRET` (genera con `openssl rand -base64 32`), `DATABASE_URL` (de Neon), `REDIS_URL` (de Upstash), `S3_*` (de R2), `SMTP_*`/`EMAIL_FROM` (de Resend, solo en `nab-workers`), `CORS_ORIGINS` (el dominio de Vercel, se completa en el paso A5), `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (solo en `nab-api`).
3. Antes del primer deploy, corre las migraciones una vez contra la `DATABASE_URL` de Neon desde tu máquina: `DATABASE_URL="postgresql://..." pnpm --filter @nab/database exec prisma migrate deploy`.
4. Deploy. Verifica: `https://nab-api.onrender.com/health` y `/ready` → `200`.

### A5. Deploy de la web en Vercel

Igual que en la Ruta B (ver sección compartida más abajo), pero usando `NEXT_PUBLIC_API_URL=https://nab-api.onrender.com` (o tu dominio propio si lo conectaste a Render). Después de tener la URL final de Vercel, vuelve a Render y actualiza `CORS_ORIGINS` en `nab-api`.

### A6. Pings anti-sleep

En cron-job.org (o UptimeRobot) crea dos monitores cada ~10 min:
- `GET https://nab-api.onrender.com/health`
- `GET https://nab-workers.onrender.com/`

Esto además te sirve como monitor de caída (si un ping falla, te avisa).

### A7. Cuándo migrar a la Ruta B

Señales de que conviene pasar al VPS: el cold start tras dormir se vuelve molesto para usuarios reales, se agota la cuota de comandos de Upstash, o Neon se queda corto en almacenamiento (0.5 GB). El código no cambia — solo las variables de entorno y dónde corre.

---

## Ruta B — VPS de pago (~€6/mes)

### B0. Cuentas necesarias

| Servicio | Para qué | Costo |
|---|---|---|
| Dominio (Cloudflare Registrar, Namecheap...) | `app.tudominio.com` (Vercel) + `api.tudominio.com` (VPS) | ~$10-15/año |
| VPS (Hetzner CX22 o similar) | api + workers + Postgres + Redis | ~€4-8/mes |
| Vercel | Hosting de la web (Next.js) | Gratis |
| Cloudflare DNS + R2 | DNS del dominio + storage S3-compatible | Gratis en este uso |
| Resend (o cualquier SMTP) | Email transaccional | Gratis hasta 3k/mes |
| Sentry | Errores en producción | Gratis (free tier) |
| UptimeRobot / BetterStack | Monitor de caída | Gratis |
| Anthropic / Voyage AI | IA real (opcional, ver `AI_MOCK`) | Pago por uso / free tier |
| Stripe | Pagos (queda en modo test para la beta) | Gratis en test |
| GitHub | Imágenes en GHCR + CI/CD | Gratis (repo público o plan con Actions) |

### B1. Variables de entorno de producción

Copia `.env.example` como base. Estas son **obligatorias** en producción (la API y los workers fallan al arrancar si faltan — ver `apps/api/src/config/env.validation.ts` y `apps/workers/src/env.validation.ts`):

- `JWT_SECRET` — genera con `openssl rand -base64 32`. Nunca el placeholder de `.env.example`.
- `CORS_ORIGINS` — el dominio real de la web (sin `localhost`), ej. `https://app.tudominio.com`.
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — credenciales de un bucket R2 real.
- `SMTP_HOST`, `EMAIL_FROM` — proveedor real (ej. `smtp.resend.com`).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — claves de Stripe (test mode para la beta).
- `ANTHROPIC_API_KEY` y `VOYAGE_API_KEY`, **o** `AI_MOCK=true` explícito si aún no los tienes.
- `GREENHOUSE_BOARDS`/`LEVER_BOARDS`/`ADZUNA_APP_ID` (al menos una fuente real), **o** `INGEST_MOCK=true` explícito.

Guarda el `.env` final en `/opt/nab/.env` en el VPS con `chmod 600`, fuera de git.

### B2. Provisión del VPS

```bash
# En el VPS recién creado (Ubuntu 24.04), como root:
adduser deploy && usermod -aG sudo,docker deploy
# Copia tu clave pública a /home/deploy/.ssh/authorized_keys, luego:
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
curl -fsSL https://get.docker.com | sh
apt-get install -y awscli   # para scripts/backup.sh y restore.sh
```

Deshabilita el login por contraseña de root vía SSH (`PermitRootLogin no`, `PasswordAuthentication no` en `/etc/ssh/sshd_config`) y reinicia `sshd`.

```bash
mkdir -p /opt/nab/backups && cd /opt/nab
git clone <tu-repo> repo   # o copia solo docker-compose.prod.yml, docker/Caddyfile, scripts/
ln -s repo/docker-compose.prod.yml . && ln -s repo/docker/Caddyfile docker/ && ln -s repo/scripts .
# Crea /opt/nab/.env con todas las variables de la sección B1, más:
#   POSTGRES_PASSWORD, GHCR_OWNER, API_DOMAIN, BACKUP_S3_*
```

### B3. DNS

En Cloudflare, crea:
- `A api.tudominio.com` → IP del VPS (proxy **desactivado**, nube gris — actívalo después de confirmar que Caddy emitió el certificado).
- El apex/`app` lo gestiona Vercel automáticamente al conectar el dominio ahí (paso B4/A5).

### B4. Primer despliegue del backend

Antes del primer deploy necesitas que CI haya publicado al menos una imagen en GHCR (push a `main` con el hardening ya mergeado — el job `publish` de `.github/workflows/ci.yml` lo hace solo). Luego, en el VPS:

```bash
cd /opt/nab
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f api   # confirma "Nest application successfully started"
```

Verifica: `curl https://api.tudominio.com/health` y `/ready` → `200`. Swagger en `/docs`. SSL Labs grado A.

### B5. Activar el CD automático del backend

Por defecto el job `deploy` de CI está desactivado (evita fallar antes de tener VPS). Para activarlo:

1. En GitHub → Settings → Secrets and variables → Actions → **Secrets**: `SSH_HOST`, `SSH_USER` (`deploy`), `SSH_KEY` (clave privada correspondiente).
2. En la misma sección → **Variables**: crea `DEPLOY_ENABLED` = `true`.
3. Desde ese momento, cada push a `main` publica las imágenes en GHCR y despliega solo en el VPS (`scripts/deploy.sh`, que hace backup → pull → migrate → restart).

Deploy manual (sin esperar a CI): en el VPS, `cd /opt/nab && ./scripts/deploy.sh`.

**Rollback**: `GHCR_IMAGE_TAG=sha-<commit-anterior> ./scripts/deploy.sh` (los tags `sha-<commit>` los publica el job `publish`; revísalos en GHCR o en el historial de Actions).

### B6. Backups

- Automático: agrega un cron en el VPS (`crontab -e` del usuario `deploy`):
  ```
  0 3 * * * cd /opt/nab && ./scripts/backup.sh >> /var/log/nab-backup.log 2>&1
  ```
- Retención larga: configura una regla de **lifecycle** en el bucket R2 de `BACKUP_S3_BUCKET` (dashboard de Cloudflare) para expirar objetos con prefix `postgres/` después de, por ejemplo, 30 días. El script solo retiene 2 días localmente.
- **Restore drill (hazlo al menos una vez antes de anunciar la beta)**:
  ```bash
  ./scripts/restore.sh --latest
  ```
  Pide confirmación explícita (escribir "restaurar") porque sobrescribe la base actual. Verifica los conteos de tablas que imprime al final.

---

## Despliegue de la web (Vercel) — compartido por ambas rutas

1. Importa el repo en Vercel: **Root Directory** = `apps/web`, framework Next.js (autodetectado).
2. Variables de entorno en Vercel: `NEXT_PUBLIC_API_URL` (URL de la API, Render o VPS), `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SENTRY_DSN` (opcional).
3. Dominio: conecta tu dominio (o usa el subdominio gratis `*.vercel.app`) en Vercel → Settings → Domains.
4. Actualiza `CORS_ORIGINS` en la API (Render o `/opt/nab/.env` del VPS) con el dominio final de Vercel y reinicia/redeploy.
5. Cada push a `main` despliega la web automáticamente (Vercel ya lo hace solo).

## Observabilidad — compartido

- **Sentry**: crea 3 proyectos (web/Next.js, api/Node, workers/Node). Pon los DSN en `SENTRY_DSN` (api, workers) y `NEXT_PUBLIC_SENTRY_DSN` (Vercel). Opcional: `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` en Vercel para subir source maps.
- **Uptime**: monitores en la URL de salud de la API y en la web (en la Ruta A, estos mismos pings cumplen doble función: mantener despiertos los servicios de Render y avisar de caídas).
- En la Ruta B, los logs del VPS ya rotan solo (`docker-compose.prod.yml` fija `max-size: 10m, max-file: 3` por servicio).

## Smoke test final (antes de compartir la beta) — compartido

1. Registro con email real → llega verificación (Resend) → verificar cuenta.
2. Reset de contraseña end-to-end.
3. Subir CV → visible/descargable (R2).
4. Esperar/forzar un ciclo de ingesta → vacantes reales, sin duplicados en una segunda corrida (o confirmar que `INGEST_MOCK` está sirviendo lo esperado).
5. Generar CV/carta con IA (real o `AI_MOCK` explícito) y matching.
6. Stripe test: checkout con `4242 4242 4242 4242` → créditos acreditados; abrir el portal; cancelar → downgrade; reenviar el mismo webhook desde el dashboard de Stripe → confirmar que **no** duplica créditos.
7. WebSocket: notificación en tiempo real en la web (y en la app móvil vía Expo Go apuntando a `EXPO_PUBLIC_API_URL`). En la Ruta A, prueba esto tanto en frío (tras varios minutos sin actividad) como en caliente.
8. Rate limit: ráfaga a `/api/auth/login` → `429`.
9. En la Ruta B: `reboot` del VPS → todo levanta solo (`restart: unless-stopped`). En la Ruta A: verifica que los pings anti-sleep están corriendo y que el servicio despierta solo tras dormir.
10. 24-48h con testers reales → revisar Sentry: cero errores no explicados.

## Notas de infraestructura (para quien toque los Dockerfiles)

Bugs ya corregidos que vale la pena recordar si algo similar reaparece:

- **pnpm/corepack en la imagen `runner`**: sin `package.json`/`pnpm-workspace.yaml`/`pnpm-lock.yaml` en esa carpeta, corepack no encuentra el pin `packageManager` y descarga la última versión de pnpm, que puede exigir una versión de Node mayor a la de la imagen. `docker/api.Dockerfile` los copia explícitamente para el servicio `migrate`.
- **Prisma + Alpine**: los engines de Prisma requieren `openssl` instalado (`apk add openssl`), si no, arrancan con la versión de OpenSSL equivocada o fallan directamente.
- **Dependencias directas por workspace**: pnpm enlaza las dependencias de cada app en `apps/<app>/node_modules` (symlinks hacia `/app/node_modules/.pnpm/...`), no solo en el `node_modules` raíz. Si copias solo `/app/node_modules` en el stage `runner`, `node dist/main.js` no encuentra ningún paquete directo (`@nestjs/*`, etc.).
- **Healthchecks con `wget http://localhost:PORT`**: en Alpine, `localhost` puede resolver primero a `::1` (IPv6) mientras Node solo escucha en `0.0.0.0` (IPv4) → "connection refused" con el servidor sano. Usa `127.0.0.1` explícito.
- **Next.js standalone**: sin `ENV HOSTNAME="0.0.0.0"`, el server standalone se bindea a la IP específica del contenedor en vez de todas las interfaces, y ni el propio healthcheck puede conectarse.
- **Workers y Render free tier**: Render solo permite "web services" gratis (los "background workers" dedicados requieren plan pago), y estos se duermen sin tráfico HTTP. `apps/workers/src/health-server.ts` añade un servidor HTTP mínimo (puerto `4100`, sin lógica de negocio) solo para que Render lo trate como un web service y un ping externo pueda mantenerlo despierto.

## Fase futura (no incluida aún): Google Play

Ver la sección "Fase futura" del plan. Resumen: cuenta de Play Console ($25, verificación de días), Firebase + `google-services.json` para FCM, `eas build --platform android --profile production`, completar `submit.production` en `apps/mobile/eas.json` con una service account, y closed testing track antes de producción pública.
