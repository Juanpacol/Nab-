# Despliegue de Nab — runbook

Arquitectura de despliegue: **web en Vercel** (gratis, deploys automáticos) + **api/workers/Postgres/Redis en un VPS** con Docker Compose detrás de Caddy (TLS automático). Ver `/Users/juanpablo/.claude/plans/hazme-un-plan-para-magical-planet.md` para el plan completo por fases.

## 0. Cuentas necesarias

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

## 1. Variables de entorno de producción

Copia `.env.example` como base. Estas son **obligatorias** en producción (la API y los workers fallan al arrancar si faltan — ver `apps/api/src/config/env.validation.ts` y `apps/workers/src/env.validation.ts`):

- `JWT_SECRET` — genera con `openssl rand -base64 32`. Nunca el placeholder de `.env.example`.
- `CORS_ORIGINS` — el dominio real de la web (sin `localhost`), ej. `https://app.tudominio.com`.
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` — credenciales de un bucket R2 real.
- `SMTP_HOST`, `EMAIL_FROM` — proveedor real (ej. `smtp.resend.com`).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — claves de Stripe (test mode para la beta).
- `ANTHROPIC_API_KEY` y `VOYAGE_API_KEY`, **o** `AI_MOCK=true` explícito si aún no los tienes.
- `GREENHOUSE_BOARDS`/`LEVER_BOARDS`/`ADZUNA_APP_ID` (al menos una fuente real), **o** `INGEST_MOCK=true` explícito.

Guarda el `.env` final en `/opt/nab/.env` en el VPS con `chmod 600`, fuera de git.

## 2. Provisión del VPS

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
# Crea /opt/nab/.env con todas las variables de la sección 1, más:
#   POSTGRES_PASSWORD, GHCR_OWNER, API_DOMAIN, BACKUP_S3_*
```

## 3. DNS

En Cloudflare, crea:
- `A api.tudominio.com` → IP del VPS (proxy **desactivado**, nube gris — actívalo después de confirmar que Caddy emitió el certificado).
- El apex/`app` lo gestiona Vercel automáticamente al conectar el dominio ahí (paso 5).

## 4. Primer despliegue del backend

Antes del primer deploy necesitas que CI haya publicado al menos una imagen en GHCR (push a `main` con el hardening ya mergeado — el job `publish` de `.github/workflows/ci.yml` lo hace solo). Luego, en el VPS:

```bash
cd /opt/nab
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f api   # confirma "Nest application successfully started"
```

Verifica: `curl https://api.tudominio.com/health` y `/ready` → `200`. Swagger en `/docs`. SSL Labs grado A.

## 5. Despliegue de la web (Vercel)

1. Importa el repo en Vercel: **Root Directory** = `apps/web`, framework Next.js (autodetectado).
2. Variables de entorno en Vercel: `NEXT_PUBLIC_API_URL=https://api.tudominio.com`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SENTRY_DSN` (opcional).
3. Dominio: conecta `app.tudominio.com` (o el apex) en Vercel → Settings → Domains.
4. Actualiza `CORS_ORIGINS` en `/opt/nab/.env` del VPS con el dominio final de Vercel y reinicia: `docker compose -f docker-compose.prod.yml up -d api`.
5. Cada push a `main` despliega la web automáticamente (Vercel ya lo hace solo).

## 6. Activar el CD automático del backend

Por defecto el job `deploy` de CI está desactivado (evita fallar antes de tener VPS). Para activarlo:

1. En GitHub → Settings → Secrets and variables → Actions → **Secrets**: `SSH_HOST`, `SSH_USER` (`deploy`), `SSH_KEY` (clave privada correspondiente).
2. En la misma sección → **Variables**: crea `DEPLOY_ENABLED` = `true`.
3. Desde ese momento, cada push a `main` publica las imágenes en GHCR y despliega solo en el VPS (`scripts/deploy.sh`, que hace backup → pull → migrate → restart).

Deploy manual (sin esperar a CI): en el VPS, `cd /opt/nab && ./scripts/deploy.sh`.

**Rollback**: `GHCR_IMAGE_TAG=sha-<commit-anterior> ./scripts/deploy.sh` (los tags `sha-<commit>` los publica el job `publish`; revísalos en GHCR o en el historial de Actions).

## 7. Backups

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

## 8. Observabilidad

- **Sentry**: crea 3 proyectos (web/Next.js, api/Node, workers/Node). Pon los DSN en `SENTRY_DSN` (api, workers, VPS `.env`) y `NEXT_PUBLIC_SENTRY_DSN` (Vercel). Opcional: `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` en Vercel para subir source maps.
- **Uptime**: monitores en `https://api.tudominio.com/health` y en la URL de la web, alerta a tu email.
- Logs del VPS ya rotan solo (`docker-compose.prod.yml` fija `max-size: 10m, max-file: 3` por servicio).

