---
name: mivida-finanzas-integracion
description: Las recomendaciones del asistente de "Mi Vida Personal" deben ser realistas según el ingreso real del usuario
metadata:
  type: project
---

El usuario pidió (2026-07-22) que **todo** en la app "Mi Vida Personal" (`C:\Users\Desktop\Documents\FLUJO-TRABAJO-LIMPIO\mi-vida-personal`) debe "jugar" (conectarse) con las finanzas personales. Aclaró el alcance con un ejemplo concreto: "NADIE SE VA A COMER CARNE ROJA CON UN SALARIO DE 2000 REALES" — es decir, las sugerencias del asistente (comidas, compras, equipo, suplementos) deben ser económicamente realistas según los ingresos reales del usuario, no aspiracionales.

**Por qué:** Sin esto, el asistente sugería proteínas caras (salmón, carne roja) sin considerar el ingreso mensual real del usuario, algo que no tiene sentido si esos gastos superarían su presupuesto.

**Cómo aplicar:** Ya implementado en `src/app/api/chat/route.ts` (`buildSystemPrompt`): instrucción explícita de que toda sugerencia con costo real debe ajustarse a los ingresos vistos en "Finanzas personales", priorizando opciones económicas (pollo, huevo, legumbres) y explicando el ajuste cuando ocurre. Verificado con un ingreso simulado de R$2.000 — el asistente evitó carnes premium y explicó el porqué. Si en el futuro se agregan más tipos de sugerencias con costo (equipo de ejercicio, viajes, etc.), extender la misma lógica. Ver [[mivida-arquitectura-supabase]] para el estado técnico general de la app.
