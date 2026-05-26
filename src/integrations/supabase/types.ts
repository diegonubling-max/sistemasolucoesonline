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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alunos: {
        Row: {
          ativo: boolean
          cpf: string
          created_at: string
          ctr: number
          data_nascimento: string
          email: string | null
          foto_perfil: string | null
          id: string
          menor_de_idade: boolean
          nome: string
          observacao: string | null
          origem: Database["public"]["Enums"]["origem_aluno"]
          origem_detalhe: string | null
          responsavel_cpf: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          sexo: Database["public"]["Enums"]["sexo_aluno"]
          telefone: string
          tema: string | null
          vendedora: string | null
        }
        Insert: {
          ativo?: boolean
          cpf: string
          created_at?: string
          ctr?: number
          data_nascimento: string
          email?: string | null
          foto_perfil?: string | null
          id?: string
          menor_de_idade?: boolean
          nome: string
          observacao?: string | null
          origem: Database["public"]["Enums"]["origem_aluno"]
          origem_detalhe?: string | null
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          sexo: Database["public"]["Enums"]["sexo_aluno"]
          telefone: string
          tema?: string | null
          vendedora?: string | null
        }
        Update: {
          ativo?: boolean
          cpf?: string
          created_at?: string
          ctr?: number
          data_nascimento?: string
          email?: string | null
          foto_perfil?: string | null
          id?: string
          menor_de_idade?: boolean
          nome?: string
          observacao?: string | null
          origem?: Database["public"]["Enums"]["origem_aluno"]
          origem_detalhe?: string | null
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          sexo?: Database["public"]["Enums"]["sexo_aluno"]
          telefone?: string
          tema?: string | null
          vendedora?: string | null
        }
        Relationships: []
      }
      aulas: {
        Row: {
          ativo: boolean
          created_at: string
          curso_id: string
          descricao: string | null
          id: string
          ordem: number
          thumbnail_url: string | null
          titulo: string
          url_video: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          curso_id: string
          descricao?: string | null
          id?: string
          ordem?: number
          thumbnail_url?: string | null
          titulo: string
          url_video?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          curso_id?: string
          descricao?: string | null
          id?: string
          ordem?: number
          thumbnail_url?: string | null
          titulo?: string
          url_video?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aulas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      cursos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          thumbnail_url: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          thumbnail_url?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      cursos_vitrine: {
        Row: {
          aluno_id: string
          ativo: boolean | null
          created_at: string
          curso_id: string
          id: string
          max_parcelas: number | null
          preco_cartao: number | null
          preco_pix: number | null
          updated_at: string
        }
        Insert: {
          aluno_id: string
          ativo?: boolean | null
          created_at?: string
          curso_id: string
          id?: string
          max_parcelas?: number | null
          preco_cartao?: number | null
          preco_pix?: number | null
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          ativo?: boolean | null
          created_at?: string
          curso_id?: string
          id?: string
          max_parcelas?: number | null
          preco_cartao?: number | null
          preco_pix?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cursos_vitrine_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_vitrine_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      matricula_cursos: {
        Row: {
          curso_id: string
          data_liberacao: string
          id: string
          matricula_id: string
        }
        Insert: {
          curso_id: string
          data_liberacao?: string
          id?: string
          matricula_id: string
        }
        Update: {
          curso_id?: string
          data_liberacao?: string
          id?: string
          matricula_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matricula_cursos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matricula_cursos_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      matricula_pacotes: {
        Row: {
          created_at: string
          id: string
          matricula_id: string
          pacote_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          matricula_id: string
          pacote_id: string
        }
        Update: {
          created_at?: string
          id?: string
          matricula_id?: string
          pacote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matricula_pacotes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matricula_pacotes_pacote_id_fkey"
            columns: ["pacote_id"]
            isOneToOne: false
            referencedRelation: "pacotes"
            referencedColumns: ["id"]
          },
        ]
      }
      matriculas: {
        Row: {
          aluno_id: string
          created_at: string
          id: string
          observacao: string | null
        }
        Insert: {
          aluno_id: string
          created_at?: string
          id?: string
          observacao?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string
          id?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      pacotes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          numero_parcelas: number
          tipo: Database["public"]["Enums"]["tipo_pacote"]
          valor_matricula: number
          valor_parcela: number
          valor_total: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          numero_parcelas?: number
          tipo: Database["public"]["Enums"]["tipo_pacote"]
          valor_matricula?: number
          valor_parcela?: number
          valor_total?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          numero_parcelas?: number
          tipo?: Database["public"]["Enums"]["tipo_pacote"]
          valor_matricula?: number
          valor_parcela?: number
          valor_total?: number
        }
        Relationships: []
      }
      parcelas: {
        Row: {
          cartao_parcelas: number | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string | null
          forma_pagamento: string | null
          id: string
          matricula_id: string
          numero: number
          observacao: string | null
          parcelas_cartao: number | null
          status: Database["public"]["Enums"]["payment_status"]
          taxa_cartao: number | null
          tipo: Database["public"]["Enums"]["payment_type"]
          valor: number
          valor_bruto: number | null
          valor_liquido: number | null
          valor_taxa: number | null
        }
        Insert: {
          cartao_parcelas?: number | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          matricula_id: string
          numero: number
          observacao?: string | null
          parcelas_cartao?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          taxa_cartao?: number | null
          tipo: Database["public"]["Enums"]["payment_type"]
          valor: number
          valor_bruto?: number | null
          valor_liquido?: number | null
          valor_taxa?: number | null
        }
        Update: {
          cartao_parcelas?: number | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          matricula_id?: string
          numero?: number
          observacao?: string | null
          parcelas_cartao?: number | null
          status?: Database["public"]["Enums"]["payment_status"]
          taxa_cartao?: number | null
          tipo?: Database["public"]["Enums"]["payment_type"]
          valor?: number
          valor_bruto?: number | null
          valor_liquido?: number | null
          valor_taxa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_alunos: {
        Row: {
          aluno_id: string
          created_at: string | null
          id: string
          senha: string
          ultimo_acesso: string | null
          updated_at: string | null
        }
        Insert: {
          aluno_id: string
          created_at?: string | null
          id?: string
          senha: string
          ultimo_acesso?: string | null
          updated_at?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string | null
          id?: string
          senha?: string
          ultimo_acesso?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_alunos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: true
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      criar_acesso_aluno: {
        Args: { p_ctr: number; p_email: string; p_senha: string }
        Returns: undefined
      }
      delete_aluno_completo: {
        Args: { p_aluno_id: string }
        Returns: undefined
      }
      delete_pacote: { Args: { p_pacote_id: string }; Returns: undefined }
      delete_user_auth: { Args: { user_email: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      redefinir_senha_aluno: {
        Args: { p_email: string; p_nova_senha: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "aluno"
      origem_aluno: "Google" | "Meta" | "Indicação" | "Outros"
      payment_status: "aberto" | "pago" | "isento"
      payment_type: "taxa_matricula" | "parcela"
      sexo_aluno: "Masculino" | "Feminino"
      tipo_pacote: "boleto" | "cartao" | "pix"
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
      app_role: ["admin", "aluno"],
      origem_aluno: ["Google", "Meta", "Indicação", "Outros"],
      payment_status: ["aberto", "pago", "isento"],
      payment_type: ["taxa_matricula", "parcela"],
      sexo_aluno: ["Masculino", "Feminino"],
      tipo_pacote: ["boleto", "cartao", "pix"],
    },
  },
} as const
