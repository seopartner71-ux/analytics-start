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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      cached_reports: {
        Row: {
          generated_at: string
          id: string
          project_id: string
          report_data: Json
          report_month: number
          report_year: number
        }
        Insert: {
          generated_at?: string
          id?: string
          project_id: string
          report_data?: Json
          report_month: number
          report_year: number
        }
        Update: {
          generated_at?: string
          id?: string
          project_id?: string
          report_data?: Json
          report_month?: number
          report_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "cached_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          api_key: string | null
          connected: boolean
          counter_id: string | null
          created_at: string
          external_project_id: string | null
          id: string
          last_sync: string | null
          project_id: string
          service_name: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          api_key?: string | null
          connected?: boolean
          counter_id?: string | null
          created_at?: string
          external_project_id?: string | null
          id?: string
          last_sync?: string | null
          project_id: string
          service_name: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          api_key?: string | null
          connected?: boolean
          counter_id?: string | null
          created_at?: string
          external_project_id?: string | null
          id?: string
          last_sync?: string | null
          project_id?: string
          service_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      metrika_stats: {
        Row: {
          avg_duration_seconds: number
          bounce_rate: number
          counter_id: string
          created_at: string
          date_from: string
          date_to: string
          fetched_at: string
          id: string
          page_depth: number
          project_id: string
          total_users: number
          total_visits: number
          traffic_sources: Json
          visits_by_day: Json
        }
        Insert: {
          avg_duration_seconds?: number
          bounce_rate?: number
          counter_id: string
          created_at?: string
          date_from: string
          date_to: string
          fetched_at?: string
          id?: string
          page_depth?: number
          project_id: string
          total_users?: number
          total_visits?: number
          traffic_sources?: Json
          visits_by_day?: Json
        }
        Update: {
          avg_duration_seconds?: number
          bounce_rate?: number
          counter_id?: string
          created_at?: string
          date_from?: string
          date_to?: string
          fetched_at?: string
          id?: string
          page_depth?: number
          project_id?: string
          total_users?: number
          total_visits?: number
          traffic_sources?: Json
          visits_by_day?: Json
        }
        Relationships: [
          {
            foreignKeyName: "metrika_stats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_name: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          preferred_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_name?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          preferred_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_name?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          preferred_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          account_manager: string | null
          account_manager_id: string | null
          client_email: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          seo_specialist: string | null
          seo_specialist_id: string | null
          share_link_expires_at: string | null
          share_token: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          account_manager?: string | null
          account_manager_id?: string | null
          client_email?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          seo_specialist?: string | null
          seo_specialist_id?: string | null
          share_link_expires_at?: string | null
          share_token?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          account_manager?: string | null
          account_manager_id?: string | null
          client_email?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          seo_specialist?: string | null
          seo_specialist_id?: string | null
          share_link_expires_at?: string | null
          share_token?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_account_manager_id_fkey"
            columns: ["account_manager_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_seo_specialist_id_fkey"
            columns: ["seo_specialist_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          client_logo_url: string | null
          created_at: string
          default_period: string
          id: string
          modules: Json
          name: string
          project_id: string
          show_comparison: boolean
          updated_at: string
        }
        Insert: {
          client_logo_url?: string | null
          created_at?: string
          default_period?: string
          id?: string
          modules?: Json
          name?: string
          project_id: string
          show_comparison?: boolean
          updated_at?: string
        }
        Update: {
          client_logo_url?: string | null
          created_at?: string
          default_period?: string
          id?: string
          modules?: Json
          name?: string
          project_id?: string
          show_comparison?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          owner_id: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          owner_id: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          owner_id?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_logs: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          link_url: string | null
          project_id: string
          sort_order: number
          status: string
          task_date: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          link_url?: string | null
          project_id: string
          sort_order?: number
          status?: string
          task_date?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          link_url?: string | null
          project_id?: string
          sort_order?: number
          status?: string
          task_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_shared_project: {
        Args: { p_share_token: string }
        Returns: {
          account_manager: string | null
          account_manager_id: string | null
          client_email: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          seo_specialist: string | null
          seo_specialist_id: string | null
          share_link_expires_at: string | null
          share_token: string | null
          updated_at: string
          url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_shared_work_logs: {
        Args: { p_project_id: string }
        Returns: {
          category: string
          created_at: string
          description: string
          id: string
          link_url: string | null
          project_id: string
          sort_order: number
          status: string
          task_date: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "work_logs"
          isOneToOne: false
          isSetofReturn: true
        }
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
      app_role: "admin" | "viewer"
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
      app_role: ["admin", "viewer"],
    },
  },
} as const
