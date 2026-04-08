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
      audit_checks: {
        Row: {
          assigned_to: string | null
          audit_date: string
          check_name: string
          check_number: string
          check_type: string
          comment: string | null
          created_at: string
          difficulty: string
          external_url: string | null
          id: string
          importance: string
          project_id: string
          result: string
          section: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          audit_date?: string
          check_name: string
          check_number: string
          check_type?: string
          comment?: string | null
          created_at?: string
          difficulty?: string
          external_url?: string | null
          id?: string
          importance?: string
          project_id: string
          result?: string
          section?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          audit_date?: string
          check_name?: string
          check_number?: string
          check_type?: string
          comment?: string | null
          created_at?: string
          difficulty?: string
          external_url?: string | null
          id?: string
          importance?: string
          project_id?: string
          result?: string
          section?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_checks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_url_errors: {
        Row: {
          audit_check_id: string
          created_at: string
          error_detail: string | null
          id: string
          url: string
        }
        Insert: {
          audit_check_id: string
          created_at?: string
          error_detail?: string | null
          id?: string
          url?: string
        }
        Update: {
          audit_check_id?: string
          created_at?: string
          error_detail?: string | null
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_url_errors_audit_check_id_fkey"
            columns: ["audit_check_id"]
            isOneToOne: false
            referencedRelation: "audit_checks"
            referencedColumns: ["id"]
          },
        ]
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
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          user_email: string
          user_id: string
          user_name: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          user_email?: string
          user_id: string
          user_name?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          user_email?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          email: string | null
          employee_count: number | null
          id: string
          industry: string | null
          inn: string | null
          logo: string | null
          name: string
          owner_id: string
          phone: string | null
          responsible_id: string | null
          type: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          inn?: string | null
          logo?: string | null
          name: string
          owner_id: string
          phone?: string | null
          responsible_id?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          inn?: string | null
          logo?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          responsible_id?: string | null
          type?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          creator_id: string | null
          deadline: string | null
          description: string | null
          id: string
          owner_id: string
          priority: string
          project_id: string | null
          stage: string
          stage_color: string | null
          stage_progress: number | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          creator_id?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          owner_id: string
          priority?: string
          project_id?: string | null
          stage?: string
          stage_color?: string | null
          stage_progress?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          creator_id?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          owner_id?: string
          priority?: string
          project_id?: string | null
          stage?: string
          stage_color?: string | null
          stage_progress?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string
          id: string
          owner_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          company_id: string
          created_at?: string
          id?: string
          owner_id: string
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      notifications: {
        Row: {
          body: string
          created_at: string
          error_id: string | null
          id: string
          is_read: boolean
          project_id: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          error_id?: string | null
          id?: string
          is_read?: boolean
          project_id: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          error_id?: string | null
          id?: string
          is_read?: boolean
          project_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_error_id_fkey"
            columns: ["error_id"]
            isOneToOne: false
            referencedRelation: "site_errors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
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
      project_analytics: {
        Row: {
          avg_position: number
          created_at: string
          id: string
          month: string
          organic_traffic: number
          project_id: string
        }
        Insert: {
          avg_position?: number
          created_at?: string
          id?: string
          month: string
          organic_traffic?: number
          project_id: string
        }
        Update: {
          avg_position?: number
          created_at?: string
          id?: string
          month?: string
          organic_traffic?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_analytics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          name: string
          project_id: string
          size: number
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          project_id: string
          size?: number
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          project_id?: string
          size?: number
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_keywords: {
        Row: {
          id: string
          keyword: string
          position: number
          position_change: number
          project_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          keyword: string
          position?: number
          position_change?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          keyword?: string
          position?: number
          position_change?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_keywords_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          account_manager: string | null
          account_manager_id: string | null
          client_email: string | null
          company_id: string | null
          created_at: string
          deadline: string | null
          description: string | null
          efficiency: number | null
          id: string
          logo_url: string | null
          metrika_counter_id: string | null
          name: string
          owner_id: string
          privacy: string | null
          seo_specialist: string | null
          seo_specialist_id: string | null
          share_link_expires_at: string | null
          share_token: string | null
          topvisor_api_key: string | null
          topvisor_project_id: string | null
          topvisor_user_id: string | null
          updated_at: string
          url: string | null
          yandex_webmaster_host_id: string | null
        }
        Insert: {
          account_manager?: string | null
          account_manager_id?: string | null
          client_email?: string | null
          company_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          efficiency?: number | null
          id?: string
          logo_url?: string | null
          metrika_counter_id?: string | null
          name: string
          owner_id: string
          privacy?: string | null
          seo_specialist?: string | null
          seo_specialist_id?: string | null
          share_link_expires_at?: string | null
          share_token?: string | null
          topvisor_api_key?: string | null
          topvisor_project_id?: string | null
          topvisor_user_id?: string | null
          updated_at?: string
          url?: string | null
          yandex_webmaster_host_id?: string | null
        }
        Update: {
          account_manager?: string | null
          account_manager_id?: string | null
          client_email?: string | null
          company_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          efficiency?: number | null
          id?: string
          logo_url?: string | null
          metrika_counter_id?: string | null
          name?: string
          owner_id?: string
          privacy?: string | null
          seo_specialist?: string | null
          seo_specialist_id?: string | null
          share_link_expires_at?: string | null
          share_token?: string | null
          topvisor_api_key?: string | null
          topvisor_project_id?: string | null
          topvisor_user_id?: string | null
          updated_at?: string
          url?: string | null
          yandex_webmaster_host_id?: string | null
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
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      site_errors: {
        Row: {
          detected_at: string
          error_type: string
          id: string
          project_id: string
          source: string
          status: string
          url: string
        }
        Insert: {
          detected_at?: string
          error_type: string
          id?: string
          project_id: string
          source?: string
          status?: string
          url?: string
        }
        Update: {
          detected_at?: string
          error_type?: string
          id?: string
          project_id?: string
          source?: string
          status?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_errors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_health: {
        Row: {
          id: string
          metric_name: string
          metric_value: string
          project_id: string
          source: string
          updated_at: string
        }
        Insert: {
          id?: string
          metric_name: string
          metric_value?: string
          project_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          id?: string
          metric_name?: string
          metric_value?: string
          project_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_health_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          created_at: string
          id: string
          is_done: boolean
          sort_order: number
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_done?: boolean
          sort_order?: number
          task_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_done?: boolean
          sort_order?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_system: boolean
          task_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_system?: boolean
          task_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_system?: boolean
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          last_active: string | null
          owner_id: string
          phone: string | null
          role: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_active?: string | null
          owner_id: string
          phone?: string | null
          role?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_active?: string | null
          owner_id?: string
          phone?: string | null
          role?: string
          status?: string | null
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
      yandex_webmaster_checks: {
        Row: {
          api_field: string | null
          assigned_to: string | null
          check_name: string
          check_number: string
          created_at: string
          error_details_json: Json | null
          id: string
          project_id: string
          section: string
          status: string
          synced_at: string
          task_status: string
          task_text: string | null
          updated_at: string
        }
        Insert: {
          api_field?: string | null
          assigned_to?: string | null
          check_name: string
          check_number: string
          created_at?: string
          error_details_json?: Json | null
          id?: string
          project_id: string
          section?: string
          status?: string
          synced_at?: string
          task_status?: string
          task_text?: string | null
          updated_at?: string
        }
        Update: {
          api_field?: string | null
          assigned_to?: string | null
          check_name?: string
          check_number?: string
          created_at?: string
          error_details_json?: Json | null
          id?: string
          project_id?: string
          section?: string
          status?: string
          synced_at?: string
          task_status?: string
          task_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "yandex_webmaster_checks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "yandex_webmaster_checks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      yandex_webmaster_snapshots: {
        Row: {
          avg_ctr: number
          avg_position: number
          created_at: string
          excluded_pages: number
          external_links: number
          id: string
          indexed_pages: number
          project_id: string
          referring_domains: number
          snapshot_date: string
          total_queries: number
        }
        Insert: {
          avg_ctr?: number
          avg_position?: number
          created_at?: string
          excluded_pages?: number
          external_links?: number
          id?: string
          indexed_pages?: number
          project_id: string
          referring_domains?: number
          snapshot_date?: string
          total_queries?: number
        }
        Update: {
          avg_ctr?: number
          avg_position?: number
          created_at?: string
          excluded_pages?: number
          external_links?: number
          id?: string
          indexed_pages?: number
          project_id?: string
          referring_domains?: number
          snapshot_date?: string
          total_queries?: number
        }
        Relationships: [
          {
            foreignKeyName: "yandex_webmaster_snapshots_project_id_fkey"
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
          company_id: string | null
          created_at: string
          deadline: string | null
          description: string | null
          efficiency: number | null
          id: string
          logo_url: string | null
          metrika_counter_id: string | null
          name: string
          owner_id: string
          privacy: string | null
          seo_specialist: string | null
          seo_specialist_id: string | null
          share_link_expires_at: string | null
          share_token: string | null
          topvisor_api_key: string | null
          topvisor_project_id: string | null
          topvisor_user_id: string | null
          updated_at: string
          url: string | null
          yandex_webmaster_host_id: string | null
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
      app_role: "admin" | "viewer" | "manager"
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
      app_role: ["admin", "viewer", "manager"],
    },
  },
} as const
