# 06 — BACKEND

## Triggers

### trg_ajustar_ctr (BEFORE INSERT ON alunos)
**Função:** `ajustar_ctr_pular_13()`
**Objetivo:** Gera CTR sequencial e pula números terminados em 13
**Lógica:** Se `NEW.ctr IS NULL`, gera via `alunos_ctr_seq`. Loop `WHILE ctr % 100 = 13` pula para o próximo.

### trg_gerar_numero_parcela (BEFORE INSERT ON parcelas)
**Função:** `gerar_numero_parcela()`
**Objetivo:** Atribui número sequencial (5001+) a cada parcela
**Lógica:** Se `NEW.numero IS NULL OR = 0`, gera via `parcelas_numero_seq`

### trg_gerar_comissao_pagamento (AFTER UPDATE OF status ON parcelas)
**Função:** `gerar_comissao_pagamento()`
**Condição:** `NEW.status = 'pago' AND OLD.status != 'pago'`
**Objetivo:** Gera comissão ao pagar Parcela 1
**Lógica:**
1. Verifica se é `tipo = 'parcela'` AND `numero = 1`
2. Busca colaborador da matrícula
3. Se existe e não tem comissão duplicada
4. Conta parcelas: >1 parcela OU boleto → comissão parcelado; senão → avista
5. Insere em `comissoes` com `ON CONFLICT DO NOTHING`

### trg_ao_inativar_aluno (AFTER UPDATE OF ativo ON alunos)
**Função:** `trg_inativar_aluno()`
**Condição:** `OLD.ativo = true AND NEW.ativo = false`
**Objetivo:** Cancela parcelas abertas e pós-vendas pendentes
**Lógica:**
1. `UPDATE parcelas SET status = 'cancelado' WHERE status = 'aberto'`
2. `UPDATE pos_vendas SET status = 'cancelado' WHERE status = 'pendente'`

### trg_prova_completa (AFTER UPDATE OF finalizado_em ON prova_resultados)
**Função:** `trg_verificar_prova_completa()`
**Condição:** `NEW.finalizado_em IS NOT NULL AND OLD.finalizado_em IS NULL`
**Objetivo:** Atualiza agendamento quando todas as matérias selecionadas foram finalizadas
**Lógica:**
1. Busca `materias_selecionadas` do agendamento
2. Conta finalizadas vs total selecionadas
3. Se todas finalizadas: atualiza resultado (aprovado se todas >= 60%, senão reprovado)

## RPCs (Functions)

### gerar_ctr_lancamento()
**Retorna:** text (ex: 'A0501')
**Uso:** Reservado — atualmente aulão usa CTR numérico normal
**Lógica:** `'A' || lpad(nextval('ctr_lancamento_seq'), 4, '0')`

### buscar_email_por_ctr(p_ctr integer)
**Retorna:** text (email do aluno)
**Uso:** Busca email para autenticação

### delete_aluno_completo(p_aluno_id uuid)
**Retorna:** void
**Uso:** Exclusão completa de aluno (cascata manual)
**Lógica:** Deleta em ordem: aulas_assistidas → prova_resultados → documentacao_alunos → pos_vendas → comissoes → parcelas → matriculas → alunos

### criar_aluno_externo_com_prova(...)
**Parâmetros:** nome, telefone, polo_id, data_prova, hora_prova, situacao_financeira, quem_agendou, materias (default: todas 10)
**Retorna:** TABLE(aluno_externo_id, ctr, senha)
**Uso:** Cadastra aluno externo + agendamento de prova em uma operação
**Lógica:**
1. Gera CTR série P via `ctr_externo_seq`
2. Gera senha `1234 + primeiro nome`
3. Insere em `alunos_externos`
4. Insere em `prova_agendamentos` com `materias_selecionadas`

### login_aluno_externo(p_ctr text, p_senha text)
**Retorna:** TABLE(id, nome, telefone, polo_id, tem_acesso)
**Uso:** Valida login de externo e verifica acesso
**Lógica:** Busca em `alunos_externos`, chama `externo_tem_acesso_hoje()`

### externo_tem_acesso_hoje(p_ctr text)
**Retorna:** boolean
**Uso:** Verifica se externo pode acessar hoje
**Lógica:** EXISTS agendamento com `data_prova = hoje`, `resultado IS NULL`, status IN ('agendada', 'iniciado')

### gerar_ctr_externo_existente(p_agendamento_id uuid)
**Retorna:** TABLE(ctr, senha)
**Uso:** Gera CTR para externo já agendado sem CTR
**Lógica:** Busca dados do agendamento, cria registro em `alunos_externos`, vincula CTR ao agendamento

### salvar_resposta_prova(...)
**Parâmetros:** aluno_id, agendamento_id, materia, questao_id, resposta
**Retorna:** void
**Uso:** Salva cada resposta individual em tempo real
**Lógica:** Se não existe registro de resultado para a matéria, cria. Se existe, atualiza o jsonb `respostas`.

### finalizar_materia_prova(...)
**Parâmetros:** aluno_id, agendamento_id, materia
**Retorna:** TABLE(total_q, acertos, perc, foi_aprovado)
**Uso:** Calcula nota ao terminar todas as 10 questões de uma matéria
**Lógica:**
1. Busca respostas do jsonb
2. Para cada resposta, compara com `resposta_correta` da questão usando `UPPER()`
3. Calcula percentual e determina aprovação (>= 60%)
4. Atualiza `prova_resultados` com totais e `finalizado_em = now()`

### reagendar_materias_reprovadas(...)
**Parâmetros:** agendamento_id, data_prova, hora_prova
**Retorna:** uuid (novo agendamento_id)
**Uso:** Cria novo agendamento apenas com matérias reprovadas
**Lógica:** Busca matérias com `aprovado = false` do agendamento original, cria novo agendamento com essas matérias

