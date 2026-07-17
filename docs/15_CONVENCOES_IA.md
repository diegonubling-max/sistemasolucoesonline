# 15 — CONVENÇÕES IA

## Manual para Qualquer IA Trabalhar Neste Projeto

Este documento define as regras que QUALQUER IA (Claude, ChatGPT, Gemini, Cursor, Windsurf, Copilot) deve seguir ao trabalhar neste projeto.

---

## Regras Obrigatórias

### 1. NUNCA alterar arquitetura sem autorização
- Não mudar stack tecnológico
- Não trocar bibliotecas sem pedir
- Não mudar estrutura de pastas sem pedir
- Não alterar modelo de autenticação sem pedir

### 2. NUNCA recriar tabelas
- Tabelas existentes devem ser alteradas com ALTER TABLE, não DROP + CREATE
- Se precisar de uma nova coluna: ALTER TABLE ADD COLUMN
- Se precisar mudar tipo: verificar views dependentes antes (pg_depend)
- Se precisar de nova tabela: CREATE TABLE IF NOT EXISTS

### 3. NUNCA remover funcionalidades
- Funcionalidades existentes devem ser preservadas
- Se precisar mudar comportamento: perguntar ao Diego primeiro
- Se um componente não funciona: corrigir, não remover

### 4. NUNCA alterar interface sem solicitação
- Não mudar cores, fontes, layout sem pedir
- Não reorganizar menus sem pedir
- Não adicionar/remover colunas de tabelas sem pedir
- Se o Diego pedir uma mudança, fazer APENAS o que foi pedido

### 5. Sempre reutilizar componentes
- Antes de criar componente novo, verificar se existe similar
- Usar shadcn/ui para componentes de UI
- Manter consistência visual (badges, botões, cores padrão)

### 6. Sempre reutilizar funções
- Antes de criar RPC nova, verificar se existe similar
- Reutilizar triggers existentes quando possível
- Não duplicar lógica em múltiplos pontos do código

### 7. Sempre atualizar documentação
- Após qualquer alteração, quando o Diego disser "ATUALIZE A DOCUMENTAÇÃO":
  - Atualizar APENAS os arquivos impactados
  - Adicionar ao CHANGELOG (11_CHANGELOG.md)
  - Atualizar TODO (10_TODO.md) se pendências foram criadas/resolvidas
  - Atualizar FEATURES (09_FEATURES.md) se funcionalidades foram adicionadas
  - Atualizar BUGS (14_BUGS_CONHECIDOS.md) se bugs foram encontrados/resolvidos

### 8. Sempre preservar compatibilidade
- Mudanças no banco devem ser retrocompatíveis
- Colunas novas devem ter DEFAULT ou ser nullable
- Enums: verificar valores válidos com `SELECT enum_range(NULL::tipo)` antes de usar
- Triggers: usar `DROP IF EXISTS` antes de `CREATE`

---

## Regras de Banco de Dados

### Supabase
- **Project ID:** qohvseedougwymxjhbgi
- **URL:** https://qohvseedougwymxjhbgi.supabase.co
- **RLS:** DESATIVADO em todas as tabelas (intencional)

### Ao criar tabela nova
```sql
CREATE TABLE IF NOT EXISTS public.nova_tabela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- campos...
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.nova_tabela DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.nova_tabela TO anon, authenticated;
```

### Ao criar trigger novo
```sql
DROP TRIGGER IF EXISTS trg_nome ON tabela;
CREATE TRIGGER trg_nome
  [BEFORE|AFTER] [INSERT|UPDATE|DELETE] ON tabela
  FOR EACH ROW
  EXECUTE FUNCTION nome_funcao();
```

### Ao criar function com $$
- Rodar SEPARADAMENTE de outras functions (Supabase SQL Editor não aceita múltiplos $$ no mesmo bloco)

### Ao alterar tipo de coluna
1. Verificar views dependentes: `SELECT * FROM pg_depend WHERE refobjid = 'tabela'::regclass`
2. DROP VIEW → ALTER COLUMN → CREATE VIEW (recriar)

### Verificar enums antes de usar
```sql
SELECT enum_range(NULL::payment_status);   -- aberto,pago,isento,parcial,cancelado
SELECT enum_range(NULL::sexo_aluno);        -- Masculino,Feminino
SELECT enum_range(NULL::origem_aluno);      -- Google,Meta,Indicação,Outros,Lançamento
```

### Verificar resultado de edge function
```sql
SELECT content, status_code FROM net._http_response WHERE id = N;
```