## 9. Smoke test final (antes de compartir la beta)

1. Registro con email real → llega verificación (Resend) → verificar cuenta.
2. Reset de contraseña end-to-end.
3. Subir CV → visible/descargable (R2).
4. Esperar/forzar un ciclo de ingesta → vacantes reales, sin duplicados en una segunda corrida.
5. Generar CV/carta con IA (real o `AI_MOCK` explícito) y matching.
6. Stripe test: checkout con `4242 4242 4242 4242` → créditos acreditados; abrir el portal; cancelar → downgrade; reenviar el mismo webhook desde el dashboard de Stripe → confirmar que **no** duplica créditos.
7. WebSocket: notificación en tiempo real en la web (y en la app móvil vía Expo Go apuntando a `EXPO_PUBLIC_API_URL=https://api.tudominio.com`).
8. Rate limit: ráfaga a `/api/auth/login` → `429`.
9. `reboot` del VPS → todo levanta solo (`restart: unless-stopped`); el monitor de uptime lo confirma en minutos.
10. 24-48h con testers reales → revisar Sentry: cero errores no explicados.

## 10. Notas de infraestructura (para quien toque los Dockerfiles)

Bugs ya corregidos que vale la pena recordar si algo similar reaparece:

- **pnpm/corepack en la imagen `runner`**: sin `package.json`/`pnpm-workspace.yaml`/`pnpm-lock.yaml` en esa carpeta, corepack no encuentra el pin `packageManager` y descarga la última versión de pnpm, que puede exigir una versión de Node mayor a la de la imagen. `docker/api.Dockerfile` los copia explícitamente para el servicio `migrate`.
- **Prisma + Alpine**: los engines de Prisma requieren `openssl` instalado (`apk add openssl`), si no, arrancan con la versión de OpenSSL equivocada o fallan directamente.
- **Dependencias directas por workspace**: pnpm enlaza las dependencias de cada app en `apps/<app>/node_modules` (symlinks hacia `/app/node_modules/.pnpm/...`), no solo en el `node_modules` raíz. Si copias solo `/app/node_modules` en el stage `runner`, `node dist/main.js` no encuentra ningún paquete directo (`@nestjs/*`, etc.).
- **Healthchecks con `wget http://localhost:PORT`**: en Alpine, `localhost` puede resolver primero a `::1` (IPv6) mientras Node solo escucha en `0.0.0.0` (IPv4) → "connection refused" con el servidor sano. Usa `127.0.0.1` explícito.
- **Next.js standalone**: sin `ENV HOSTNAME="0.0.0.0"`, el server standalone se bindea a la IP específica del contenedor en vez de todas las interfaces, y ni el propio healthcheck puede conectarse.

## Fase futura (no incluida aún): Google Play

Ver la sección "Fase futura" del plan. Resumen: cuenta de Play Console ($25, verificación de días), Firebase + `google-services.json` para FCM, `eas build --platform android --profile production`, completar `submit.production` en `apps/mobile/eas.json` con una service account, y closed testing track antes de producción pública.