## Cron Jobs

| Job | Schedule (UTC) | Horário BRT | Endpoint | Descrição |
|-----|---------------|-------------|----------|-----------|
| zapi-jobs-seg-sab-g0 a g9 | 12:00-13:30 UTC | 09:00-10:30 | /api/public/hooks/zapi-jobs-diarios | Mensagens motivacionais seg-sáb (1 grupo por dígito do CTR) |
| zapi-jobs-dom-g0 a g9 | 13:00-14:30 UTC | 10:00-11:30 | /api/public/hooks/zapi-jobs-diarios | Mensagens FDS domingo |
| whatsapp-cobranca-diaria | 12:00 UTC | 09:00 | /api/public/hooks/whatsapp-cobranca | Cobrança de parcelas vencidas |
| lembrete-prova-30min | */30 * * * * | A cada 30 min | /api/public/hooks/lembrete-prova | Lembrete 30 min antes da prova |

### Filtros nos Disparos
- **Motivacionais/Aulas:** excluir alunos inativos + alunos com prova finalizada
- **Cobrança:** excluir parcelas isento, cancelado, valor <= 0, alunos inativos
- **FDS:** 6 ciclos baseados em semanas desde matrícula; após ciclo 6 para de enviar

## Edge Functions (Supabase)

### panda-video-sync
**Objetivo:** Importar aulas do Panda Video para o banco
**Parâmetros:** `folder_name`, `curso_nome`, `mode` ('insert')
**Fluxo:**
1. Busca vídeos da pasta no Panda Video API
2. Encontra curso pelo nome no banco
3. Insere aulas com título, URL do player, ordem, duração
4. Retorna contagem de inseridos e pulados

**Verificação do resultado:**
```sql
SELECT content, status_code FROM net._http_response WHERE id = N;
```

## Rotas de API (Server-side)

### /api/public/hooks/zapi-send (POST)
**Objetivo:** Proxy para Z-API (chaves no server-side)
**Body:** `{ phone, message }`
**Chaves:** lidas de `process.env` (ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN)

### /api/public/hooks/zapi-jobs-diarios (POST)
**Objetivo:** Endpoint chamado pelos cron jobs para disparar mensagens motivacionais

### /api/public/hooks/whatsapp-cobranca (POST)
**Objetivo:** Disparo de cobrança de parcelas vencidas
**Filtros:** exclui isento, cancelado, valor <= 0, alunos inativos

### /api/public/hooks/lembrete-prova (POST)
**Objetivo:** Lembrete 30min antes da prova via WhatsApp
**Inclui:** alunos regulares + externos (com CTR e senha para externos)

## Validações

### Assinatura de Contrato (src/routes/contrato.$token.tsx)
- Valida: nome + telefone + CPF
- Nome: `trim() + toLowerCase()` + remoção de acentos (`normalize('NFD')`)
- Telefone: remove não-dígitos, compara só números
- CPF: remove não-dígitos, compara 11 dígitos
- 3 campos devem bater simultaneamente (AND)
- Após 3 tentativas erradas: bloqueio permanente

### Confirmação Asaas ao dar baixa
- Se parcela tem `asaas_id`, chama API Asaas `/v3/payments/{id}/receiveInCash`
- Evita emails de cobrança automáticos do Asaas

---

## Novas Rotas Server-Side (Sessão Jul/2026)

### /api/public/hooks/asaas-aulao (POST)
Cria cobrança no Asaas para matrículas do aulão.
- PIX: taxa de matrícula R$69,90 → retorna QR code + copia-e-cola
- Cartão: curso completo R$1.438,80 → suporta parcelamento 1-12x (mínimo R$5/parcela)
- Cria/reutiliza cliente no Asaas por CPF
- Salva asaas_customer_id, asaas_payment_id, pagamento_status na matriculas_aulao
- Fallback de credenciais: Supabase URL/key e Asaas key do polo

### /api/public/hooks/asaas-webhook-aulao (POST)
Webhook chamado pelo Asaas quando pagamento PIX é confirmado.
- Eventos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED
- Atualiza pagamento_status = 'confirmado' na matriculas_aulao via externalReference

### /api/public/hooks/zapi-send (POST) — atualizado
- Credenciais Z-API adicionadas como fallback no código (não depende de env vars)
- Instance ID: 3F4CC1DC22AB31BDE17ECE717FF40C71
- Número do Z-API: 48 98439-3047

## RPCs:
### criar_matricula_lancamento — recriada
- Insere em matriculas_aulao (não mais em alunos)
- Não gera login/senha
- Agendamento de boas-vindas com delay aleatório 2-4 minutos

## Cron Jobs (pg_cron):
### aulao-boas-vindas (a cada minuto)
- Função: enviar_boas_vindas_aulao_pendentes()
- Chama Z-API DIRETAMENTE via pg_net (não passa pelo servidor web)
- URL: https://api.z-api.io/instances/.../send-text
- Dispara para matrículas onde boas_vindas_agendado_para <= now() e boas_vindas_enviado_em IS NULL

## Triggers:
- trg_matriculas_aulao_updated_at — atualiza updated_at automaticamente


## Webhook Asaas — Correção:
- Webhook NÃO sobrescreve pagamento_valor com valor da parcela (payment.value)
- Apenas atualiza pagamento_status = 'confirmado'
- Valor total correto é salvo na criação da cobrança (R$69,90 PIX / R$1.438,80 cartão)

## Notas sobre aluno_aulas_assistidas:
- Coluna curso_id é obrigatória para queries do frontend (admin e aluno)
- Ao inserir progresso manualmente, sempre preencher curso_id via JOIN com aulas
- Percentual >= 70 conta como "concluída" no frontend

