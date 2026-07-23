# 04 — REGRAS DE NEGÓCIO

## CTR (Código do Aluno)

### Geração
- Sequência automática via `alunos_ctr_seq` (trigger `ajustar_ctr_pular_13`)
- CTRs terminados em 13 são **pulados automaticamente** (superstição)
- Alunos regulares: numéricos (1001, 1002, 1714, etc)
- Alunos externos (só prova): série P (P001, P002, P003) — tabela separada `alunos_externos`
- Alunos de aulão/lançamento: sequência numérica normal, diferenciados por `origem = 'Lançamento'`

### Senha Padrão
- `1234` + primeiro nome em minúsculo
- Exemplo: Diego → `1234diego`

## Comissões

### Valores Padrão
| Tipo | Valor |
|------|-------|
| Avista (PIX/Cartão/Dinheiro) | R$ 120,00 |
| Parcelado (Boleto) | R$ 50,00 |

### Exceções por Vendedora
| Vendedora | Avista | Parcelado |
|-----------|--------|-----------|
| Vera Altneter | R$ 150,00 | R$ 70,00 |

### Regras de Geração
1. Comissão é gerada **automaticamente** via trigger `gerar_comissao_pagamento`
2. Dispara **apenas** quando a **Parcela 1** muda de status para `pago`
3. Lógica de tipo: se `forma_pagamento = 'boleto'` **OU** mais de 1 parcela → comissão parcelado
4. Se apenas 1 parcela e não é boleto → comissão avista
5. Verificação de duplicidade: `ON CONFLICT DO NOTHING`
6. Só gera se a matrícula tem `colaborador_id` preenchido (matrículas online sem vendedora não geram comissão)

### Fechamento
- Período: dia 01 ao último dia do mês
- Pagamento: dia 20 do mês seguinte
- Competência usa `data_pagamento` da parcela (não `created_at`)

## Pacotes de Matrícula

| Pacote | Tipo | Parcelas | Valor Parcela | Total |
|--------|------|----------|---------------|-------|
| Avista | pix | 1 | R$ 997,00 | R$ 1.067,00 |
| Avista Acelerado | pix | 1 | R$ 1.199,00 | R$ 1.269,00 |
| Boleto (1+6) | boleto | 7 | R$ 199,90 | R$ 1.469,30 |
| Boleto (1+9) | boleto | 10 | R$ 159,90 | R$ 1.669,00 |
| Cartão (12x) | cartao | 12 | R$ 99,90 | R$ 1.268,80 |
| Cartão Acelerado (12x) | cartao | 12 | R$ 119,90 | R$ 1.508,80 |

**Taxa de Matrícula:** R$ 69,90 (todas as matrículas)

### Pacote Personalizado (Negociado)
- Forma de pagamento padrão: `boleto`
- Valores e parcelas definidos manualmente
- Sempre gera comissão de parcelado

## Parcelas

### Datas de Vencimento
- Taxa matrícula: data da matrícula (hoje)
- Parcela 1: 30 dias após matrícula
- Parcela 2: 60 dias após matrícula
- Parcela N: 30 * N dias após matrícula

### Status
- `aberto` — aguardando pagamento
- `pago` — pagamento confirmado
- `isento` — taxa zerada (matrícula isenta)
- `parcial` — pagamento parcial recebido
- `cancelado` — cancelada (aluno inativado ou negociação)

### Numeração
- Sequência automática via `parcelas_numero_seq` (começa em 5001)
- Trigger `gerar_numero_parcela` atribui número no INSERT

### Pagamento Parcial
- Registro em `parcelas_pagamentos`
- `valor_pago_total` acumulado na parcela
- Badge 🟡 Parcial na listagem
- Comissão proporcional ao valor pago

## Regra de Liberação da Prova

### Aluno Regular (não Acelerado)
1. **Padrão:** 60 dias após data da matrícula
2. **Com agendamento:** se a Mônica agendou a prova antes dos 60 dias, a data agendada prevalece
3. **Prioridade:** agendamento > 60 dias

### Aluno Acelerado
- **Sem prazo mínimo** — prova pode ser feita a qualquer momento

### Aluno Externo (série P)
- Acesso APENAS no dia da prova (`data_prova = hoje`)
- Se não logar no dia → cai na guia Reagendar
- Mônica atualiza `data_prova` → acesso volta no novo dia
- Resultado preenchido → acesso bloqueado imediatamente

## Prova Final

### Estrutura
- 10 questões por matéria (alternativas A, B, C, D)
- Matérias selecionáveis por agendamento (campo `materias_selecionadas`)
- Default: todas as 10 matérias EJA

### Fluxo
1. Aluno escolhe matéria na lista
2. Responde 1 questão por vez
3. Cada resposta salva no banco em tempo real (`salvar_resposta_prova`)
4. Ao responder a 10ª questão, `finalizar_materia_prova` calcula nota
5. Resultado NÃO é mostrado até terminar TODAS as matérias
6. Ao terminar todas, trigger `trg_prova_completa` atualiza agendamento
7. Tela de resultado final mostra nota por matéria

