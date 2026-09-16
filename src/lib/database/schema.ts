import type { PublicEnums, PublicFunctions, PublicTables, PublicViews, RpcPayloads } from '../database.types'

// ---------------------------------------------------------------------------
// Database (formato do gerador oficial) + helpers com os mesmos nomes do gerador
// ---------------------------------------------------------------------------

export type Database = {
  public: {
    Tables: PublicTables
    Views: PublicViews
    Functions: PublicFunctions
    Enums: PublicEnums
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
export type Views<V extends keyof Database['public']['Views']> = Database['public']['Views'][V]['Row']
export type Enums<E extends keyof Database['public']['Enums']> = Database['public']['Enums'][E]
export type RpcName = keyof Database['public']['Functions']
export type RpcArgs<N extends RpcName> = Database['public']['Functions'][N]['Args']
export type RpcResult<N extends RpcName> = N extends keyof RpcPayloads
  ? RpcPayloads[N]
  : Database['public']['Functions'][N]['Returns']
