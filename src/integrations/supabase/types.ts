export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      gpci_localities: {
        Row: {
          created_at: string
          id: string
          locality_name: string
          locality_num: string
          mp_gpci: number
          pe_gpci: number
          state_abbr: string
          work_gpci: number
          zip_code: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          locality_name: string
          locality_num: string
          mp_gpci: number
          pe_gpci: number
          state_abbr: string
          work_gpci: number
          zip_code?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          locality_name?: string
          locality_num?: string
          mp_gpci?: number
          pe_gpci?: number
          state_abbr?: string
          work_gpci?: number
          zip_code?: string | null
        }
        Relationships: []
      }
      gpci_state_avg_2026: {
        Row: {
          avg_mp_gpci: number
          avg_pe_gpci: number
          avg_work_gpci: number
          created_at: string
          n_rows: number
          state_abbr: string
          updated_at: string
        }
        Insert: {
          avg_mp_gpci: number
          avg_pe_gpci: number
          avg_work_gpci: number
          created_at?: string
          n_rows?: number
          state_abbr: string
          updated_at?: string
        }
        Update: {
          avg_mp_gpci?: number
          avg_pe_gpci?: number
          avg_work_gpci?: number
          created_at?: string
          n_rows?: number
          state_abbr?: string
          updated_at?: string
        }
        Relationships: []
      }
      mpfs_benchmarks: {
        Row: {
          conversion_factor: number | null
          created_at: string
          description: string | null
          fac_fee: number | null
          fac_pe_rvu: number | null
          global_days: string | null
          hcpcs: string
          id: string
          modifier: string
          mp_rvu: number | null
          mult_surgery_indicator: string | null
          nonfac_fee: number | null
          nonfac_pe_rvu: number | null
          pctc: string | null
          qp_status: string
          source: string
          status: string | null
          work_rvu: number | null
          year: number
        }
        Insert: {
          conversion_factor?: number | null
          created_at?: string
          description?: string | null
          fac_fee?: number | null
          fac_pe_rvu?: number | null
          global_days?: string | null
          hcpcs: string
          id?: string
          modifier?: string
          mp_rvu?: number | null
          mult_surgery_indicator?: string | null
          nonfac_fee?: number | null
          nonfac_pe_rvu?: number | null
          pctc?: string | null
          qp_status?: string
          source?: string
          status?: string | null
          work_rvu?: number | null
          year?: number
        }
        Update: {
          conversion_factor?: number | null
          created_at?: string
          description?: string | null
          fac_fee?: number | null
          fac_pe_rvu?: number | null
          global_days?: string | null
          hcpcs?: string
          id?: string
          modifier?: string
          mp_rvu?: number | null
          mult_surgery_indicator?: string | null
          nonfac_fee?: number | null
          nonfac_pe_rvu?: number | null
          pctc?: string | null
          qp_status?: string
          source?: string
          status?: string | null
          work_rvu?: number | null
          year?: number
        }
        Relationships: []
      }
      zip_to_locality: {
        Row: {
          carrier_num: string | null
          city_name: string | null
          county_name: string | null
          created_at: string
          effective_year: number | null
          id: string
          locality_num: string
          source: string
          state_abbr: string | null
          updated_at: string
          zip5: string
        }
        Insert: {
          carrier_num?: string | null
          city_name?: string | null
          county_name?: string | null
          created_at?: string
          effective_year?: number | null
          id?: string
          locality_num: string
          source?: string
          state_abbr?: string | null
          updated_at?: string
          zip5: string
        }
        Update: {
          carrier_num?: string | null
          city_name?: string | null
          county_name?: string | null
          created_at?: string
          effective_year?: number | null
          id?: string
          locality_num?: string
          source?: string
          state_abbr?: string | null
          updated_at?: string
          zip5?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_gpci_state_averages: {
        Args: never
        Returns: {
          avg_mp_gpci: number
          avg_pe_gpci: number
          avg_work_gpci: number
          n_rows: number
          state_abbr: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
