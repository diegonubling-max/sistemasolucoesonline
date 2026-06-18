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
      aluno_aulas_assistidas: {
        Row: {
          aluno_id: string
          assistida_em: string
          aula_id: string
          created_at: string
          curso_id: string
          id: string
        }
        Insert: {
          aluno_id: string
          assistida_em?: string
          aula_id: string
          created_at?: string
          curso_id: string
          id?: string
        }
        Update: {
          aluno_id?: string
          assistida_em?: string
          aula_id?: string
          created_at?: string
          curso_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aluno_aulas_assistidas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_aulas_assistidas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aluno_aulas_assistidas_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_documentos: {
        Row: {
          aluno_id: string
          comprovante_residencia: boolean | null
          created_at: string | null
          d_oficial: boolean | null
          historico_fund_medio: boolean | null
          historico_fundamental: boolean | null
          id: string
          outros: boolean | null
          outros_descricao: string | null
          rec_firma: boolean | null
          rg_cpf: boolean | null
          updated_at: string | null
          visto_confere: boolean | null
        }
        Insert: {
          aluno_id: string
          comprovante_residencia?: boolean | null
          created_at?: string | null
          d_oficial?: boolean | null
          historico_fund_medio?: boolean | null
          historico_fundamental?: boolean | null
          id?: string
          outros?: boolean | null
          outros_descricao?: string | null
          rec_firma?: boolean | null
          rg_cpf?: boolean | null
          updated_at?: string | null
          visto_confere?: boolean | null
        }
        Update: {
          aluno_id?: string
          comprovante_residencia?: boolean | null
          created_at?: string | null
          d_oficial?: boolean | null
          historico_fund_medio?: boolean | null
          historico_fundamental?: boolean | null
          id?: string
          outros?: boolean | null
          outros_descricao?: string | null
          rec_firma?: boolean | null
          rg_cpf?: boolean | null
          updated_at?: string | null
          visto_confere?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "aluno_documentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_documentos_arquivos: {
        Row: {
          aluno_id: string
          created_at: string | null
          id: string
          nome_arquivo: string
          tipo: string | null
          url: string
        }
        Insert: {
          aluno_id: string
          created_at?: string | null
          id?: string
          nome_arquivo: string
          tipo?: string | null
          url: string
        }
        Update: {
          aluno_id?: string
          created_at?: string | null
          id?: string
          nome_arquivo?: string
          tipo?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "aluno_documentos_arquivos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      aluno_sessoes: {
        Row: {
          aluno_id: string
          created_at: string
          duracao_minutos: number | null
          id: string
          login_em: string
          logout_em: string | null
        }
        Insert: {
          aluno_id: string
          created_at?: string
          duracao_minutos?: number | null
          id?: string
          login_em?: string
          logout_em?: string | null
        }
        Update: {
          aluno_id?: string
          created_at?: string
          duracao_minutos?: number | null
          id?: string
          login_em?: string
          logout_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aluno_sessoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos: {
        Row: {
          asaas_customer_id: string | null
          ativo: boolean
          cadastrado_por: string | null
          cadastrado_por_id: string | null
          cadastro_completo: boolean
          colaborador_id: string | null
          cpf: string
          created_at: string
          ctr: number
          data_liberacao_prova: string | null
          data_nascimento: string | null
          dias_prova_final: number | null
          email: string | null
          formado_em: string | null
          foto_perfil: string | null
          id: string
          materias_prova: string[] | null
          menor_de_idade: boolean | null
          nome: string
          observacao: string | null
          origem: Database["public"]["Enums"]["origem_aluno"]
          origem_detalhe: string | null
          polo_id: string | null
          primeiro_acesso: boolean
          responsavel_cpf: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          sexo: Database["public"]["Enums"]["sexo_aluno"]
          status: string | null
          telefone: string
          tema: string | null
          trancado_em: string | null
          vendedora: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          ativo?: boolean
          cadastrado_por?: string | null
          cadastrado_por_id?: string | null
          cadastro_completo?: boolean
          colaborador_id?: string | null
          cpf: string
          created_at?: string
          ctr?: number
          data_liberacao_prova?: string | null
          data_nascimento?: string | null
          dias_prova_final?: number | null
          email?: string | null
          formado_em?: string | null
          foto_perfil?: string | null
          id?: string
          materias_prova?: string[] | null
          menor_de_idade?: boolean | null
          nome: string
          observacao?: string | null
          origem: Database["public"]["Enums"]["origem_aluno"]
          origem_detalhe?: string | null
          polo_id?: string | null
          primeiro_acesso?: boolean
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          sexo: Database["public"]["Enums"]["sexo_aluno"]
          status?: string | null
          telefone: string
          tema?: string | null
          trancado_em?: string | null
          vendedora?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          ativo?: boolean
          cadastrado_por?: string | null
          cadastrado_por_id?: string | null
          cadastro_completo?: boolean
          colaborador_id?: string | null
          cpf?: string
          created_at?: string
          ctr?: number
          data_liberacao_prova?: string | null
          data_nascimento?: string | null
          dias_prova_final?: number | null
          email?: string | null
          formado_em?: string | null
          foto_perfil?: string | null
          id?: string
          materias_prova?: string[] | null
          menor_de_idade?: boolean | null
          nome?: string
          observacao?: string | null
          origem?: Database["public"]["Enums"]["origem_aluno"]
          origem_detalhe?: string | null
          polo_id?: string | null
          primeiro_acesso?: boolean
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          sexo?: Database["public"]["Enums"]["sexo_aluno"]
          status?: string | null
          telefone?: string
          tema?: string | null
          trancado_em?: string | null
          vendedora?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alunos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_polo_id_fkey"
            columns: ["polo_id"]
            isOneToOne: false
            referencedRelation: "polos"
            referencedColumns: ["id"]
          },
        ]
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
      banners_polo: {
        Row: {
          ativo: boolean
          created_at: string | null
          id: string
          imagem_url: string
          ordem: number
          polo_id: string
          titulo: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          id?: string
          imagem_url: string
          ordem?: number
          polo_id: string
          titulo?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          id?: string
          imagem_url?: string
          ordem?: number
          polo_id?: string
          titulo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banners_polo_polo_id_fkey"
            columns: ["polo_id"]
            isOneToOne: false
            referencedRelation: "polos"
            referencedColumns: ["id"]
          },
        ]
      }
      certificadoras: {
        Row: {
          ativo: boolean | null
          cidade: string | null
          codigo_inep: string | null
          created_at: string | null
          d_oficial: boolean | null
          estado: string | null
          id: string
          nome: string
          rec_firma: boolean | null
          responsavel: string | null
          telefone: string | null
          visto_confere: boolean | null
        }
        Insert: {
          ativo?: boolean | null
          cidade?: string | null
          codigo_inep?: string | null
          created_at?: string | null
          d_oficial?: boolean | null
          estado?: string | null
          id?: string
          nome: string
          rec_firma?: boolean | null
          responsavel?: string | null
          telefone?: string | null
          visto_confere?: boolean | null
        }
        Update: {
          ativo?: boolean | null
          cidade?: string | null
          codigo_inep?: string | null
          created_at?: string | null
          d_oficial?: boolean | null
          estado?: string | null
          id?: string
          nome?: string
          rec_firma?: boolean | null
          responsavel?: string | null
          telefone?: string | null
          visto_confere?: boolean | null
        }
        Relationships: []
      }
      colaborador_permissoes: {
        Row: {
          agendar_provas: boolean | null
          cadastrar_alunos: boolean | null
          colaborador_id: string
          created_at: string
          dar_baixa_pagamentos: boolean | null
          fazer_matriculas: boolean | null
          gerenciar_prova_final: boolean | null
          id: string
          updated_at: string
          ver_alunos: boolean | null
          ver_configuracoes: boolean | null
          ver_financeiro: boolean | null
          ver_relatorios: boolean | null
          ver_setor_provas: boolean | null
        }
        Insert: {
          agendar_provas?: boolean | null
          cadastrar_alunos?: boolean | null
          colaborador_id: string
          created_at?: string
          dar_baixa_pagamentos?: boolean | null
          fazer_matriculas?: boolean | null
          gerenciar_prova_final?: boolean | null
          id?: string
          updated_at?: string
          ver_alunos?: boolean | null
          ver_configuracoes?: boolean | null
          ver_financeiro?: boolean | null
          ver_relatorios?: boolean | null
          ver_setor_provas?: boolean | null
        }
        Update: {
          agendar_provas?: boolean | null
          cadastrar_alunos?: boolean | null
          colaborador_id?: string
          created_at?: string
          dar_baixa_pagamentos?: boolean | null
          fazer_matriculas?: boolean | null
          gerenciar_prova_final?: boolean | null
          id?: string
          updated_at?: string
          ver_alunos?: boolean | null
          ver_configuracoes?: boolean | null
          ver_financeiro?: boolean | null
          ver_relatorios?: boolean | null
          ver_setor_provas?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_permissoes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          email: string
          id: string
          nome: string
          polo_id: string | null
          primeiro_acesso: boolean
          responsavel_polo: boolean
          setor: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          nome: string
          polo_id?: string | null
          primeiro_acesso?: boolean
          responsavel_polo?: boolean
          setor: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          nome?: string
          polo_id?: string | null
          primeiro_acesso?: boolean
          responsavel_polo?: boolean
          setor?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_polo_id_fkey"
            columns: ["polo_id"]
            isOneToOne: false
            referencedRelation: "polos"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          aluno_id: string | null
          competencia: string
          created_at: string | null
          data_pagamento: string | null
          estornado: boolean | null
          estornado_em: string | null
          estorno_competencia: string | null
          id: string
          matricula_id: string | null
          status: string | null
          tipo_pagamento: string
          valor: number
          vendedora: string
        }
        Insert: {
          aluno_id?: string | null
          competencia: string
          created_at?: string | null
          data_pagamento?: string | null
          estornado?: boolean | null
          estornado_em?: string | null
          estorno_competencia?: string | null
          id?: string
          matricula_id?: string | null
          status?: string | null
          tipo_pagamento: string
          valor: number
          vendedora: string
        }
        Update: {
          aluno_id?: string | null
          competencia?: string
          created_at?: string | null
          data_pagamento?: string | null
          estornado?: boolean | null
          estornado_em?: string | null
          estorno_competencia?: string | null
          id?: string
          matricula_id?: string | null
          status?: string | null
          tipo_pagamento?: string
          valor?: number
          vendedora?: string
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_matricula_id_fkey"
            columns: ["matricula_id"]
            isOneToOne: false
            referencedRelation: "matriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          id: string
          updated_at: string
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          id?: string
          updated_at?: string
          valor?: string | null
        }
        Relationships: []
      }
      contratos: {
        Row: {
          aluno_id: string
          conteudo_html: string
          created_at: string
          data_assinatura: string | null
          id: string
          ip_assinatura: string | null
          matricula_id: string | null
          nome_confirmacao: string | null
          status: string
          token_unico: string
          updated_at: string
        }
        Insert: {
          aluno_id: string
          conteudo_html: string
          created_at?: string
          data_assinatura?: string | null
          id?: string
          ip_assinatura?: string | null
          matricula_id?: string | null
          nome_confirmacao?: string | null
          status?: string
          token_unico?: string
          updated_at?: string
        }
        Update: {
          aluno_id?: string
          conteudo_html?: string
          created_at?: string
          data_assinatura?: string | null
          id?: string
          ip_assinatura?: string | null
          matricula_id?: string | null
          nome_confirmacao?: string | null
          status?: string
          token_unico?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
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
          is_prova_final: boolean | null
          material_pdf_url: string | null
          nome: string
          segmento_id: string | null
          thumbnail_url: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          is_prova_final?: boolean | null
          material_pdf_url?: string | null
          nome: string
          segmento_id?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          is_prova_final?: boolean | null
          material_pdf_url?: string | null
          nome?: string
          segmento_id?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cursos_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
        ]
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
      declaracoes_matricula: {
        Row: {
          aluno_id: string
          created_at: string
          gerado_em: string
          gerado_por: string | null
          id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
        }
        Update: {
          aluno_id?: string
          created_at?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "declaracoes_matricula_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declaracoes_matricula_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_diarios: {
        Row: {
          created_at: string | null
          data: string
          id: string
          origem: string
          quantidade: number
          vendedora: string
        }
        Insert: {
          created_at?: string | null
          data?: string
          id?: string
          origem: string
          quantidade?: number
          vendedora: string
        }
        Update: {
          created_at?: string | null
          data?: string
          id?: string
          origem?: string
          quantidade?: number
          vendedora?: string
        }
        Relationships: []
      }
      lote_alunos: {
        Row: {
          aluno_id: string
          created_at: string | null
          id: string
          lote_id: string
        }
        Insert: {
          aluno_id: string
          created_at?: string | null
          id?: string
          lote_id: string
        }
        Update: {
          aluno_id?: string
          created_at?: string | null
          id?: string
          lote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lote_alunos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_alunos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes: {
        Row: {
          certificadora_id: string | null
          created_at: string | null
          data_envio: string | null
          enviado: boolean | null
          id: string
          mes_ano: string
        }
        Insert: {
          certificadora_id?: string | null
          created_at?: string | null
          data_envio?: string | null
          enviado?: boolean | null
          id?: string
          mes_ano: string
        }
        Update: {
          certificadora_id?: string | null
          created_at?: string | null
          data_envio?: string | null
          enviado?: boolean | null
          id?: string
          mes_ano?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_certificadora_id_fkey"
            columns: ["certificadora_id"]
            isOneToOne: false
            referencedRelation: "certificadoras"
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
          pacote_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          matricula_id: string
          pacote_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          matricula_id?: string
          pacote_id?: string | null
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
          colaborador_id: string | null
          created_at: string
          id: string
          observacao: string | null
          polo_id: string | null
        }
        Insert: {
          aluno_id: string
          colaborador_id?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          polo_id?: string | null
        }
        Update: {
          aluno_id?: string
          colaborador_id?: string | null
          created_at?: string
          id?: string
          observacao?: string | null
          polo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matriculas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matriculas_polo_id_fkey"
            columns: ["polo_id"]
            isOneToOne: false
            referencedRelation: "polos"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_contrato: {
        Row: {
          ativo: boolean | null
          conteudo_html: string | null
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          conteudo_html?: string | null
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          conteudo_html?: string | null
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
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
          asaas_barcode: string | null
          asaas_id: string | null
          asaas_pix_chave: string | null
          asaas_pix_qrcode: string | null
          asaas_url: string | null
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
          polo_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          taxa_cartao: number | null
          tipo: Database["public"]["Enums"]["payment_type"]
          tipo_pacote: string | null
          valor: number
          valor_bruto: number | null
          valor_liquido: number | null
          valor_taxa: number | null
        }
        Insert: {
          asaas_barcode?: string | null
          asaas_id?: string | null
          asaas_pix_chave?: string | null
          asaas_pix_qrcode?: string | null
          asaas_url?: string | null
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
          polo_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          taxa_cartao?: number | null
          tipo: Database["public"]["Enums"]["payment_type"]
          tipo_pacote?: string | null
          valor: number
          valor_bruto?: number | null
          valor_liquido?: number | null
          valor_taxa?: number | null
        }
        Update: {
          asaas_barcode?: string | null
          asaas_id?: string | null
          asaas_pix_chave?: string | null
          asaas_pix_qrcode?: string | null
          asaas_url?: string | null
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
          polo_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          taxa_cartao?: number | null
          tipo?: Database["public"]["Enums"]["payment_type"]
          tipo_pacote?: string | null
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
          {
            foreignKeyName: "parcelas_polo_id_fkey"
            columns: ["polo_id"]
            isOneToOne: false
            referencedRelation: "polos"
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
      polos: {
        Row: {
          asaas_ambiente: string | null
          asaas_api_key: string | null
          asaas_webhook_token: string | null
          ativo: boolean | null
          cidade: string | null
          cnpj: string | null
          created_at: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          nome_escola: string | null
          whatsapp: string | null
          zapi_client_token: string | null
          zapi_instance_id: string | null
          zapi_token: string | null
        }
        Insert: {
          asaas_ambiente?: string | null
          asaas_api_key?: string | null
          asaas_webhook_token?: string | null
          ativo?: boolean | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          nome_escola?: string | null
          whatsapp?: string | null
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Update: {
          asaas_ambiente?: string | null
          asaas_api_key?: string | null
          asaas_webhook_token?: string | null
          ativo?: boolean | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          nome_escola?: string | null
          whatsapp?: string | null
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Relationships: []
      }
      prova_agendamentos: {
        Row: {
          aluno_id: string | null
          created_at: string | null
          data_prova: string
          hora_prova: string
          id: string
          status: string | null
        }
        Insert: {
          aluno_id?: string | null
          created_at?: string | null
          data_prova: string
          hora_prova: string
          id?: string
          status?: string | null
        }
        Update: {
          aluno_id?: string | null
          created_at?: string | null
          data_prova?: string
          hora_prova?: string
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prova_agendamentos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      prova_questoes: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          enunciado: string
          id: string
          materia: string
          numero: number
          opcao_a: string
          opcao_b: string
          opcao_c: string
          opcao_d: string
          resposta_correta: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          enunciado: string
          id?: string
          materia: string
          numero: number
          opcao_a: string
          opcao_b: string
          opcao_c: string
          opcao_d: string
          resposta_correta: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          enunciado?: string
          id?: string
          materia?: string
          numero?: number
          opcao_a?: string
          opcao_b?: string
          opcao_c?: string
          opcao_d?: string
          resposta_correta?: string
        }
        Relationships: []
      }
      prova_resultados: {
        Row: {
          agendamento_id: string | null
          aluno_id: string | null
          aprovado: boolean | null
          created_at: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string | null
          materia: string
          percentual: number | null
          respostas: Json | null
          total_acertos: number | null
          total_questoes: number | null
        }
        Insert: {
          agendamento_id?: string | null
          aluno_id?: string | null
          aprovado?: boolean | null
          created_at?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          materia: string
          percentual?: number | null
          respostas?: Json | null
          total_acertos?: number | null
          total_questoes?: number | null
        }
        Update: {
          agendamento_id?: string | null
          aluno_id?: string | null
          aprovado?: boolean | null
          created_at?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          materia?: string
          percentual?: number | null
          respostas?: Json | null
          total_acertos?: number | null
          total_questoes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prova_resultados_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "prova_agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prova_resultados_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      segmentos: {
        Row: {
          ativo: boolean | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
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
      vitrine_cliques: {
        Row: {
          aluno_id: string
          clicado_dia: string | null
          clicado_em: string
          created_at: string
          curso_id: string
          id: string
          polo_id: string | null
        }
        Insert: {
          aluno_id: string
          clicado_dia?: string | null
          clicado_em?: string
          created_at?: string
          curso_id: string
          id?: string
          polo_id?: string | null
        }
        Update: {
          aluno_id?: string
          clicado_dia?: string | null
          clicado_em?: string
          created_at?: string
          curso_id?: string
          id?: string
          polo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vitrine_cliques_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrine_cliques_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitrine_cliques_polo_id_fkey"
            columns: ["polo_id"]
            isOneToOne: false
            referencedRelation: "polos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assinar_contrato_publico: {
        Args: { p_ip: string; p_nome: string; p_token: string }
        Returns: undefined
      }
      buscar_email_por_ctr: { Args: { p_ctr: number }; Returns: string }
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
      get_contrato_publico: { Args: { p_token: string }; Returns: Json }
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
      registrar_aula_assistida: {
        Args: { p_aluno_id: string; p_aula_id: string; p_curso_id: string }
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
