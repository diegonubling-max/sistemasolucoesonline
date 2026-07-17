# 13 — PADRÃO DE DESENVOLVIMENTO

## Padrões de Código

### Frontend
- React + TypeScript + TailwindCSS
- Componentes funcionais com hooks
- shadcn/ui para componentes de UI
- Mobile-first para área do aluno
- Rotas file-based (TanStack Start) em `src/routes/`

### Nomenclatura
- Componentes: PascalCase (`ProvasAgendadas.tsx`)
- Funções: camelCase (`handleSubmit`)
- Variáveis: camelCase (`alunoId`)
- Tabelas banco: snake_case (`prova_agendamentos`)
- Colunas banco: snake_case (`data_prova`)
- RPCs: snake_case (`criar_aluno_externo_com_prova`)
- Enums: PascalCase ou lowercase dependendo do uso
- CSS classes: TailwindCSS utilities

## Padrões de Banco

### Tabelas
- Sempre incluir `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- Sempre incluir `created_at timestamptz DEFAULT now()`
- Nomes em português snake_case (`prova_agendamentos`, não `exam_schedules`)
- Foreign keys explícitas com `REFERENCES`
- Usar enums para campos com valores fixos

### Sequences
- Nomear como: `[tabela]_[campo]_seq` (ex: `alunos_ctr_seq`)
- Usar `IF NOT EXISTS` ao criar

### Triggers
- Nomear como: `trg_[ação]` (ex: `trg_ajustar_ctr`)
- Functions como: `[ação]()` (ex: `ajustar_ctr_pular_13()`)
- Sempre `DROP TRIGGER IF EXISTS` antes de `CREATE TRIGGER`

### RLS
- **DESATIVADO** em todas as tabelas (decisão pragmática)
- Ao criar tabela nova, sempre incluir:
```sql
ALTER TABLE public.[tabela] DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.[tabela] TO anon, authenticated;
```

### Consultas SQL no Supabase Editor
- Rodar blocos com `$$` separadamente
- Nunca misturar múltiplas functions com `$$` no mesmo bloco
- Usar aba anônima para evitar extensões de tradução
- "Executar sem RLS" quando aparecer aviso
- "Executar consulta" quando aparecer aviso de operações destrutivas

## Padrões de Interface

### Badges
- Ativo: verde (bg-green-100 text-green-700)
- Inativo: vermelho suave (bg-red-100 text-red-700)
- Aulão: laranja (bg-orange-100 text-orange-700)
- Externo: azul escuro (bg-blue-900 text-white)
- Em Prova: verde (heartbeat < 2min)
- Parcial: amarelo
- PIX: verde, Boleto: amarelo, Cartão: azul

### Confirmações
- Ações destrutivas (inativar, cancelar, excluir): sempre modal de confirmação
- Cor do botão: vermelho para ações destrutivas
- Incluir aviso das consequências no modal

### Banners
- Área do aluno: 1080x500px
- Página /matricula: 1080x600px
- Formatos: JPG, PNG, WEBP

## Boas Práticas

### Segurança
- Chaves de API NUNCA no frontend — sempre server-side
- Variáveis de ambiente via .env (não hardcoded)
- .env no .gitignore
- Service Role Key apenas em client.server.ts

### Lovable
- NUNCA clicar em "Try to fix all"
- NUNCA ativar RLS pelo Lovable
- Ao fazer alteração no Lovable: verificar se aplicou corretamente antes de publish
- Se não aplicar: pedir para identificar arquivo exato

### Banco de Dados
- Sempre verificar valores válidos do enum antes de INSERT/UPDATE
- Sempre testar SQL em ambiente de teste antes de produção
- Ao alterar tipo de coluna: verificar views que dependem dela
- Ao criar trigger: usar `DROP IF EXISTS` antes

### Git
- Branch `main` = produção
- Publicar apenas após testar no Preview
- Commits frequentes com mensagens descritivas

### Integrações
- Z-API: formatar telefone (remover não-dígitos, garantir 55 na frente)
- Asaas: confirmar recebimento ao dar baixa manual
- Panda Video: usar edge function panda-video-sync para importar
- Verificar resultado via `net._http_response WHERE id = N`
