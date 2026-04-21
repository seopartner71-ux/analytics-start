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
      ai_assistant_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_feedback: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          question: string
          reason: string | null
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          question: string
          reason?: string | null
          user_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          question?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
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
      bank_accounts: {
        Row: {
          account_number: string
          balance: number
          bank_name: string
          bik: string | null
          created_at: string
          currency: string
          id: string
          integration_id: string
          is_active: boolean
          last_sync_at: string | null
          meta: Json
          owner_id: string
          updated_at: string
        }
        Insert: {
          account_number: string
          balance?: number
          bank_name?: string
          bik?: string | null
          created_at?: string
          currency?: string
          id?: string
          integration_id: string
          is_active?: boolean
          last_sync_at?: string | null
          meta?: Json
          owner_id: string
          updated_at?: string
        }
        Update: {
          account_number?: string
          balance?: number
          bank_name?: string
          bik?: string | null
          created_at?: string
          currency?: string
          id?: string
          integration_id?: string
          is_active?: boolean
          last_sync_at?: string | null
          meta?: Json
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "bank_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_integrations: {
        Row: {
          access_token: string | null
          created_at: string
          display_name: string
          error_message: string | null
          expires_at: string | null
          id: string
          last_sync_at: string | null
          meta: Json
          owner_id: string
          provider: string
          refresh_token: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          display_name?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          last_sync_at?: string | null
          meta?: Json
          owner_id: string
          provider: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          display_name?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          last_sync_at?: string | null
          meta?: Json
          owner_id?: string
          provider?: string
          refresh_token?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_transactions: {
        Row: {
          account_id: string
          amount: number
          category: string
          counterparty: string
          counterparty_inn: string | null
          created_at: string
          direction: string
          external_id: string | null
          id: string
          linked_expense_id: string | null
          linked_invoice_id: string | null
          operation_date: string
          owner_id: string
          purpose: string
          raw_data: Json
        }
        Insert: {
          account_id: string
          amount: number
          category?: string
          counterparty?: string
          counterparty_inn?: string | null
          created_at?: string
          direction: string
          external_id?: string | null
          id?: string
          linked_expense_id?: string | null
          linked_invoice_id?: string | null
          operation_date: string
          owner_id: string
          purpose?: string
          raw_data?: Json
        }
        Update: {
          account_id?: string
          amount?: number
          category?: string
          counterparty?: string
          counterparty_inn?: string | null
          created_at?: string
          direction?: string
          external_id?: string | null
          id?: string
          linked_expense_id?: string | null
          linked_invoice_id?: string | null
          operation_date?: string
          owner_id?: string
          purpose?: string
          raw_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_linked_expense_id_fkey"
            columns: ["linked_expense_id"]
            isOneToOne: false
            referencedRelation: "finance_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_linked_invoice_id_fkey"
            columns: ["linked_invoice_id"]
            isOneToOne: false
            referencedRelation: "finance_invoices"
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
      company_news: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          pinned: boolean
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by: string
          id?: string
          pinned?: boolean
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          pinned?: boolean
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_news_reads: {
        Row: {
          news_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          news_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          news_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_news_reads_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "company_news"
            referencedColumns: ["id"]
          },
        ]
      }
      company_requisites: {
        Row: {
          account_number: string | null
          bank_name: string | null
          bik: string | null
          correspondent_account: string | null
          created_at: string
          director_name: string | null
          email: string | null
          id: string
          inn: string | null
          kpp: string | null
          legal_address: string | null
          legal_name: string
          logo_url: string | null
          ogrn: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          bik?: string | null
          correspondent_account?: string | null
          created_at?: string
          director_name?: string | null
          email?: string | null
          id?: string
          inn?: string | null
          kpp?: string | null
          legal_address?: string | null
          legal_name?: string
          logo_url?: string | null
          ogrn?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          bik?: string | null
          correspondent_account?: string | null
          created_at?: string
          director_name?: string | null
          email?: string | null
          id?: string
          inn?: string | null
          kpp?: string | null
          legal_address?: string | null
          legal_name?: string
          logo_url?: string | null
          ogrn?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crawl_issues: {
        Row: {
          code: string
          created_at: string
          details: Json | null
          id: string
          job_id: string
          message: string | null
          page_id: string | null
          severity: string
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          details?: Json | null
          id?: string
          job_id: string
          message?: string | null
          page_id?: string | null
          severity?: string
          type: string
        }
        Update: {
          code?: string
          created_at?: string
          details?: Json | null
          id?: string
          job_id?: string
          message?: string | null
          page_id?: string | null
          severity?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_issues_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "crawl_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_issues_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "crawl_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          progress: number
          project_id: string
          started_at: string | null
          status: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          progress?: number
          project_id: string
          started_at?: string | null
          status?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          progress?: number
          project_id?: string
          started_at?: string | null
          status?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      crawl_pages: {
        Row: {
          canonical: string | null
          created_at: string
          depth: number | null
          description: string | null
          h1: string | null
          id: string
          is_indexed: boolean | null
          job_id: string
          load_time_ms: number | null
          status_code: number | null
          title: string | null
          url: string
          word_count: number | null
        }
        Insert: {
          canonical?: string | null
          created_at?: string
          depth?: number | null
          description?: string | null
          h1?: string | null
          id?: string
          is_indexed?: boolean | null
          job_id: string
          load_time_ms?: number | null
          status_code?: number | null
          title?: string | null
          url: string
          word_count?: number | null
        }
        Update: {
          canonical?: string | null
          created_at?: string
          depth?: number | null
          description?: string | null
          h1?: string | null
          id?: string
          is_indexed?: boolean | null
          job_id?: string
          load_time_ms?: number | null
          status_code?: number | null
          title?: string | null
          url?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_pages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "crawl_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_stats: {
        Row: {
          avg_load_time_ms: number
          created_at: string
          critical_count: number
          id: string
          info_count: number
          job_id: string
          score: number
          total_issues: number
          total_pages: number
          warning_count: number
        }
        Insert: {
          avg_load_time_ms?: number
          created_at?: string
          critical_count?: number
          id?: string
          info_count?: number
          job_id: string
          score?: number
          total_issues?: number
          total_pages?: number
          warning_count?: number
        }
        Update: {
          avg_load_time_ms?: number
          created_at?: string
          critical_count?: number
          id?: string
          info_count?: number
          job_id?: string
          score?: number
          total_issues?: number
          total_pages?: number
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "crawl_stats_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "crawl_jobs"
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
          week_number: number | null
          week_year: number | null
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
          week_number?: number | null
          week_year?: number | null
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
          week_number?: number | null
          week_year?: number | null
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
      finance_clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finance_expenses: {
        Row: {
          amount: number
          category: string
          comment: string | null
          created_at: string
          expense_date: string
          id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          comment?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          comment?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      finance_invoices: {
        Row: {
          amount: number
          client_id: string | null
          client_name: string
          created_at: string
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string
          owner_id: string
          services: Json
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          client_name?: string
          created_at?: string
          due_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string
          owner_id: string
          services?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          client_name?: string
          created_at?: string
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          owner_id?: string
          services?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "finance_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payments: {
        Row: {
          client_id: string | null
          client_name: string
          comment: string | null
          contract_amount: number
          created_at: string
          id: string
          next_payment_date: string | null
          owner_id: string
          paid_amount: number
          recurrence: string
          service: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string
          comment?: string | null
          contract_amount?: number
          created_at?: string
          id?: string
          next_payment_date?: string | null
          owner_id: string
          paid_amount?: number
          recurrence?: string
          service?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          comment?: string | null
          contract_amount?: number
          created_at?: string
          id?: string
          next_payment_date?: string | null
          owner_id?: string
          paid_amount?: number
          recurrence?: string
          service?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "finance_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_taxes: {
        Row: {
          amount: number
          created_at: string
          id: string
          owner_id: string
          paid_at: string | null
          quarter: number
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          owner_id: string
          paid_at?: string | null
          quarter: number
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          owner_id?: string
          paid_at?: string | null
          quarter?: number
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      financial_clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financial_expenses: {
        Row: {
          added_by: string | null
          added_by_name: string | null
          amount: number
          category: string
          comment: string | null
          created_at: string
          expense_date: string
          id: string
          receipt_url: string | null
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          added_by_name?: string | null
          amount?: number
          category?: string
          comment?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          added_by_name?: string | null
          amount?: number
          category?: string
          comment?: string | null
          created_at?: string
          expense_date?: string
          id?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financial_invoices: {
        Row: {
          amount: number
          client_id: string | null
          client_name: string
          comment: string | null
          created_at: string
          due_at: string | null
          id: string
          invoice_number: string
          issued_at: string
          services: Json
          status: string
          updated_at: string
          vat_included: boolean
          vat_rate: number
        }
        Insert: {
          amount?: number
          client_id?: string | null
          client_name?: string
          comment?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          invoice_number: string
          issued_at?: string
          services?: Json
          status?: string
          updated_at?: string
          vat_included?: boolean
          vat_rate?: number
        }
        Update: {
          amount?: number
          client_id?: string | null
          client_name?: string
          comment?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          invoice_number?: string
          issued_at?: string
          services?: Json
          status?: string
          updated_at?: string
          vat_included?: boolean
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "financial_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payment_history: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          paid_at: string
          payment_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_at?: string
          payment_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          paid_at?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_payment_history_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "financial_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payments: {
        Row: {
          client_id: string | null
          client_name: string
          comment: string | null
          contract_amount: number
          created_at: string
          due_date: string | null
          id: string
          next_payment_date: string | null
          paid_amount: number
          recurrence: string
          service: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string
          comment?: string | null
          contract_amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          next_payment_date?: string | null
          paid_amount?: number
          recurrence?: string
          service?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          comment?: string | null
          contract_amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          next_payment_date?: string | null
          paid_amount?: number
          recurrence?: string
          service?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "financial_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_taxes: {
        Row: {
          amount: number
          created_at: string
          due_date: string | null
          id: string
          income_base: number
          paid_amount: number
          paid_at: string | null
          quarter: number | null
          rate: number
          status: string
          tax_type: string
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          income_base?: number
          paid_amount?: number
          paid_at?: string | null
          quarter?: number | null
          rate?: number
          status?: string
          tax_type?: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          income_base?: number
          paid_amount?: number
          paid_at?: string | null
          quarter?: number | null
          rate?: number
          status?: string
          tax_type?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      gsc_daily_stats: {
        Row: {
          clicks: number
          ctr: number
          fetched_at: string
          id: string
          impressions: number
          position: number
          project_id: string
          stat_date: string
        }
        Insert: {
          clicks?: number
          ctr?: number
          fetched_at?: string
          id?: string
          impressions?: number
          position?: number
          project_id: string
          stat_date: string
        }
        Update: {
          clicks?: number
          ctr?: number
          fetched_at?: string
          id?: string
          impressions?: number
          position?: number
          project_id?: string
          stat_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_daily_stats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_pages: {
        Row: {
          clicks: number
          ctr: number
          date_from: string
          date_to: string
          fetched_at: string
          id: string
          impressions: number
          page_url: string
          position: number
          project_id: string
        }
        Insert: {
          clicks?: number
          ctr?: number
          date_from: string
          date_to: string
          fetched_at?: string
          id?: string
          impressions?: number
          page_url: string
          position?: number
          project_id: string
        }
        Update: {
          clicks?: number
          ctr?: number
          date_from?: string
          date_to?: string
          fetched_at?: string
          id?: string
          impressions?: number
          page_url?: string
          position?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_queries: {
        Row: {
          clicks: number
          ctr: number
          date_from: string
          date_to: string
          fetched_at: string
          id: string
          impressions: number
          position: number
          project_id: string
          query: string
        }
        Insert: {
          clicks?: number
          ctr?: number
          date_from: string
          date_to: string
          fetched_at?: string
          id?: string
          impressions?: number
          position?: number
          project_id: string
          query: string
        }
        Update: {
          clicks?: number
          ctr?: number
          date_from?: string
          date_to?: string
          fetched_at?: string
          id?: string
          impressions?: number
          position?: number
          project_id?: string
          query?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_queries_project_id_fkey"
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
      knowledge_articles: {
        Row: {
          author_id: string
          category: string
          content: string
          created_at: string
          id: string
          tags: string[]
          title: string
          updated_at: string
          updated_by: string | null
          views_count: number
        }
        Insert: {
          author_id: string
          category?: string
          content?: string
          created_at?: string
          id?: string
          tags?: string[]
          title: string
          updated_at?: string
          updated_by?: string | null
          views_count?: number
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          created_at?: string
          id?: string
          tags?: string[]
          title?: string
          updated_at?: string
          updated_by?: string | null
          views_count?: number
        }
        Relationships: []
      }
      knowledge_books: {
        Row: {
          chunks_count: number
          created_at: string
          error_message: string | null
          file_name: string
          file_path: string | null
          id: string
          pages_count: number
          status: string
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          chunks_count?: number
          created_at?: string
          error_message?: string | null
          file_name: string
          file_path?: string | null
          id?: string
          pages_count?: number
          status?: string
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          chunks_count?: number
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_path?: string | null
          id?: string
          pages_count?: number
          status?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          book_id: string | null
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: number
          page_number: number
          source: string
        }
        Insert: {
          book_id?: string | null
          chunk_index?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: number
          page_number?: number
          source: string
        }
        Update: {
          book_id?: string | null
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: number
          page_number?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "knowledge_books"
            referencedColumns: ["id"]
          },
        ]
      }
      link_profile: {
        Row: {
          acceptor_url: string
          anchor: string
          cost: number
          created_at: string
          donor_url: string
          id: string
          last_checked_at: string | null
          last_error: string | null
          last_status_code: number | null
          placed_at: string | null
          project_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          acceptor_url: string
          anchor?: string
          cost?: number
          created_at?: string
          donor_url: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_status_code?: number | null
          placed_at?: string | null
          project_id: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          acceptor_url?: string
          anchor?: string
          cost?: number
          created_at?: string
          donor_url?: string
          id?: string
          last_checked_at?: string | null
          last_error?: string | null
          last_status_code?: number | null
          placed_at?: string | null
          project_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_profile_project_id_fkey"
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
          kind: string
          project_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          error_id?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          project_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          error_id?: string | null
          id?: string
          is_read?: boolean
          kind?: string
          project_id?: string | null
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
      onboarding_checklist_items: {
        Row: {
          assignee_id: string | null
          assignee_role: string
          checked: boolean
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          due_date: string | null
          due_day: number
          id: string
          onboarding_id: string
          section: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_role: string
          checked?: boolean
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          due_date?: string | null
          due_day?: number
          id?: string
          onboarding_id: string
          section: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          assignee_role?: string
          checked?: boolean
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          due_date?: string | null
          due_day?: number
          id?: string
          onboarding_id?: string
          section?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_checklist_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_checklist_items_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_projects: {
        Row: {
          completed_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_preferred: string | null
          contact_telegram: string | null
          contract_budget: number
          created_at: string
          first_payment_date: string | null
          id: string
          owner_id: string
          payment_recurrence: string
          progress: number
          project_id: string
          start_date: string
          status: string
          tariff_code: string
          tariff_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_preferred?: string | null
          contact_telegram?: string | null
          contract_budget?: number
          created_at?: string
          first_payment_date?: string | null
          id?: string
          owner_id: string
          payment_recurrence?: string
          progress?: number
          project_id: string
          start_date?: string
          status?: string
          tariff_code: string
          tariff_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_preferred?: string | null
          contact_telegram?: string | null
          contract_budget?: number
          created_at?: string
          first_payment_date?: string | null
          id?: string
          owner_id?: string
          payment_recurrence?: string
          progress?: number
          project_id?: string
          start_date?: string
          status?: string
          tariff_code?: string
          tariff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_projects_tariff_id_fkey"
            columns: ["tariff_id"]
            isOneToOne: false
            referencedRelation: "tariffs"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_task_articles: {
        Row: {
          article_id: string
          created_at: string
          task_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          task_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_task_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_task_articles_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "onboarding_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_task_templates: {
        Row: {
          assignee_role: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          month: number
          sort_order: number
          title: string
          updated_at: string
          week: number
        }
        Insert: {
          assignee_role: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          month: number
          sort_order?: number
          title: string
          updated_at?: string
          week: number
        }
        Update: {
          assignee_role?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          month?: number
          sort_order?: number
          title?: string
          updated_at?: string
          week?: number
        }
        Relationships: []
      }
      onboarding_tasks: {
        Row: {
          assignee_id: string | null
          assignee_role: string
          checked: boolean
          comment: string | null
          completed_at: string | null
          completed_by: string | null
          completed_by_name: string | null
          created_at: string
          due_date: string | null
          id: string
          onboarding_id: string
          period: number
          project_id: string
          sort_order: number
          status: string
          template_id: string | null
          title: string
          updated_at: string
          week: number
        }
        Insert: {
          assignee_id?: string | null
          assignee_role?: string
          checked?: boolean
          comment?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          onboarding_id: string
          period: number
          project_id: string
          sort_order?: number
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          week: number
        }
        Update: {
          assignee_id?: string | null
          assignee_role?: string
          checked?: boolean
          comment?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completed_by_name?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          onboarding_id?: string
          period?: number
          project_id?: string
          sort_order?: number
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "onboarding_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_template_articles: {
        Row: {
          article_id: string
          created_at: string
          template_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          template_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_template_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_template_articles_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      period_tasks: {
        Row: {
          assignee_id: string | null
          category: string
          completed: boolean
          completed_at: string | null
          created_at: string
          deadline: string | null
          id: string
          instruction_article_id: string | null
          period_id: string
          required: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          instruction_article_id?: string | null
          period_id: string
          required?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          instruction_article_id?: string | null
          period_id?: string
          required?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_tasks_instruction_article_id_fkey"
            columns: ["instruction_article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_tasks_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "project_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_name: string | null
          all_projects_access: boolean
          avatar_url: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          email: string
          finance_access: boolean
          first_name: string | null
          full_name: string | null
          id: string
          knowledge_edit_access: boolean
          last_name: string | null
          onboarding_access: boolean
          phone: string | null
          position: string | null
          preferred_language: string
          status: string
          telegram: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_name?: string | null
          all_projects_access?: boolean
          avatar_url?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          email: string
          finance_access?: boolean
          first_name?: string | null
          full_name?: string | null
          id?: string
          knowledge_edit_access?: boolean
          last_name?: string | null
          onboarding_access?: boolean
          phone?: string | null
          position?: string | null
          preferred_language?: string
          status?: string
          telegram?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_name?: string | null
          all_projects_access?: boolean
          avatar_url?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          email?: string
          finance_access?: boolean
          first_name?: string | null
          full_name?: string | null
          id?: string
          knowledge_edit_access?: boolean
          last_name?: string | null
          onboarding_access?: boolean
          phone?: string | null
          position?: string | null
          preferred_language?: string
          status?: string
          telegram?: string | null
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
      project_members: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          notifications_enabled: boolean
          project_id: string
          role: string
          team_member_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          notifications_enabled?: boolean
          project_id: string
          role?: string
          team_member_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          notifications_enabled?: boolean
          project_id?: string
          role?: string
          team_member_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      project_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
          user_name?: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "project_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_message_reads: {
        Row: {
          last_read_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_message_reads_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_url: string | null
          body: string
          created_at: string
          id: string
          is_system: boolean
          mentions: string[]
          project_id: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          is_system?: boolean
          mentions?: string[]
          project_id: string
          user_id?: string | null
          user_name?: string
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          is_system?: boolean
          mentions?: string[]
          project_id?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_periods: {
        Row: {
          created_at: string
          id: string
          month: number
          owner_id: string
          project_id: string
          status: string
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          owner_id: string
          project_id: string
          status?: string
          title?: string
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          owner_id?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_periods_project_id_fkey"
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
          gsc_site_url: string | null
          hourly_rate: number
          id: string
          logo_url: string | null
          metrika_counter_id: string | null
          monthly_budget: number
          name: string
          owner_id: string
          planned_hours: number
          privacy: string | null
          report_day: number
          report_period: string
          seo_specialist: string | null
          seo_specialist_id: string | null
          share_link_expires_at: string | null
          share_token: string | null
          start_date: string | null
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
          gsc_site_url?: string | null
          hourly_rate?: number
          id?: string
          logo_url?: string | null
          metrika_counter_id?: string | null
          monthly_budget?: number
          name: string
          owner_id: string
          planned_hours?: number
          privacy?: string | null
          report_day?: number
          report_period?: string
          seo_specialist?: string | null
          seo_specialist_id?: string | null
          share_link_expires_at?: string | null
          share_token?: string | null
          start_date?: string | null
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
          gsc_site_url?: string | null
          hourly_rate?: number
          id?: string
          logo_url?: string | null
          metrika_counter_id?: string | null
          monthly_budget?: number
          name?: string
          owner_id?: string
          planned_hours?: number
          privacy?: string | null
          report_day?: number
          report_period?: string
          seo_specialist?: string | null
          seo_specialist_id?: string | null
          share_link_expires_at?: string | null
          share_token?: string | null
          start_date?: string | null
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
          assignee_id: string | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          is_done: boolean
          plan_minutes: number | null
          sort_order: number
          task_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          is_done?: boolean
          plan_minutes?: number | null
          sort_order?: number
          task_id: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          is_done?: boolean
          plan_minutes?: number | null
          sort_order?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "crm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tariffs: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_custom: boolean
          name: string
          price_max: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          name: string
          price_max?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          name?: string
          price_max?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
      task_time_entries: {
        Row: {
          comment: string | null
          created_at: string
          duration_minutes: number
          ended_at: string | null
          entry_date: string
          id: string
          project_id: string | null
          started_at: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          entry_date?: string
          id?: string
          project_id?: string | null
          started_at?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          entry_date?: string
          id?: string
          project_id?: string | null
          started_at?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_time_entries_task_id_fkey"
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
      user_time_logs: {
        Row: {
          active_seconds: number
          id: string
          log_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_seconds?: number
          id?: string
          log_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_seconds?: number
          id?: string
          log_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          created_at: string
          created_by: string | null
          done_items: Json
          id: string
          manager_comment: string
          metrics: Json
          planned_items: Json
          project_id: string
          sent_at: string | null
          share_token: string
          status: string
          updated_at: string
          week_end: string
          week_number: number
          week_start: string
          week_year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          done_items?: Json
          id?: string
          manager_comment?: string
          metrics?: Json
          planned_items?: Json
          project_id: string
          sent_at?: string | null
          share_token?: string
          status?: string
          updated_at?: string
          week_end: string
          week_number: number
          week_start: string
          week_year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          done_items?: Json
          id?: string
          manager_comment?: string
          metrics?: Json
          planned_items?: Json
          project_id?: string
          sent_at?: string | null
          share_token?: string
          status?: string
          updated_at?: string
          week_end?: string
          week_number?: number
          week_start?: string
          week_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      can_view_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      claim_next_crawl_job: {
        Args: never
        Returns: {
          id: string
          project_id: string
          url: string
        }[]
      }
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
          gsc_site_url: string | null
          hourly_rate: number
          id: string
          logo_url: string | null
          metrika_counter_id: string | null
          monthly_budget: number
          name: string
          owner_id: string
          planned_hours: number
          privacy: string | null
          report_day: number
          report_period: string
          seo_specialist: string | null
          seo_specialist_id: string | null
          share_link_expires_at: string | null
          share_token: string | null
          start_date: string | null
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
      get_weekly_report_by_token: {
        Args: { p_token: string }
        Returns: {
          done_items: Json
          id: string
          manager_comment: string
          metrics: Json
          planned_items: Json
          project_id: string
          project_name: string
          sent_at: string
          status: string
          week_end: string
          week_number: number
          week_start: string
          week_year: number
        }[]
      }
      has_all_projects_access: { Args: { _user_id: string }; Returns: boolean }
      has_finance_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_article_views: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      increment_time: { Args: { p_seconds: number }; Returns: undefined }
      is_active_user: { Args: { _user_id: string }; Returns: boolean }
      is_admin_or_director: { Args: { _user_id: string }; Returns: boolean }
      is_project_participant: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      match_chunks: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: number
          page_number: number
          similarity: number
          source: string
        }[]
      }
      notify_overdue_tasks: { Args: never; Returns: undefined }
      recalc_onboarding_progress: {
        Args: { p_onboarding_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "viewer" | "manager" | "director" | "seo" | "junior"
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
      app_role: ["admin", "viewer", "manager", "director", "seo", "junior"],
    },
  },
} as const
