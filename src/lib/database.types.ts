/**
 * Tipos do banco escritos à mão a partir de docs/spec/DATA-MODEL.md (§3 enums, §4 tabelas, §5 views, §7 RPCs).
 * Formato compatível com `supabase gen types` para troca futura sem mexer no app (FRONTEND-ARCH §4.2).
 * Tipos de linha são `type` (não `interface`): o postgrest-js exige `Record<string, unknown>`, e interfaces
 * não têm assinatura de índice — com `interface` todo `select()` era inferido como `never`.
 * Regras: Row = colunas exatamente como em DATA-MODEL §4 (NN → não-null, — → | null); Insert/Update só
 * para tabelas que o front escreve diretamente por policy; o resto é `never` (tudo passa por RPC).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export * from './database/enums'
export * from './database/rows'
export * from './database/rows-game'
export * from './database/views'
export * from './database/payloads'
export * from './database/schema-tables'
export * from './database/schema-tables-game'
export * from './database/schema-views'
export * from './database/schema-functions'
export * from './database/schema'