### Critério de Aprovação
- **Por matéria:** >= 60% de acertos = aprovado
- **Geral:** aprovado em TODAS as matérias = aprovado geral

### Comparação de Respostas
- Usa `UPPER()` na comparação (aluno pode digitar 'a' ou 'A')
- Bug corrigido: anteriormente comparação era case-sensitive

### Retomada após Queda
- Matéria com `finalizado_em` preenchido → ✅ completa
- Matéria com `finalizado_em` NULL mas `respostas` com dados → retoma de onde parou
- Matéria sem registro → não iniciada

### Reagendamento de Reprovadas
- Função `reagendar_materias_reprovadas` cria novo agendamento
- Somente matérias reprovadas são incluídas
- Resultados aprovados do agendamento anterior são preservados
- WhatsApp automático com nova data

## Inativação de Aluno

### Trigger Automático (`trg_ao_inativar_aluno`)
Ao mudar `ativo` de true para false:
1. Parcelas com status `aberto` → muda para `cancelado`
2. Pós-vendas com status `pendente` → muda para `cancelado`

### Consequências
- Aluno perde acesso ao login
- Desaparece do pós-venda
- Desaparece da cobrança
- Parcelas canceladas aparecem no "Histórico de Condições Anteriores"

### Reativação
- Admin pode reativar (muda `ativo` de false para true)
- Opção de reativar condições anteriores (parcelas canceladas → aberto)
- Ou criar novo pacote

## Pós-Venda

### Etapas
- **D+1:** 1 dia após matrícula
- **D+5:** 5 dias após matrícula
- **D+15:** 15 dias após matrícula

### Regras
- Etapa seguinte criada automaticamente ao concluir a anterior
- Constraint UNIQUE(matricula_id, etapa) impede duplicidade
- Alunos inativos não aparecem na tela de pós-venda
- Alunos que já fizeram prova não recebem mensagens sobre aulas

## Disparos WhatsApp

### Filtros de Exclusão (aplicar em TODOS os disparos motivacionais/aula)
1. Alunos inativos (ativo = false)
2. Alunos com prova finalizada (resultado não NULL em prova_agendamentos)
3. Parcelas com status isento, cancelado, ou valor <= 0 (para cobrança)

### Cobrança
- NÃO excluir por resultado de prova (aluno aprovado ainda pode ter parcela pendente)
- EXCLUIR: status isento, cancelado, valor <= 0, alunos inativos

## Documentação e Certificação

### Fluxo
1. Checklist de documentos preenchido pelo admin
2. Quando completo, encaminhar para certificadora (botão ✈️)
3. Certificadora emite certificado digital
4. Certificado digital enviado ao aluno
5. Certificado físico recebido e entregue

### Certificadoras
CECO, Educa Nexus, Ifope, Nobel, Referencial, Santa Rita

## Matrícula de Aulão (/matricula)

### Fluxo (atualizado 22/07/2026)
1. Aluno preenche dados pessoais (etapa 1)
2. Etapa 2 (única): escolhe forma de pagamento (Boleto/Cartão), lê o Termo de Matrícula se quiser (fica oculto, só abre em modal ao clicar no link), marca a caixinha "Li e aceito os termos de matrícula" e confirma — **não precisa mais redigitar nome/CPF**, a assinatura usa o nome já preenchido na etapa 1
3. Ao confirmar, gera o registro de aceite (hash SHA-256, código de validação) e vai direto pra tela de boas-vindas + pagamento (PIX/boleto/cartão via Asaas)
4. Matrícula criada/atualizada com `assinatura_nome`, `assinado_em`, `contrato_html` preenchidos
5. Admin acompanha/edita a matrícula em Matrículas Aulão

### Regras
- Alunos identificados por `origem = 'Lançamento'`
- Badge 🟠 Aulão no admin
- Termo já aceito digitalmente — não pedir novamente no admin
- Pagamento fora do fluxo Asaas (Pix manual, dinheiro, transferência) é registrado pelo admin via botão 💲 "Registrar pagamento" em Matrículas Aulão — é **somativo**: cada registro soma ao total já pago daquele aluno (histórico em `matriculas_aulao_pagamentos`), não substitui
- Disparo automático de boas-vindas via Z-API (`aulao-boas-vindas`) **pausado temporariamente** a pedido do Diego (22/07/2026) — cron job existe mas está com `active = false`

## Asaas

### Integração
- Ao dar baixa manual no sistema, confirmar recebimento no Asaas via API
- Endpoint: `POST /v3/payments/{asaas_id}/receiveInCash`
- Evita que o Asaas continue enviando emails de cobrança

## Milhas EJA (Gamificação)

### Pontos
- Assistir aula
- Completar matéria
- Login diário
- Outros triggers

### Níveis
4 níveis de membership com benefícios progressivos

### Resgate
Vitrine de cursos resgatáveis com pontos (mínimo 300 pontos)
