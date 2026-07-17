# 📚 Documentação Oficial — Sistema Soluções Online

## Objetivo
Esta documentação é a **única fonte oficial** do projeto Sistema Soluções Online. Ela foi criada para que qualquer IA (Claude, ChatGPT, Gemini, Cursor, Windsurf, Copilot) ou desenvolvedor humano consiga entender, manter e evoluir o sistema sem depender de históricos de conversa.

## O que é o Sistema Soluções Online
Sistema de gestão escolar completo para a **Escola Soluções Online** (Soluções Online EAD LTDA, CNPJ 65.454.635/0001-04), uma escola de Educação de Jovens e Adultos (EJA) 100% online sediada em Florianópolis, SC, Brasil. O sistema cobre todo o ciclo de vida do aluno: matrícula, aulas, provas, financeiro, documentação, certificação e comunicação via WhatsApp.

## Tecnologias
- **Frontend:** React + TypeScript + TailwindCSS (TanStack Start)
- **Backend:** Supabase (PostgreSQL + Edge Functions + Storage + Realtime)
- **Hospedagem Frontend:** Vercel (migração em andamento — anteriormente Lovable)
- **Código-fonte:** GitHub (`diegonubling-max/sistemasolucoesonline`)
- **Integrações:** Asaas (pagamentos), Panda Video (aulas), Z-API (WhatsApp), Firebase (push notifications)

## Estrutura da Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `01_MASTER.md` | Visão geral completa do projeto |
| `02_ARQUITETURA.md` | Arquitetura técnica detalhada |
| `03_DATABASE.md` | Todas as tabelas, campos, relacionamentos |
| `04_REGRAS_NEGOCIO.md` | Regras de negócio (comissões, financeiro, provas, etc) |
| `05_FRONTEND.md` | Telas, componentes, navegação |
| `06_BACKEND.md` | Edge Functions, Triggers, Cron Jobs, RPCs |
| `07_INTEGRACOES.md` | Asaas, Panda Video, Z-API, Firebase |
| `08_SQL.md` | SQLs importantes, consultas, funções |
| `09_FEATURES.md` | Funcionalidades por módulo (completas/parciais) |
| `10_TODO.md` | Pendências organizadas por prioridade |
| `11_CHANGELOG.md` | Histórico cronológico de alterações |
| `12_PROMPTS_LOVABLE.md` | Prompts usados no desenvolvimento |
| `13_PADRAO_DESENVOLVIMENTO.md` | Convenções de código e banco |
| `14_BUGS_CONHECIDOS.md` | Bugs encontrados, causa e solução |
| `15_CONVENCOES_IA.md` | Manual para qualquer IA trabalhar no projeto |

## Como Utilizar a Documentação

### Para entender o sistema
Leia nesta ordem: `01_MASTER.md` → `04_REGRAS_NEGOCIO.md` → `03_DATABASE.md`

### Para fazer alterações no banco
Consulte: `03_DATABASE.md` → `08_SQL.md` → `06_BACKEND.md`

### Para fazer alterações no frontend
Consulte: `05_FRONTEND.md` → `13_PADRAO_DESENVOLVIMENTO.md`

### Para corrigir bugs
Consulte: `14_BUGS_CONHECIDOS.md` → `06_BACKEND.md`

### Para entender integrações
Consulte: `07_INTEGRACOES.md`

## Como Atualizar a Documentação
Quando o usuário disser **"ATUALIZE A DOCUMENTAÇÃO"**, a IA deve:
1. Identificar quais arquivos foram impactados pela conversa atual
2. Modificar APENAS os arquivos afetados
3. Preservar toda a estrutura existente
4. Evitar duplicação de informações
5. Atualizar `11_CHANGELOG.md` com as mudanças
6. Atualizar `10_TODO.md` se pendências foram resolvidas ou criadas

**NUNCA** recriar a documentação inteira. **NUNCA** gerar um novo resumo da conversa.

## Regras Gerais
1. Esta documentação é a **única fonte de verdade** do projeto
2. Cada assunto tem **um único arquivo** — não duplicar informações entre arquivos
3. Manter sempre a documentação **atualizada** após cada sessão de desenvolvimento
4. Ao resolver um item do TODO, movê-lo para o CHANGELOG
5. Ao encontrar um bug, documentá-lo em `14_BUGS_CONHECIDOS.md`
6. Ao criar uma funcionalidade nova, adicioná-la em `09_FEATURES.md`

## Dados do Projeto

| Item | Valor |
|------|-------|
| Empresa | Soluções Online EAD LTDA |
| CNPJ | 65.454.635/0001-04 |
| Sede | Florianópolis, SC, Brasil |
| Owner | Diego Nubling Santos |
| Email Admin | diegonubling@gmail.com |
| GitHub | diegonubling-max/sistemasolucoesonline |
| Supabase Project ID | qohvseedougwymxjhbgi |
| Supabase URL | https://qohvseedougwymxjhbgi.supabase.co |
| Site Institucional | https://supletivosolucoesonline.com.br |
