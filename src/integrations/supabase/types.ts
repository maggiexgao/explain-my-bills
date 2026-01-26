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
      analysis_gap_events: {
        Row: {
          bill_hash: string | null
          created_at: string
          extracted_code_count: number | null
          geo_confidence: string | null
          id: string
          missing_code_count: number | null
          priced_item_count: number | null
          totals_confidence: string | null
          totals_detected_type: string | null
          used_state_fallback: boolean | null
          zip_present: boolean | null
        }
        Insert: {
          bill_hash?: string | null
          created_at?: string
          extracted_code_count?: number | null
          geo_confidence?: string | null
          id?: string
          missing_code_count?: number | null
          priced_item_count?: number | null
          totals_confidence?: string | null
          totals_detected_type?: string | null
          used_state_fallback?: boolean | null
          zip_present?: boolean | null
        }
        Update: {
          bill_hash?: string | null
          created_at?: string
          extracted_code_count?: number | null
          geo_confidence?: string | null
          id?: string
          missing_code_count?: number | null
          priced_item_count?: number | null
          totals_confidence?: string | null
          totals_detected_type?: string | null
          used_state_fallback?: boolean | null
          zip_present?: boolean | null
        }
        Relationships: []
      }
      analysis_missing_codes: {
        Row: {
          code: string
          code_system_guess: string | null
          context_type: string
          count: number | null
          first_seen_at: string
          last_seen_at: string
        }
        Insert: {
          code: string
          code_system_guess?: string | null
          context_type?: string
          count?: number | null
          first_seen_at?: string
          last_seen_at?: string
        }
        Update: {
          code?: string
          code_system_guess?: string | null
          context_type?: string
          count?: number | null
          first_seen_at?: string
          last_seen_at?: string
        }
        Relationships: []
      }
      analysis_totals_failures: {
        Row: {
          count: number | null
          doc_type: string
          failure_reason: string
          first_seen_at: string
          last_seen_at: string
        }
        Insert: {
          count?: number | null
          doc_type: string
          failure_reason: string
          first_seen_at?: string
          last_seen_at?: string
        }
        Update: {
          count?: number | null
          doc_type?: string
          failure_reason?: string
          first_seen_at?: string
          last_seen_at?: string
        }
        Relationships: []
      }
      clfs_fee_schedule: {
        Row: {
          created_at: string
          hcpcs: string
          id: string
          long_desc: string | null
          payment_amount: number | null
          short_desc: string | null
          source_file: string
          year: number
        }
        Insert: {
          created_at?: string
          hcpcs: string
          id?: string
          long_desc?: string | null
          payment_amount?: number | null
          short_desc?: string | null
          source_file?: string
          year?: number
        }
        Update: {
          created_at?: string
          hcpcs?: string
          id?: string
          long_desc?: string | null
          payment_amount?: number | null
          short_desc?: string | null
          source_file?: string
          year?: number
        }
        Relationships: []
      }
      code_metadata: {
        Row: {
          code: string
          code_system: string
          last_updated_at: string
          long_desc: string | null
          short_desc: string | null
          source: string
          source_year: number | null
        }
        Insert: {
          code: string
          code_system?: string
          last_updated_at?: string
          long_desc?: string | null
          short_desc?: string | null
          source?: string
          source_year?: number | null
        }
        Update: {
          code?: string
          code_system?: string
          last_updated_at?: string
          long_desc?: string | null
          short_desc?: string | null
          source?: string
          source_year?: number | null
        }
        Relationships: []
      }
      dmepen_fee_schedule: {
        Row: {
          category: string | null
          ceiling: number | null
          created_at: string
          fee: number | null
          fee_rental: number | null
          floor: number | null
          hcpcs: string
          id: string
          jurisdiction: string | null
          modifier: string | null
          modifier2: string | null
          short_desc: string | null
          source_file: string
          state_abbr: string | null
          year: number
        }
        Insert: {
          category?: string | null
          ceiling?: number | null
          created_at?: string
          fee?: number | null
          fee_rental?: number | null
          floor?: number | null
          hcpcs: string
          id?: string
          jurisdiction?: string | null
          modifier?: string | null
          modifier2?: string | null
          short_desc?: string | null
          source_file?: string
          state_abbr?: string | null
          year?: number
        }
        Update: {
          category?: string | null
          ceiling?: number | null
          created_at?: string
          fee?: number | null
          fee_rental?: number | null
          floor?: number | null
          hcpcs?: string
          id?: string
          jurisdiction?: string | null
          modifier?: string | null
          modifier2?: string | null
          short_desc?: string | null
          source_file?: string
          state_abbr?: string | null
          year?: number
        }
        Relationships: []
      }
      dmepos_fee_schedule: {
        Row: {
          category: string | null
          ceiling: number | null
          created_at: string
          fee: number | null
          fee_rental: number | null
          floor: number | null
          hcpcs: string
          id: string
          jurisdiction: string | null
          modifier: string | null
          modifier2: string | null
          short_desc: string | null
          source_file: string
          state_abbr: string | null
          year: number
        }
        Insert: {
          category?: string | null
          ceiling?: number | null
          created_at?: string
          fee?: number | null
          fee_rental?: number | null
          floor?: number | null
          hcpcs: string
          id?: string
          jurisdiction?: string | null
          modifier?: string | null
          modifier2?: string | null
          short_desc?: string | null
          source_file?: string
          state_abbr?: string | null
          year?: number
        }
        Update: {
          category?: string | null
          ceiling?: number | null
          created_at?: string
          fee?: number | null
          fee_rental?: number | null
          floor?: number | null
          hcpcs?: string
          id?: string
          jurisdiction?: string | null
          modifier?: string | null
          modifier2?: string | null
          short_desc?: string | null
          source_file?: string
          state_abbr?: string | null
          year?: number
        }
        Relationships: []
      }
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
      hcpcs_code_info_cache: {
        Row: {
          code: string
          data_version: string | null
          description: string | null
          raw: Json | null
          retrieved_at: string
          short_description: string | null
          source: string
        }
        Insert: {
          code: string
          data_version?: string | null
          description?: string | null
          raw?: Json | null
          retrieved_at?: string
          short_description?: string | null
          source?: string
        }
        Update: {
          code?: string
          data_version?: string | null
          description?: string | null
          raw?: Json | null
          retrieved_at?: string
          short_description?: string | null
          source?: string
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          dataset_name: string
          error_message: string | null
          file_name: string | null
          id: string
          imported_at: string
          imported_by: string | null
          rows_before_dedup: number | null
          rows_imported: number | null
          rows_skipped: number | null
          status: string
        }
        Insert: {
          dataset_name: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          rows_before_dedup?: number | null
          rows_imported?: number | null
          rows_skipped?: number | null
          status?: string
        }
        Update: {
          dataset_name?: string
          error_message?: string | null
          file_name?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          rows_before_dedup?: number | null
          rows_imported?: number | null
          rows_skipped?: number | null
          status?: string
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
      opps_addendum_b: {
        Row: {
          apc: string | null
          created_at: string
          hcpcs: string
          id: string
          long_desc: string | null
          minimum_unadjusted_copayment: number | null
          national_unadjusted_copayment: number | null
          payment_rate: number | null
          relative_weight: number | null
          short_desc: string | null
          source_file: string
          status_indicator: string | null
          year: number
        }
        Insert: {
          apc?: string | null
          created_at?: string
          hcpcs: string
          id?: string
          long_desc?: string | null
          minimum_unadjusted_copayment?: number | null
          national_unadjusted_copayment?: number | null
          payment_rate?: number | null
          relative_weight?: number | null
          short_desc?: string | null
          source_file?: string
          status_indicator?: string | null
          year: number
        }
        Update: {
          apc?: string | null
          created_at?: string
          hcpcs?: string
          id?: string
          long_desc?: string | null
          minimum_unadjusted_copayment?: number | null
          national_unadjusted_copayment?: number | null
          payment_rate?: number | null
          relative_weight?: number | null
          short_desc?: string | null
          source_file?: string
          status_indicator?: string | null
          year?: number
        }
        Relationships: []
      }
      strategy_audit_runs: {
        Row: {
          created_at: string
          dataset_snapshot: Json | null
          id: string
          report_json: Json | null
          report_markdown: string | null
          status: string | null
          summary_fail: number | null
          summary_pass: number | null
          summary_warn: number | null
        }
        Insert: {
          created_at?: string
          dataset_snapshot?: Json | null
          id?: string
          report_json?: Json | null
          report_markdown?: string | null
          status?: string | null
          summary_fail?: number | null
          summary_pass?: number | null
          summary_warn?: number | null
        }
        Update: {
          created_at?: string
          dataset_snapshot?: Json | null
          id?: string
          report_json?: Json | null
          report_markdown?: string | null
          status?: string | null
          summary_fail?: number | null
          summary_pass?: number | null
          summary_warn?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      count_distinct_codes: {
        Args: { p_code_column?: string; p_table_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
