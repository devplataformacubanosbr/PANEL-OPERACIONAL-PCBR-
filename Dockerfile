# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine AS builder

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (producción y desarrollo)
RUN npm ci --frozen-lockfile --legacy-peer-deps

# Copiar solo los archivos necesarios para la construcción
COPY public ./public
COPY src ./src
COPY vite.config.js ./
COPY index.html ./

# Pasar variables de entorno durante la construcción
ARG VITE_SUPABASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ARG VITE_GROQ_API_KEY
ENV VITE_GROQ_API_KEY=$VITE_GROQ_API_KEY
ARG VITE_OPENROUTER_API_KEY
ENV VITE_OPENROUTER_API_KEY=$VITE_OPENROUTER_API_KEY
ARG VITE_KOMMO_WEBHOOK_URL
ENV VITE_KOMMO_WEBHOOK_URL=$VITE_KOMMO_WEBHOOK_URL
ARG VITE_CHATWOOT_TOKEN
ENV VITE_CHATWOOT_TOKEN=$VITE_CHATWOOT_TOKEN

# Construir la aplicación con optimizaciones de rendimiento
RUN npm run build

# ── Stage 2: Serve with optimized nginx ─────────────────────
FROM nginx:alpine

# Copiar archivos construidos
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración de nginx optimizada para rendimiento
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Configurar permisos y optimizaciones
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Exponer puerto
EXPOSE 80

# Comando para iniciar nginx
CMD ["nginx", "-g", "daemon off;"]
