export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean
          price_alert_pct: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          id?: boolean
          price_alert_pct?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          price_alert_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: number
          name: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: never
          name: string
          sort_order: number
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      item_classes: {
        Row: {
          base_unit: string
          category_id: number
          created_at: string
          id: number
          name: string
        }
        ComputedFields: never
        Insert: {
          base_unit?: string
          category_id: number
          created_at?: string
          id?: never
          name: string
        }
        Update: {
          base_unit?: string
          category_id?: number
          created_at?: string
          id?: never
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'item_classes_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      markets: {
        Row: {
          address: string | null
          cnpj: string
          cnpj_root: string | null
          created_at: string
          id: number
          legal_name: string
          nickname: string | null
        }
        ComputedFields: never
        Insert: {
          address?: string | null
          cnpj: string
          cnpj_root?: never
          created_at?: string
          id?: never
          legal_name: string
          nickname?: string | null
        }
        Update: {
          address?: string | null
          cnpj?: string
          cnpj_root?: never
          created_at?: string
          id?: never
          legal_name?: string
          nickname?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          class_id: number | null
          cnpj_root: string
          code: string
          created_at: string
          description: string
          id: number
          package_size: number | null
          package_unit: string | null
        }
        ComputedFields: never
        Insert: {
          class_id?: number | null
          cnpj_root: string
          code: string
          created_at?: string
          description: string
          id?: never
          package_size?: number | null
          package_unit?: string | null
        }
        Update: {
          class_id?: number | null
          cnpj_root?: string
          code?: string
          created_at?: string
          description?: string
          id?: never
          package_size?: number | null
          package_unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_class_id_fkey'
            columns: ['class_id']
            isOneToOne: false
            referencedRelation: 'item_classes'
            referencedColumns: ['id']
          },
        ]
      }
      purchase_items: {
        Row: {
          class_id: number | null
          code: string | null
          created_at: string
          description: string
          id: number
          line_number: number
          product_id: number | null
          purchase_id: number
          quantity: number
          total_price: number
          unit: string
          unit_price: number
        }
        ComputedFields: never
        Insert: {
          class_id?: number | null
          code?: string | null
          created_at?: string
          description: string
          id?: never
          line_number: number
          product_id?: number | null
          purchase_id: number
          quantity: number
          total_price: number
          unit: string
          unit_price: number
        }
        Update: {
          class_id?: number | null
          code?: string | null
          created_at?: string
          description?: string
          id?: never
          line_number?: number
          product_id?: number | null
          purchase_id?: number
          quantity?: number
          total_price?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_items_class_id_fkey'
            columns: ['class_id']
            isOneToOne: false
            referencedRelation: 'item_classes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_purchase_id_fkey'
            columns: ['purchase_id']
            isOneToOne: false
            referencedRelation: 'purchases'
            referencedColumns: ['id']
          },
        ]
      }
      purchase_payments: {
        Row: {
          amount: number
          created_at: string
          id: number
          method: string
          purchase_id: number
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          id?: never
          method: string
          purchase_id: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: never
          method?: string
          purchase_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_payments_purchase_id_fkey'
            columns: ['purchase_id']
            isOneToOne: false
            referencedRelation: 'purchases'
            referencedColumns: ['id']
          },
        ]
      }
      purchases: {
        Row: {
          access_key: string
          created_at: string
          discount_total: number
          id: number
          issued_at: string
          market_id: number
          paid_total: number
          products_total: number
        }
        ComputedFields: never
        Insert: {
          access_key: string
          created_at?: string
          discount_total?: number
          id?: never
          issued_at: string
          market_id: number
          paid_total: number
          products_total: number
        }
        Update: {
          access_key?: string
          created_at?: string
          discount_total?: number
          id?: never
          issued_at?: string
          market_id?: number
          paid_total?: number
          products_total?: number
        }
        Relationships: [
          {
            foreignKeyName: 'purchases_market_id_fkey'
            columns: ['market_id']
            isOneToOne: false
            referencedRelation: 'markets'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      item_prices: {
        Row: {
          base_unit: string | null
          class_id: number | null
          description: string
          id: number
          issued_at: string
          market_id: number
          market_nickname: string | null
          package_size: number | null
          package_unit: string | null
          product_id: number | null
          purchase_id: number
          quantity: number
          unit: string
          unit_price: number
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: 'purchase_items_class_id_fkey'
            columns: ['class_id']
            isOneToOne: false
            referencedRelation: 'item_classes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_purchase_id_fkey'
            columns: ['purchase_id']
            isOneToOne: false
            referencedRelation: 'purchases'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchases_market_id_fkey'
            columns: ['market_id']
            isOneToOne: false
            referencedRelation: 'markets'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Functions: {
      ping: { Args: Record<PropertyKey, never>; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
