# 02 — ARQUITETURA

## Stack Tecnológico

### Frontend
- **Framework:** React + TypeScript
- **Meta-framework:** TanStack Start (SSR + rotas file-based)
- **Estilização:** TailwindCSS + shadcn/ui
- **Gerenciador de pacotes:** Bun
- **Estado:** React hooks (useState, useEffect)
- **Roteamento:** TanStack Router (file-based em `src/routes/`)

### Backend
- **Banco de dados:** PostgreSQL (via Supabase)
- **API:** Supabase Auto-generated REST API + RPCs customizadas
- **Edge Functions:** Supabase Edge Functions (Deno)
- **Storage:** Supabase Storage (buckets para documentos)
- **Realtime:** Supabase Realtime (não amplamente usado ainda)

### Hospedagem
- **Frontend:** Vercel (Hobby plan) — deploy automático do GitHub
- **Banco:** Supabase (Free plan, região East US - North Virginia)
- **Código:** GitHub (`diegonubling-max/sistemasolucoesonline`, privado)

### Integrações Externas
- **Asaas:** Gateway de pagamento (PIX + Boleto)
- **Panda Video:** Hospedagem de vídeo-aulas
- **Z-API:** Automação WhatsApp
- **Firebase:** Push Notifications (Project ID: solucoes-online, Sender ID: 548326438424)

## Fluxo de Dados

```
Aluno/Admin (Browser/Mobile)
  ↓ HTTPS
Vercel (Frontend React)
  ↓ Supabase JS Client (anon key)
Supabase (PostgreSQL + Edge Functions)
  ↓ Triggers / Cron Jobs
Z-API (WhatsApp) | Asaas (Pagamentos) | Panda Video (Aulas)
```

## Estrutura de Pastas (GitHub)

```
sistemasolucoesonline/
├── .lovable/          # Configurações Lovable (legacy)
├── public/            # Assets estáticos
├── src/
│   ├── components/    # Componentes React reutilizáveis
│   │   ├── admin/     # Componentes do painel admin
│   │   ├── aluno/     # Componentes da área do aluno
│   │   └── ui/        # Componentes shadcn/ui
│   ├── integrations/  # Configuração Supabase client
│   │   └── supabase/
│   │       ├── client.ts        # Cliente frontend (anon key via env)
│   │       └── client.server.ts # Cliente server-side (service_role)
│   ├── routes/        # Rotas file-based (TanStack)
│   │   ├── _admin.*   # Rotas do admin (protegidas)
│   │   ├── aluno/     # Rotas da área do aluno
│   │   ├── api/       # Rotas de API (server-side)
│   │   │   └── public/hooks/  # Webhooks (Z-API, cobrança, etc)
│   │   ├── contrato.$token.tsx  # Assinatura de contrato público
│   │   └── matricula.tsx        # Checkout público aulão
│   ├── services/      # Serviços (Z-API, etc)
│   └── lib/           # Utilitários
├── supabase/
│   └── functions/     # Edge Functions
├── .env               # Variáveis de ambiente
├── .gitignore
├── bunfig.toml
└── package.json
```

## Autenticação

### Modelo Atual
O sistema **NÃO usa Supabase Auth**. A autenticação é customizada:

- **Admin:** Login por email + senha verificados contra tabela `colaboradores`
- **Colaborador:** Mesmo fluxo, mesma tabela, diferenciado por `setor`
- **Aluno Regular:** Login por CTR (integer) + senha verificados contra tabela `alunos`
- **Aluno Externo:** Login por CTR (prefixo "P") + senha verificados contra tabela `alunos_externos`

### Fluxo de Login do Aluno
```
Aluno digita CTR + senha
  ↓
CTR começa com "P"?
  SIM → Busca em alunos_externos → externo_tem_acesso_hoje() → tela de prova apenas
  NÃO → Busca em alunos → verifica ativo → área completa do aluno
```

### Senhas
- **Colaboradores:** `admin1234` (padrão)
- **Alunos:** `1234` + primeiro nome em minúsculo (ex: `1234diego`)
- **Externos:** Mesmo padrão dos alunos

## RLS (Row Level Security)
**DESATIVADO** em todas as tabelas. Decisão pragmática durante o desenvolvimento. O frontend usa apenas a `anon key` (pública por design). A `service_role key` está APENAS no server-side.

### Mitigação de Risco
- Chaves Z-API e Asaas movidas para server-side
- `.env` adicionado ao `.gitignore`
- Service Role Key nunca exposta no frontend
- RLS será reativado quando migrar para domínio próprio com autenticação robusta

## Storage (Supabase)
- **Bucket:** `documentos-alunos` (Private) — documentos de matrícula dos alunos
- Acesso via Supabase Storage API

## Edge Functions
- **`panda-video-sync`:** Importa aulas de uma pasta do Panda Video para o banco
  - Recebe: `folder_name`, `curso_nome`, `mode`
  - Usa Panda Video API Key e Library ID
  - Verifica resultado via `net._http_response`

## Cron Jobs (pg_cron)

| Job | Schedule | Endpoint |
|-----|----------|----------|
| zapi-jobs-seg-sab-g0 a g9 | Seg-Sáb 09:00-10:30 BRT | /api/public/hooks/zapi-jobs-diarios |
| zapi-jobs-dom-g0 a g9 | Dom 10:00-11:30 BRT | /api/public/hooks/zapi-jobs-diarios |
| whatsapp-cobranca-diaria | 09:00 BRT | /api/public/hooks/whatsapp-cobranca |
| lembrete-prova-30min | */30 * * * * | /api/public/hooks/lembrete-prova |

## Variáveis de Ambiente

### Frontend (VITE_*)
```
VITE_SUPABASE_URL=https://qohvseedougwymxjhbgi.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=qohvseedougwymxjhbgi
```

### Server-side (process.env)
```
ZAPI_INSTANCE_ID=<instance id>
ZAPI_TOKEN=<token>
ZAPI_CLIENT_TOKEN=<client token>
```

### NÃO expor no frontend
- Service Role Key do Supabase
- API Key do Asaas
- API Key do Panda Video
- Chaves Z-API (já migradas para server-side)

## Relacionamento entre Módulos

```
Alunos ──── Matrículas ──── Parcelas ──── Comissões
  │              │              │
  │              │              └── Parcelas_Pagamentos (parcial)
  │              │
  │              ├── Colaboradores (vendedora)
  │              └── Polos
  │
  ├── Aluno_Aulas_Assistidas ──── Aulas ──── Cursos ──── Segmentos
  │
  ├── Prova_Agendamentos ──── Prova_Resultados
  │                              │
  │                              └── Prova_Questoes
  │
  ├── Pos_Vendas
  │
  ├── Documentacao_Alunos ──── Certificadoras
  │
  └── Zapi_Mensagens_Log

Alunos_Externos ──── Prova_Agendamentos (via CTR)
```
