# 12 — PROMPTS LOVABLE

## Regra Geral para Todos os Prompts
Sempre incluir no final de QUALQUER prompt enviado ao Lovable:
```
⚠️ NÃO clicar em "Try to fix all". NÃO ativar RLS.
```

## Módulo: Provas Agendadas

### Botão Agendar Externo
Modal com: nome, telefone, polo, data, hora, situação financeira, matérias (multi-select com checkbox). Chama RPC `criar_aluno_externo_com_prova`. Após sucesso: card com CTR + senha + botão copiar.

### Badge Em Prova
Guia Agendadas: filtrar `.in('status', ['agendada', 'iniciado'])`. Badge 🟢 se `ultimo_heartbeat` < 2 min. Badge 🟡 se iniciado sem heartbeat.

### Reagendar Reprovadas
Botão na guia Reprovados. Chama `reagendar_materias_reprovadas`. WhatsApp automático com nova data.

## Módulo: Login

### Desvio para Externos
Se CTR começa com 'P': chama `login_aluno_externo`. Se `tem_acesso = false`: bloqueia. Se true: tela simplificada só prova.

## Módulo: Financeiro

### Matrículas por Vendedora
Arquivo: `src/routes/_admin.financeiro.tsx`. Colunas: Data, Aluno, CTR, Forma Pgto (badge), Telefone, Vendedora. Cards com ativas/inativas.

### Cobrança R$0
Filtros em whatsapp-cobranca.ts: `.neq('status','isento').neq('status','pago').gt('valor', 0)`

## Módulo: Alunos

### Ativar/Inativar
UPDATE conjunto: `{ ativo: false, status: 'inativo' }` ou `{ ativo: true, status: 'ativo' }`. Modal com aviso das consequências.

### Busca por Telefone
`.or('nome.ilike.%search%,ctr.ilike.%search%,telefone.ilike.%search%')`. Placeholder: "Buscar por nome, CTR ou telefone..."

## Módulo: Segurança

### Mover Z-API para Server-side
Criar rota `/api/public/hooks/zapi-send` que lê chaves de `process.env`. Frontend chama essa rota em vez de chamar Z-API diretamente.

## Módulo: Prova do Aluno

### Regra de Liberação
Função centralizada: Acelerado = sempre liberada. Com agendamento = data agendada. Padrão = 60 dias. Verificar em TODOS os pontos do código.

### Salvamento em Tempo Real
Cada resposta: `supabase.rpc('salvar_resposta_prova', {...})`. Ao terminar matéria: `supabase.rpc('finalizar_materia_prova', {...})`. Retomada: buscar respostas existentes no jsonb.

## Módulo: Página /matricula

### Checkout Aulão
Mobile-first. Dados → Pagamento (3 cards) → Contrato → Confirmação. CTR gerado pelo trigger normal. `origem = 'Lançamento'`. WhatsApp para 48991535895.

## Dica: Quando Lovable não Aplica
Se o Lovable não aplica uma alteração após 2 tentativas, pedir para ele identificar o arquivo exato e mostrar o código antes de alterar. Arquivo principal do financeiro: `src/routes/_admin.financeiro.tsx`.
