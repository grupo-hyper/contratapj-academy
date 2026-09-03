// Polyfill de WebSocket para Node.js 20 (sem suporte nativo), exigido pelo
// @supabase/realtime-js ao criar o client (mesmo em scripts que só fazem
// upsert via REST, o client inicializa o RealtimeClient de qualquer forma).
// Uso: npx tsx --import ./wspoly.mjs scripts/seed-lessons.ts
import WebSocket from 'ws'

globalThis.WebSocket = WebSocket