---

## Regras de Frontend

### Lovable
- NUNCA clicar em "Try to fix all" (reativa RLS, some dados)
- NUNCA clicar em "Security findings → Try to fix all"
- Sempre incluir no final de QUALQUER prompt:
  ```
  ⚠️ NÃO clicar em "Try to fix all". NÃO ativar RLS.
  ```
- Se o Lovable não aplicar uma mudança após 2 tentativas: pedir pra identificar o arquivo exato

### Variáveis de Ambiente
- **Frontend (VITE_*):** podem ser públicas (anon key é pública por design)
- **Server-side (process.env):** NUNCA expor no frontend
- Chaves de API (Z-API, Asaas, Panda Video): APENAS server-side

### Mobile-First
- Área do aluno: SEMPRE mobile-first
- Público acessa pelo celular via WhatsApp
- Inputs de data: campo texto com máscara (não date picker)
- Botões grandes, texto legível

---

## Regras de Segurança

### Chaves que NUNCA vão no frontend
- Supabase Service Role Key
- API Key do Asaas
- API Key do Panda Video
- Instance ID, Token e Client-Token do Z-API

### Chaves que PODEM ir no frontend
- Supabase Anon/Public Key (é pública por design)
- Supabase URL
- Firebase Sender ID

### Z-API
- Chamadas via rota proxy: `/api/public/hooks/zapi-send`
- Chaves em `process.env` (ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN)
- Formatação de telefone: remover não-dígitos, garantir 55 na frente

---

## Regras de Comunicação com Diego

### Formato de entrega
- SQL: pronto pra copiar e colar no Supabase SQL Editor
- Se tiver múltiplas functions com $$: separar em blocos
- Prompts Lovable: prontos pra copiar e colar
- Sempre dizer se roda no sistema NOVO ou ANTIGO

### Quando perguntar antes de agir
- Qualquer mudança de arquitetura
- Qualquer remoção de funcionalidade
- Qualquer mudança visual significativa
- Quando não tiver certeza do comportamento esperado

### Quando agir direto
- Correção de bugs claros
- Adição de colunas com DEFAULT
- Criação de novas RPCs/functions
- Fix de triggers quebrados

### Termos comuns do Diego
- "Dar baixa" = marcar parcela como paga
- "Inativar" = mudar aluno/colaborador para inativo
- "Subir" = fazer upload (ex: subir aulas no Panda)
- "Rodar" = executar SQL
- "Colar no Lovable" = enviar prompt para o chat do Lovable
- "Publicar" = fazer deploy (Publish no Lovable ou Deploy na Vercel)

---

## Fluxo de Trabalho Recomendado

### Para correção de bug
1. Identificar a causa (query no banco, log de erro)
2. Verificar se já existe em 14_BUGS_CONHECIDOS.md
3. Propor a correção (SQL ou prompt Lovable)
4. Testar
5. Documentar em 14_BUGS_CONHECIDOS.md

### Para nova funcionalidade
1. Entender o requisito completo (perguntar se necessário)
2. Verificar se algo similar já existe (09_FEATURES.md)
3. Planejar: banco primeiro, depois frontend
4. Implementar em blocos testáveis
5. Documentar em 09_FEATURES.md e 11_CHANGELOG.md

### Para importação de dados
1. Verificar se tem alunos com progresso antes de deletar aulas
2. Usar UPDATE (não DELETE+INSERT) quando possível preservar IDs
3. Verificar resultado via `net._http_response`
4. Contar registros antes e depois

---

## Contexto Crítico para Novas Sessões

### Situação Atual (Julho 2026)
- Projeto Lovable original BLOQUEADO permanentemente (Trust & Safety)
- Novo Supabase criado: `qohvseedougwymxjhbgi`
- Código completo no GitHub: `diegonubling-max/sistemasolucoesonline`
- Banco reconstruído com tabelas, triggers, RPCs e views
- Deploy Vercel em andamento
- Lovable novo em configuração (importar código via GitHub)
- Dados dos alunos: parcialmente recuperados dos CSVs; aguardando export do Lovable

### Prioridades Imediatas
1. Sistema no ar (Vercel + Supabase novo)
2. Dados dos alunos reimportados
3. Aulas do Panda reimportadas
4. Página /matricula funcionando (aulão dia 21/07/2026)

### Parceiro Estratégico
- **Principia:** antecipa 70% das parcelas de boleto por 3 meses. Exige contrato assinado. Motivação principal do checkout público (/matricula).
