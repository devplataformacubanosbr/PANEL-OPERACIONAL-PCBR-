---
name: mivida-arquitectura-supabase
description: Estado técnico de la app "Mi Vida Personal" — Supabase multiusuario, sin git, asistente con tool-calling vía Groq
metadata:
  type: project
---

La app "Mi Vida Personal" (`C:\Users\Desktop\Documents\FLUJO-TRABAJO-LIMPIO\mi-vida-personal`) empezó como Next.js + Prisma/SQLite de un solo usuario, pero el usuario corre (o corrió) otra herramienta/sesión en paralelo sobre la misma carpeta que reescribió la base a Supabase (auth multiusuario, vector store con embeddings para RAG, tabla `tool_logs` de auditoría, `user_profiles` adaptativo). El usuario confirmó explícitamente (2026-07-22): "DEBES TRABAJAR SOBRE ESTA BASE" — no revertir a Prisma/SQLite.

**Por qué importa:**
- La carpeta `mi-vida-personal` **no tiene git inicializado** — no hay red de seguridad para deshacer cambios. Ir con cuidado extra en ediciones grandes.
- Credenciales de Supabase están en `.env.local` (no `.env`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. El usuario autorizó explícitamente usar la service role key para leer/diagnosticar datos vía Supabase JS client — pero esa key NO permite ejecutar DDL (CREATE EXTENSION, ALTER TABLE, etc.), solo operaciones de datos vía PostgREST. Para cambios de esquema el usuario debe correrlos él mismo en el SQL Editor de Supabase (ya lo hizo una vez con `src/lib/supabase_setup.sql`).
- Otro proceso puede estar modificando archivos del proyecto en paralelo a la sesión actual — ver cambios inesperados en `route.ts`/`chat-tools.ts`/`AssistantChat.tsx` como señal, no como error propio.
- El asistente de IA usa Groq (modelo `Qwen/Qwen3.6-27B` vía env `GROQ_MODEL`) con tool-calling nativo. Ya se corrigieron dos bugs reales de esta integración: (1) el modelo a veces filtraba razonamiento crudo `<think>` al contenido — se limpia con `stripThinking()`; (2) sin `max_completion_tokens` ni `reasoning_effort`, el modelo podía "pensar" sin fin en solicitudes abiertas y devolver contenido vacío — se fijó `max_completion_tokens: 8000` y `reasoning_effort: "none"` (verificado que sigue llamando herramientas bien, ~4x menos tokens). También se quitó una instrucción del system prompt que ordenaba usar bloques de texto `[ACTIONS]` en vez de tool_calls nativos — causaba respuestas gigantes que se cortaban a mitad de un JSON para configuraciones masivas (ej. plan de nutrición semanal completo). Para operaciones "configura todos los días a la vez" existen herramientas de reemplazo masivo (`reemplazar_rutina_ejercicios`, `reemplazar_plan_nutricion`) que deben preferirse sobre llamar la herramienta de un solo elemento repetidamente.

**Cómo aplicar:** Antes de asumir que un archivo tiene el contenido que dejamos en la sesión anterior, releerlo — puede haber cambiado. Ver [[mivida-finanzas-integracion]] para un requisito de producto pendiente de aclarar.
