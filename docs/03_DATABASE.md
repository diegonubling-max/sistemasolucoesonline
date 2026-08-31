# 03 — DATABASE

## Supabase Project
- **Project ID:** qohvseedougwymxjhbgi
- **URL:** https://qohvseedougwymxjhbgi.supabase.co
- **Região:** East US (North Virginia) — us-east-1
- **Plano:** Free

## Enums

### payment_status
```sql
'aberto' | 'pago' | 'isento' | 'parcial' | 'cancelado'
```

### sexo_aluno
```sql
'Masculino' | 'Feminino'
```

### origem_aluno
```sql
'Google' | 'Meta' | 'Indicação' | 'Outros' | 'Lançamento'
```

## Sequences

| Sequence | Start | Uso |
|----------|-------|-----|
| alunos_ctr_seq | 1745 | CTR dos alunos regulares |
| ctr_externo_seq | 1 | CTR dos alunos externos (P001, P002...) |
| ctr_lancamento_seq | 501 | Reservado (não usado atualmente — aulão usa CTR normal) |
| parcelas_numero_seq | 5080 | Numeração sequencial das parcelas |

## Tabelas

---

### polos
**Objetivo:** Unidades/filiais da escola
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| nome | text | Nome do polo |
| ativo | boolean | Se está ativo |
| created_at | timestamptz | Data de criação |

**Polo Matriz:** Florianópolis — ID fixo: `32671c78-9076-4f88-8161-bfd5ee8e866b`

---

### segmentos
**Objetivo:** Categorias dos cursos vitrine
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| nome | text | Nome (Saúde, Tecnologia, Gestão, Beleza, Construção, Diversos) |
| created_at | timestamptz | Data de criação |

---

### colaboradores
**Objetivo:** Funcionários (vendedoras, administrativo, setor de provas)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| nome | text | Nome completo |
| email | text | Email |
| telefone | text | Telefone |
| setor | text | Vendedor, Administrativo, Setor de Provas |
| polo_id | uuid FK→polos | Polo vinculado |
| ativo | boolean | Se está ativo (false = bloqueia login) |
| senha | text | Senha de acesso |
| comissao_avista | decimal(10,2) | Valor comissão avista (default 120) |
| comissao_parcelado | decimal(10,2) | Valor comissão parcelado (default 50) |
| percentual_repasse | numeric(5,2) | % do fechamento semanal que fica com o colaborador (default 30 — ex: Felipe/Admin Polo, resto é da Matriz) — 05/08/2026 |
| created_at | timestamptz | Data de criação |

**Regra:** Colaboradores inativos não aparecem nos selects de vendedora ao criar matrícula, mas aparecem em filtros históricos com "(inativa)".

---

### fechamentos_semanais_pagamentos (12/08/2026)
**Objetivo:** Registra se o Fechamento Semanal (Financeiro → aba Fechamento Semanal) de um colaborador numa semana específica já foi pago, e quando.
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| colaborador_id | uuid FK→colaboradores | Colaborador do fechamento |
| semana_inicio | date | Sexta-feira de início do período (00:00) |
| semana_fim | date | Quinta-feira de fim do período |
| pago | boolean | Se já foi pago |
| data_pagamento | date | Data em que o pagamento foi feito |
| valor_total | numeric(10,2) | Total do fechamento no momento de marcar como pago |
| valor_matriz | numeric(10,2) | Parte da Matriz |
| valor_colaborador | numeric(10,2) | Parte do colaborador |
| observacao | text | Livre, não usado pela UI ainda |
| created_at / updated_at | timestamptz | — |

**Regra:** único registro por `(colaborador_id, semana_inicio, semana_fim)` — usa upsert.

---

### debug_logs (12/08/2026, BUG-046/047)
**Objetivo:** Tabela de apoio pra investigar erros de edge functions quando os logs nativos do Supabase estão indisponíveis (aconteceu mais de uma vez nesta sessão). Instrumentação temporária escreve aqui direto; não é uma tabela de auditoria permanente, mas ficou no banco pra reaproveitar em debugs futuros.
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| contexto | text | Identificador livre de onde veio o log (ex: `"asaas-cobrar:erro_final"`) |
| payload | jsonb | Dados livres do momento do erro |
| created_at | timestamptz | — |

---

### alunos
**Objetivo:** Alunos matriculados (regulares e de aulão)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| nome | text | Nome completo |
| email | text | Email |
| telefone | text | Telefone com DDD |
| cpf | text | CPF com máscara |
| data_nascimento | date | Data de nascimento |
| sexo | sexo_aluno | Masculino ou Feminino |
| ctr | integer | Código do aluno (gerado por sequence + trigger). **UNIQUE** desde 12/08/2026 (BUG-049) |
| senha | text | Senha (1234 + primeiro nome) |
| polo_id | uuid FK→polos | Polo vinculado |
| ativo | boolean | Se está ativo |
| status | text | 'ativo' ou 'inativo' (sincronizado com `ativo`) |
| origem | origem_aluno | Canal de aquisição |
| foto_url | text | URL da foto |
| asaas_customer_id | text | ID do customer no Asaas (cacheado no 1º boleto/PIX gerado; BUG-039) |
| created_at | timestamptz | Data de criação |

**Triggers:** `trg_ajustar_ctr` (pula CTRs terminados em 13), `trg_ao_inativar_aluno` (cancela parcelas e pós-vendas ao inativar)

**Regras:**
- Campos `ativo` e `status` devem ser atualizados JUNTOS
- Alunos de aulão: `origem = 'Lançamento'`, badge 🟠 Aulão
- Alunos inativos: badge 🔴 vermelho suave

---

### matriculas
**Objetivo:** Vínculo aluno-escola com dados do contrato
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| aluno_id | uuid FK→alunos | Aluno |
| polo_id | uuid FK→polos | Polo |
| colaborador_id | uuid FK→colaboradores | Vendedora (NULL se matrícula online) |
| status | text | 'incompleta', 'completa', etc |
| contrato_assinado | boolean | Se o contrato foi assinado |
| contrato_data | timestamptz | Data da assinatura |
| contrato_assinatura | text | Nome digitado na assinatura |
| utm_source | text | UTM source (rastreamento) |
| utm_medium | text | UTM medium |
| utm_campaign | text | UTM campaign |
| utm_content | text | UTM content |
| created_at | timestamptz | Data da matrícula |

---

### parcelas
**Objetivo:** Parcelas financeiras de cada matrícula
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| matricula_id | uuid FK→matriculas | Matrícula vinculada |
| numero | integer | Número sequencial (5001+) |
| descricao | text | "Taxa de Matrícula", "Parcela 1/10", etc |
| valor | decimal(10,2) | Valor da parcela |
| status | payment_status | aberto/pago/isento/parcial/cancelado |
| forma_pagamento | text | pix, boleto, cartao |
| tipo | text | 'parcela', 'matricula' |
| tipo_pacote | text | Nome do pacote |
| data_vencimento | date | Data de vencimento |
| data_pagamento | date | Data efetiva do pagamento |
| valor_pago_total | decimal(10,2) | Total pago (para pagamento parcial). **Atenção (BUG-061, 19/08/2026):** o formulário de "Dar Baixa" usa o nome `valor_pago` internamente — precisa mapear pra essa coluna manualmente, nunca espalhar o objeto do formulário direto no update |
| valor_liquido | decimal(10,2) | Valor líquido após taxa de cartão (quando aplicável) |
| asaas_id | text | ID da cobrança no Asaas |
| asaas_url | text | URL da cobrança no Asaas |
| asaas_barcode | text | Código de barras do boleto |
| asaas_pix_chave | text | Chave PIX |
| asaas_pix_qrcode | text | QR Code PIX |
| created_at | timestamptz | Data de criação |

**Triggers:** `trg_gerar_numero_parcela` (gera número sequencial), `trg_gerar_comissao_pagamento` (gera comissão ao pagar Parcela 1)

---

### parcelas_pagamentos
**Objetivo:** Pagamentos parciais de uma parcela
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| parcela_id | uuid FK→parcelas | Parcela |
| valor_pago | decimal(10,2) | Valor pago |
| forma_pagamento | text | Forma do pagamento parcial |
| data_pagamento | date | Data |
| observacao | text | Observação |
| created_at | timestamptz | Data de criação |

---

### comissoes
**Objetivo:** Comissões das vendedoras
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| aluno_id | uuid FK→alunos | Aluno da venda |
| matricula_id | uuid FK→matriculas | Matrícula |
| vendedora | text | Nome da vendedora |
| valor | decimal(10,2) | Valor da comissão |
| status | text | 'pendente', 'paga' |
| competencia | date | Data de competência (data_pagamento da parcela) |
| tipo_pagamento | text | 'avista' ou 'boleto' |
| created_at | timestamptz | Data de criação |

---

### cursos
**Objetivo:** Cursos EJA e Vitrine
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| nome | text | Nome do curso |
| descricao | text | Descrição |
| ativo | boolean | Se está ativo |
| thumbnail_url | text | Imagem do curso |
| segmento_id | uuid FK→segmentos | Segmento (para vitrine) |
| is_prova_final | boolean | Se é curso EJA (tem prova final) |
| material_pdf_url | text | Material de apoio |
| destaque_perfil | text | Perfil vocacional sugerido |
| created_at | timestamptz | Data de criação |

**Cursos EJA (is_prova_final = true):** Biologia, Filosofia, Física, Geografia, História, Inglês, Matemática, Português, Química, Sociologia

---

### aulas
**Objetivo:** Aulas em vídeo de cada curso
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| curso_id | uuid FK→cursos | Curso |
| titulo | text | Título da aula |
| descricao | text | Descrição |
| url_video | text | URL do player Panda Video |
| ordem | integer | Ordem dentro do curso |
| ativo | boolean | Se está ativa |
| thumbnail_url | text | Thumbnail |
| duracao_segundos | integer | Duração em segundos |
| created_at | timestamptz | Data de criação |

---

### aluno_aulas_assistidas
**Objetivo:** Progresso do aluno nas aulas
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| aluno_id | uuid FK→alunos | Aluno |
| aula_id | uuid FK→aulas | Aula |
| percentual_assistido | decimal(5,2) | Percentual assistido (0-100) |
| tempo_assistido | integer | Tempo em segundos |
| created_at | timestamptz | Data de criação |

**Constraint:** UNIQUE(aluno_id, aula_id)
**Regra:** Aula concluída quando percentual_assistido >= 70%

---

### pos_vendas
**Objetivo:** Follow-up pós-matrícula (D+1, D+5, D+15)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| matricula_id | uuid FK→matriculas | Matrícula |
| aluno_id | uuid FK→alunos | Aluno |
| etapa | integer | 1, 2 ou 3 |
| data_agendada | date | Data prevista |
| data_confirmacao | date | Data realizada |
| colaborador_id | uuid FK→colaboradores | Quem realizou |
| observacao | text | Observação |
| status | text | 'pendente', 'concluido', 'cancelado' |
| created_at | timestamptz | Data de criação |

**Constraint:** UNIQUE(matricula_id, etapa)
**Regra:** Ao concluir uma etapa, o sistema cria automaticamente a próxima

---

### prova_agendamentos
**Objetivo:** Agendamentos de prova final
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| aluno_id | uuid | Aluno (NULL para externos) |
| data_prova | date | Data da prova |
| hora_prova | time | Horário |
| status | text | agendada, iniciado, aprovado, reprovado |
| docs_solicitados | boolean | Documentos solicitados |
| docs_recebidos | boolean | Documentos recebidos |
| nome_aluno | text | Nome (para externos sem aluno_id) |
| telefone | text | Telefone |
| polo | text | Nome do polo |
| ctr | text | CTR do aluno |
| quem_agendou | text | Nome de quem agendou |
| situacao_financeira | text | 'ja_pago' ou 'boleto' |
| resultado | text | 'aprovado' ou 'reprovado' |
| observacao | text | Observação |
| is_externo | boolean | Se é aluno externo |
| materias_selecionadas | text[] | Array de matérias para a prova |
| ultimo_heartbeat | timestamptz | Último ping de presença |
| created_at | timestamptz | Data de criação |

**4 guias no admin:** Agendadas (inclui status 'iniciado'), Aprovados, Reprovados, Reagendar (data passada + resultado NULL)

---

### prova_questoes
**Objetivo:** Banco de questões das provas
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| materia | text | Nome da matéria |
| numero | integer | Número da questão |
| enunciado | text | Texto da questão |
| alternativa_a | text | Alternativa A |
| alternativa_b | text | Alternativa B |
| alternativa_c | text | Alternativa C |
| alternativa_d | text | Alternativa D |
| resposta_correta | text | A, B, C ou D (maiúsculo) |
| ativo | boolean | Se está ativa |
| created_at | timestamptz | Data de criação |

---

### prova_resultados
**Objetivo:** Resultados das provas por matéria
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| aluno_id | uuid (nullable) | Aluno (NULL para externos) |
| agendamento_id | uuid FK→prova_agendamentos | Agendamento |
| materia | text | Matéria |
| total_questoes | integer | Total de questões |
| total_acertos | integer | Total de acertos |
| percentual | decimal(5,1) | Percentual de acertos |
| aprovado | boolean | Se aprovado (>= 60%) |
| respostas | jsonb | {"questao_id": "resposta", ...} |
| iniciado_em | timestamptz | Quando iniciou a matéria |
| finalizado_em | timestamptz | Quando finalizou |
| created_at | timestamptz | Data de criação |

**Trigger:** `trg_prova_completa` — ao atualizar `finalizado_em`, verifica se todas as matérias selecionadas foram finalizadas e atualiza o agendamento automaticamente

---

### alunos_externos
**Objetivo:** Alunos que fazem apenas a prova (sem matrícula completa)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| ctr | text UNIQUE | CTR série P (P001, P002...) |
| nome | text | Nome completo |
| telefone | text | Telefone |
| cpf | text | CPF |
| polo_id | uuid FK→polos | Polo |
| senha | text | Senha de acesso |
| quem_cadastrou | text | Quem cadastrou |
| created_at | timestamptz | Data de criação |

---

### certificadoras
**Objetivo:** Instituições que emitem certificados
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| nome | text | CECO, Educa Nexus, Ifope, Nobel, Referencial, Santa Rita |
| ativo | boolean | Se está ativa |
| created_at | timestamptz | Data de criação |

---

### documentacao_alunos
**Objetivo:** Controle de documentação e certificação do aluno
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| aluno_id | uuid FK→alunos | Aluno |
| matricula_id | uuid FK→matriculas | Matrícula |
| rg_cpf | boolean | RG/CPF recebido |
| comp_residencia | boolean | Comprovante de residência |
| hist_fundamental | boolean | Histórico do fundamental |
| hist_fund_medio | boolean | Histórico fund + médio |
| outros | boolean | Outros documentos |
| doc_completa | boolean | Documentação completa |
| rec_firma | boolean | Reconhecimento de firma |
| diario_oficial | boolean | D.O. |
| visto_confere | boolean | Visto confere |
| certificadora_id | uuid FK→certificadoras | Certificadora |
| data_envio | date | Data de envio para certificadora |
| lote | text | Número do lote |
| cert_digital | boolean | Certificado digital emitido |
| cert_fisico | boolean | Certificado físico recebido |
| cert_digital_data | date | Data emissão digital |
| cert_fisico_data | date | Data recebimento físico |
| observacao | text | Observação |
| created_at | timestamptz | Data de criação |

---

### zapi_mensagens_log
**Objetivo:** Log de mensagens WhatsApp enviadas
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| aluno_id | uuid | Aluno |
| tipo | text | Tipo da mensagem |
| mensagem | text | Conteúdo |
| telefone | text | Telefone destino |
| status | text | Status do envio |
| erro_detalhe | text | 19/08/2026, BUG-060. Detalhe do erro quando `status='erro'` — coluna adicionada depois de descobrir que o código já tentava gravar ela sem ela existir, o que fazia todo log falhar em silêncio |
| created_at | timestamptz | Data de envio |

---

### zapi_mensagens_fds
**Objetivo:** Templates de mensagens de fim de semana (6 ciclos)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| ciclo | integer | 1 a 6 |
| dia_semana | text | 'sabado' ou 'domingo' |
| tipo | text | 'assistiu' ou 'nao_assistiu' |
| mensagem | text | Template com {nome} |
| ativo | boolean | Se está ativo |
| created_at | timestamptz | Data de criação |

---

### pacotes
**Objetivo:** Pacotes de matrícula disponíveis
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| nome | text | Nome do pacote |
| tipo | text | pix, boleto, cartao |
| valor_parcela | decimal(10,2) | Valor de cada parcela |
| total_parcelas | integer | Número de parcelas |
| valor_total | decimal(10,2) | Valor total |
| taxa_matricula | decimal(10,2) | Taxa de matrícula (default 69.90) |
| ativo | boolean | Se está disponível |
| created_at | timestamptz | Data de criação |

---

### banners
**Objetivo:** Banners da área do aluno por polo
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| polo_id | uuid FK→polos | Polo |
| titulo | text | Título |
| imagem_url | text | URL da imagem (1080x500px) |
| ativo | boolean | Se está ativo |
| ordem | integer | Ordem de exibição |
| created_at | timestamptz | Data de criação |

---

### contratos
**Objetivo:** Modelos de contrato
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | Identificador |
| nome | text | Nome do modelo |
| conteudo | text | Texto completo do contrato |
| ativo | boolean | Se está ativo |
| created_at | timestamptz | Data de criação |

---

## Views

### view_recebimentos_periodo
Combina parcelas pagas (pagamento total) com parcelas_pagamentos (pagamento parcial) em uma única view para o relatório de recebimentos.

## Buckets (Storage)
- **documentos-alunos** (Private) — Documentos de matrícula dos alunos

## RLS
**Desativado** em todas as tabelas. Grants concedidos para `anon` e `authenticated` em todas as tabelas e sequences.

---

## Tabela: matriculas_aulao (NOVA — Aulão / Lançamento)

Armazena matrículas feitas pelo link público `/matricula` (sem criação de login/senha).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | ID da matrícula |
| nome | text NOT NULL | Nome completo |
| email | text (nullable) | E-mail (não coletado atualmente) |
| telefone | text NOT NULL | Telefone com DDD |
| cpf | text NOT NULL | CPF formatado |
| data_nascimento | date | Data de nascimento |
| sexo | text | Sexo (não coletado atualmente) |
| forma_pagamento | text NOT NULL | 'boleto' ou 'cartao' |
| contrato_html | text | HTML do contrato com bloco de validação digital |
| assinatura_nome | text | Nome digitado na assinatura |
| assinado_em | timestamptz | Data/hora da assinatura |
| status | text DEFAULT 'matriculado' | 'matriculado', 'editado', 'cancelado' |
| polo_id | uuid | FK para polos |
| asaas_customer_id | text | ID do cliente no Asaas |
| asaas_payment_id | text | ID da cobrança no Asaas |
| pagamento_status | text DEFAULT 'pendente' | 'pendente', 'confirmado', 'falhou' |
| pagamento_valor | numeric(10,2) | Valor efetivamente cobrado |
| pagamento_pix_qrcode | text | QR code PIX base64 |
| pagamento_pix_copiacola | text | Código PIX copia-e-cola |
| pagamento_forma_manual | text (nova 22/07/2026) | Forma do último pagamento manual registrado (Pix/Dinheiro/Transferência/Outro), ou "Múltiplas formas" se houver mais de uma |
| pagamento_confirmado_em | timestamptz (nova 22/07/2026) | Data/hora do último pagamento manual registrado |
| boas_vindas_agendado_para | timestamptz | Quando disparar boas-vindas Z-API |
| boas_vindas_enviado_em | timestamptz | Quando foi enviado |
| observacoes | text | Anotações internas |
| utm_source/medium/campaign/content | text | Parâmetros UTM (bug corrigido em 26/07/2026 — antes sempre ficava null) |
| previsao_pagamento | date (nova 28/07/2026) | Data combinada com o aluno pra pagar (taxa ou cartão), quando ele pede mais tempo — editável direto na lista de Matrículas Aulão |
| fbclid | text (nova 26/07/2026) | Click ID do Meta Ads, capturado da URL — pra casar a conversão com o clique do anúncio via Conversions API no futuro |
| created_at | timestamptz | Criação |
| updated_at | timestamptz | Última atualização (trigger automático) |

**Índices:** cpf, telefone, boas_vindas pendentes
**RLS:** Desabilitado

**Nota (22/07/2026):** `pagamento_valor` é sempre a SOMA de todos os lançamentos em `matriculas_aulao_pagamentos` daquela matrícula, recalculada a cada novo pagamento registrado pelo admin.

## Tabela: matriculas_aulao_pagamentos (NOVA — 22/07/2026)

Histórico de pagamentos de uma matrícula do Aulão. Permite registrar múltiplos pagamentos (ex: taxa inicial via Asaas + parcela paga depois via Pix manual) sem perder o histórico.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | ID do lançamento |
| matricula_id | uuid FK → matriculas_aulao(id) ON DELETE CASCADE | Matrícula relacionada |
| forma | text NOT NULL | Forma do pagamento (Pix, Dinheiro, Transferência, Outro, ou "Pix/Cartão (Asaas)" pros pagamentos automáticos já existentes) |
| valor | numeric NOT NULL | Valor deste lançamento |
| criado_em | timestamptz DEFAULT now() | Quando foi registrado |

**Índice:** matricula_id
**RLS:** Desabilitado

## Tabela: pacotes — valores corrigidos (27-28/07/2026)

**Convenção de nome "1+N":** significa **N+1 parcelas iguais** (ex: "1+9" = 10 parcelas de mesmo valor), não "taxa + N". A taxa de matrícula (sempre R$69,90) é cobrada **à parte**, somada por cima do valor das parcelas — não faz parte da contagem "1+N".

**Cartão x Boleto na geração de parcelas:** boleto (e negociação personalizada) geram uma linha de `parcelas` por parcela (N linhas), porque cada boleto é um documento separado que o sistema precisa controlar. **Cartão gera uma única linha** com o valor total das parcelas somadas — quem divide em N vezes pro cliente é a operadora do cartão, não o sistema. A taxa de matrícula continua sendo uma linha separada em qualquer caso.


Todos tinham `valor_matricula=0` e `numero_parcelas=1` (dado perdido no reset) — corrigidos:

| Nome | Tipo | Taxa matrícula | Valor parcela | Nº parcelas | Valor total |
|------|------|----------------|---------------|-------------|-------------|
| Boleto (1+6 de R$199,90) | boleto | R$69,90 | R$199,90 | 7 | R$1.469,20 |
| Boleto (1+9 de R$159,90) | boleto | R$69,90 | R$159,90 | 10 | R$1.668,90 |
| Cartão (12x de R$99,90) | cartao | R$69,90 | R$99,90 | 12 | R$1.268,70 |
| Cartão Acelerado (12x R$119,90) | cartao | R$69,90 | R$119,90 | 12 | R$1.508,70 |
| Avista | pix | R$69,90 | R$997,00 | 1 | R$1.066,90 |
| Avista Acelerado | pix | R$69,90 | R$1.199,00 | 1 | R$1.268,90 |

## Colunas Restauradas — Padrão Recorrente (reset do Supabase)

Várias colunas que o código já esperava sumiram na reconstrução do banco (Lovable/Supabase). Lista acumulada até agora (ver BUGs 017, 018 [dashboard], 019, 020 em 14_BUGS_CONHECIDOS.md):

| Tabela | Coluna | Restaurada em |
|--------|--------|----------------|
| alunos | foto_url (era foto_perfil no código antigo) | BUG-017 |
| alunos | data_liberacao_prova | BUG-019 |
| alunos | materias_prova | BUG-019 |
| polos | whatsapp | BUG-019 |
| aluno_sessoes | login_em, logout_em, duracao_minutos | BUG-020 (23/07/2026) |
| aluno_aulas_assistidas | assistida_em | BUG-020 (23/07/2026) |
| alunos | cadastrado_por, cadastrado_por_id, menor_de_idade, responsavel_email | BUG-022 (26/07/2026) |
| alunos | dias_prova_final | BUG-023 (26/07/2026) |
| alunos | observacao, origem_detalhe, responsavel_nome, responsavel_telefone, responsavel_cpf | BUG-024 (26/07/2026) |
| matriculas | observacao | BUG-025 (26/07/2026) |
| parcelas | polo_id | BUG-025 (26/07/2026) |
| — (tabela inteira) | matricula_pacotes | BUG-025 (26/07/2026) — não era coluna, era a tabela toda |
| alunos | asaas_customer_id | BUG-039 (05/08/2026) |

## Contrato — Assinatura Remota Removida (26/07/2026)

O recurso antigo de assinatura remota por link único (`/contrato/:token`, com validação de identidade nome+telefone+CPF) **não existe mais no banco** — nem as colunas (`contratos.matricula_id`, `conteudo_html`, `token_unico`) nem as RPCs (`get_contrato_publico` e afins) sobreviveram ao reset. A rota pública `/contrato/$token.tsx` continua no código, mas não tem mais suporte no banco.

A pedido do Diego, o fluxo "Novo Aluno" (`MatriculaFlow.tsx`) foi simplificado: o contrato agora é **assinado na hora**, dentro do próprio cadastro — mesmo estilo do `/matricula` (sem link remoto, sem token). O insert usa o schema real e atual de `contratos`: `nome`, `conteudo`, `aluno_id`, `status='assinado'`, `ativo=true`.

**Pendente:** `ContratoAlunoModal.tsx` (usado em outros lugares do admin pra ver/gerar contrato, com botão de compartilhar por WhatsApp) ainda depende do esquema antigo — precisa da mesma decisão de simplificação.

**Lição:** sempre que uma tela ou funcionalidade parecer "quebrada do nada" sem erro visível pro usuário, o primeiro suspeito é uma coluna que o código espera mas o banco reconstruído não tem — o Supabase rejeita a query inteira nesses casos (sem mensagem clara pro usuário final).

## Prova Final — Estrutura Restaurada (23/07/2026)

Colunas recriadas após terem sumido no reset do Lovable/Supabase (ver BUG-019):

| Coluna | Tabela | Tipo | Descrição |
|--------|--------|------|-----------|
| data_liberacao_prova | alunos | timestamptz | Data em que a prova libera pro aluno (padrão: 1ª matrícula + 60 dias; antecipada se a Mônica agendar antes) |
| materias_prova | alunos | text[] | Matérias personalizadas do aluno (se vazio, usa a lista padrão de 10 matérias EJA) |
| whatsapp | polos | text | WhatsApp do setor de provas daquele polo (fallback: 5551990010689) |

### Curso "Prova Final" (pseudo-curso)
Criado um registro em `cursos` com `is_prova_final = true`, vinculado ao segmento EJA. Não é uma matéria de verdade — é o "cartão" que aparece no final da lista de matérias do aluno (thumbnail + contagem regressiva). Vinculado via `matricula_cursos` a todas as matrículas EJA ativas.

### Triggers criados
- `trg_definir_liberacao_prova` (em `matriculas`, AFTER INSERT) — define `data_liberacao_prova` automaticamente (matrícula + 60 dias) se o aluno ainda não tiver
- `trg_antecipar_liberacao_prova` (em `prova_agendamentos`, AFTER INSERT/UPDATE) — se a Mônica agendar a prova antes do prazo de 60 dias, antecipa `data_liberacao_prova` pra data agendada
- `trg_vincular_prova_final` (em `matriculas`, AFTER INSERT) — vincula automaticamente o curso "Prova Final" a toda matrícula nova

### Correção aplicada (23/07/2026)
Diego ajustou a data-base dos 24 alunos migrados pra 01/07/2026 (em vez da data de reconstrução do banco, 17/07/2026) + 60 dias — todos liberam em 30/08/2026.

## Tabelas: Sistema de Webinar (NOVAS — 23/07/2026, expandido bastante entre 26-31/08/2026)

Sistema de aula ao vivo com chat e monitoramento de presença. Vídeo incorporado via link do **YouTube** (ao vivo ou não listado) **ou Panda Video** (`youtube_url` guarda a URL de qualquer um dos dois — o sistema detecta o provedor pela URL, `pandavideo.com.br` = Panda).

### webinars
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| titulo | text | Nome da aula ao vivo |
| youtube_url | text | Link de embed — YouTube **ou** Panda Video (campo genérico, nome histórico) |
| status | text | `agendado` / `ao_vivo` / `encerrado` |
| iniciado_em / encerrado_em | timestamptz | Preenchidos ao trocar o status. `iniciado_em` é o marco-zero usado por TUDO que depende de tempo: portaria/tolerância, salto de entrada, contador simulado |
| gravado | boolean | Aula gravada (replay) — habilita depoimentos sincronizados, salto de entrada, contador simulado e troca o player pra API programável (YouTube IFrame API ou PandaPlayer) |
| modo_acesso | text | 19/08/2026. `'youtube'` (padrão) ou `'interno'` — destino do aluno depois de preencher nome/telefone: direto pro app do YouTube, ou pro player interno do sistema |

### webinar_participantes
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| webinar_id | uuid FK | |
| nome, telefone | text | Preenchidos pelo aluno na entrada (sem login/senha) |
| entrou_em | timestamptz | Hora da 1ª entrada (histórico completo de reentradas fica em `webinar_sessoes`, ver abaixo) |
| saiu_em | timestamptz | Hora da saída mais recente (null = online agora) |
| saida_automatica | boolean | true se detectado por timeout, não por fechamento explícito da aba |
| ultimo_heartbeat | timestamptz | Atualizado periodicamente pelo navegador do aluno enquanto a aba está aberta |
| acesso_liberado | boolean (default true) | Portaria de tolerância (20 min, `TOLERANCIA_MINUTOS`) — false quando a pessoa tentou entrar pela 1ª vez depois desse prazo e foi bloqueada. Quem já teve `acesso_liberado=true` reentra a qualquer momento sem checar o horário de novo |
- **RLS (BUG-069, 29/08/2026):** a tabela só tinha policy de `INSERT`/`SELECT` pra `anon` — faltava `UPDATE`, então reentradas e heartbeats do aluno falhavam **silenciosamente** (RLS bloqueava sem erro visível). Policy `anon_update` (`using true`, `with check true`) adicionada.

### webinar_sessoes (NOVA — 29/08/2026, BUG-069)
Histórico **completo** de entradas/saídas por participante — não só a primeira/última (que ficam em `webinar_participantes`, mantidas por compatibilidade). Toda entrada (1ª vez ou reentrada) grava uma linha nova aqui; a saída fecha a sessão em aberto mais recente.
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| participante_id | uuid FK webinar_participantes (on delete cascade) | |
| entrou_em | timestamptz NOT NULL DEFAULT now() | |
| saiu_em | timestamptz | null = sessão em aberto (ainda online) |
- Admin: botão "Histórico" na tabela de participantes (`/webinars/:id`) abre modal listando todas as sessões daquele aluno.

### webinar_comentarios
Chat ao vivo — `webinar_id`, `participante_id`, `nome`, `texto`, `created_at`. Distribuído em tempo real via Supabase Realtime (Postgres Changes).
- **is_admin** (boolean DEFAULT false, 28/08/2026) — true quando a mensagem é uma resposta da equipe (via painel admin), não um comentário de aluno. Renderizada no feed do aluno com selo verde "✅ Escola Soluções Online" (não conta pra cor laranja/azul de comentário próprio/alheio).
- **resposta_a** (uuid FK webinar_comentarios, 28/08/2026) — quando `is_admin=true`, aponta pro comentário original que está sendo respondido. Usado pra mostrar uma citação (estilo reply do WhatsApp) acima da resposta, tanto pro aluno quanto no painel admin.
- **Cor no chat do aluno:** própria mensagem = laranja; mensagens de outros alunos reais = azul; depoimentos roteirizados (replay) com `nome = 'Escola Soluções Online'` = laranja também (destaque, mesmo sendo replay); resposta real do admin (`is_admin`) = verde com selo ✅.

### webinar_snapshots
Uma linha por minuto por webinar ao vivo, gravada enquanto o painel admin está aberto — `webinar_id`, `registrado_em`, `quantidade_online`. Alimenta o gráfico de quedas no painel admin (só pra webinars **realmente ao vivo**, não gravados — nesses o contador é simulado, ver abaixo).

### webinar_depoimentos_replay
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| webinar_id | uuid FK webinars | |
| nome | text NOT NULL | Nome de quem comentou na aula ao vivo original |
| texto | text NOT NULL | Depoimento real |
| timestamp_segundos | integer NOT NULL | Segundo exato do **vídeo** (não do relógio) em que reaparece pro aluno |
| created_at | timestamptz | |
Importados via planilha (nome, comentário, tempo) que Diego manda — Claude aplica um deslocamento (offset) pra ajustar o tempo do 1º comentário conforme pedido, mantendo a distância entre todos os outros.

### Trigger/Cron — atualizado 23/07/2026
~~`processar_webinar_presenca()` (cron a cada minuto)~~ — **removido**. A detecção de entrada/saída usa **Presence** do Supabase Realtime (websocket). O painel admin (`/webinars/:id`) escuta esse canal: ao receber evento de saída, fecha `webinar_participantes.saiu_em` E a sessão em aberto mais recente em `webinar_sessoes`; a cada 1 minuto (painel aberto + aula ao vivo de verdade), grava snapshot.
- **Limitação aceita:** gravação de saída e snapshots dependem do painel admin estar aberto durante a aula.

## Simulação de "aula ao vivo" em vídeo gravado (webinars.gravado = true)

Conjunto de recursos, todos baseados no MESMO relógio (`videoTime`, lido do player a cada 1s + segundos passados desde `webinars.iniciado_em`), implementados entre 26-31/08/2026 em `webinar.$id.tsx`:

- **Entrar já no minuto certo:** ao carregar, calcula `(agora - iniciado_em)` e pula o vídeo pra esse ponto (`seekTo`/`setCurrentTime`), em vez de sempre começar do zero. Reforçado em 4 tentativas (0s/1s/2,5s/4,5s) porque o player pode ainda estar em buffer no primeiro instante.
- **Vídeo nunca pode ficar pausado:** depois de cada salto, chama `playVideo()`/`play()` explicitamente (BUG-064) + reforço contínuo via `onStateChange`/poll de `isPaused()`.
- **Contador de espectadores simulado:** função `getEspectadoresSimulados(videoTime, duracaoVideo)` — curva roteirizada (não é gente real): 0 até 0:01, sobe devagar até 2:20, sobe rápido até 3:40, oscila entre 67-73 (soma de 2 ondas senoidais, pra não repetir padrão) até faltarem 3 min pro fim, cai gradualmente até ~32 no fim exato. Pontos de corte e faixa são ajustáveis por pedido do Diego (já foram reconfigurados mais de uma vez).
- **Tarja + botão de matrícula (estilo VSL):** a partir de `CTA_TEMPO_SEGUNDOS` (constante, hoje 49:22), aparece uma tarja amarela deslizante (CSS `@keyframes`) com o cupom `1627OFF`, e um botão verde "Quero realizar minha matrícula agora" abrindo `/matricula` em nova aba.
- **Navegador embutido (WhatsApp/Instagram) quebra tudo isso (BUG-065):** detecção via UA + saída automática (Android) ou tela de instrução (iOS).
- **Sincronização ao voltar de segundo plano (BUG-068/071):** listener de `visibilitychange` força leitura imediata do tempo; no Panda especificamente, o relógio nem sempre iniciava sozinho via `onReady` (BUG-071) — reforçado com tentativas extras aos 2s/5s independente do evento.
- **Tela cheia própria:** botão "Maximizar" não usa a Fullscreen API do navegador (não funciona bem no Safari iOS) — usa `position:fixed` cobrindo a tela inteira (CSS próprio), com botão X pra sair; tenta `screen.orientation.lock('landscape')` como bônus (best-effort).
- **Botão "Ativar áudio":** `position:fixed` no canto superior esquerdo (`top-20 left-4`), pulsando — não fica preso nem dentro do vídeo nem embaixo dele (BUG-067, 3 tentativas até essa versão final).
- **Panda Video (30/08/2026):** detecção automática pela URL; API oficial `https://docs.pandavideo.com/reference/player-api`. Conecta a um `<iframe>` já renderizado por nós (não deixa o `PandaPlayer` criar o elemento do zero — isso quebrava o tamanho, BUG-070). `library_id`/`video_id` extraídos da URL quando necessário; métodos equivalentes ao YouTube (`setCurrentTime` no lugar de `seekTo`, `play()` no lugar de `playVideo()`, volume 0-1 no lugar de 0-100).
- **Meta tags Open Graph próprias** (`og:image`, 31/08/2026) — link do webinar mostra uma imagem própria ("Estamos ao vivo! Participe agora!", `public/webinar-ao-vivo.png`) ao ser compartilhado no WhatsApp, em vez do card genérico do sistema. Cuidado: WhatsApp cacheia preview de link já compartilhado antes — só reflete em links novos.



## Tabela: modelos_contrato (recriada)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| nome | text NOT NULL | Nome do modelo (ex: "Contrato Aulao Padrao") |
| conteudo_html | text NOT NULL | HTML com variáveis [BRACKET] |
| ativo | boolean DEFAULT true | Se está ativo |
| created_at | timestamptz | |

## Colunas adicionadas em polos:
- asaas_api_key (text) — Chave API do Asaas
- asaas_ambiente (text DEFAULT 'sandbox') — 'sandbox' ou 'producao'
- nome_escola, logo_url, whatsapp_suporte, asaas_webhook_token (text)


## Colunas adicionadas em aluno_aulas_assistidas (pós-reset):
- curso_id (uuid) — FK para cursos, preenchido a partir de aulas.curso_id
- duracao_total (integer DEFAULT 0) — duração total do vídeo
- ultima_posicao (numeric DEFAULT 0) — posição do player ao pausar

## Colunas adicionadas em pacotes (pós-reset):
- descricao (text)
- valor_matricula (numeric DEFAULT 0)
- numero_parcelas (integer DEFAULT 1)

## Tabela: banners_polo (recriada)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| polo_id | uuid FK polos | |
| titulo | text | Título do banner |
| imagem_url | text NOT NULL | URL da imagem |
| link_url | text | Link ao clicar |
| ordem | integer DEFAULT 0 | Ordem de exibição |
| ativo | boolean DEFAULT true | |
| created_at | timestamptz | |

## Storage Buckets:
- thumbnails (público) — usado para banners dos polos e thumbnails
- thumbnails-aulas (público) — thumbnails das aulas
- thumbnails-cursos (público) — thumbnails dos cursos


## Alterações de banco — sessão 04-05/08/2026

### Colunas adicionadas em matriculas_aulao:
- utm_term (text) — capturado via cookie solucoes_utm (fallback) ou URL
- voucher_code (text) — código digitado no /matricula
- voucher_aplicado (boolean DEFAULT false) — só true se o código bater com o voucher válido do momento (cartão 12x R$119,90 em vez de 12x R$259,90)

### Colunas adicionadas em cursos:
- youtube_playlist_id (text) — ID da playlist do YouTube (migração Panda→YouTube)
- youtube_playlist_count (integer) — quantidade de vídeos já migrados; aulas com ordem <= esse valor tocam pela playlist (index = ordem-1), o resto continua no link antigo (Panda)

### Colunas adicionadas em parcelas:
- valor_liquido (numeric) — valor líquido recebido no cartão (descontada a taxa da maquininha/Asaas); usado pelo Dashboard (view_total_recebido_mes)

### Colunas adicionadas em contratos (assinatura por link público):
- token_unico (uuid UNIQUE, DEFAULT gen_random_uuid()) — usado na URL /contrato/:token
- conteudo_html (text) — conteúdo do contrato pro fluxo de assinatura remota (separado da coluna `conteudo`, usada pelo fluxo automático do Aulão)
- matricula_id (uuid FK matriculas)
- nome_confirmacao (text) — nome digitado pelo aluno ao assinar
- data_assinatura (timestamptz)
- ip_assinatura (text)

(`webinar_depoimentos_replay` e a coluna `gravado` de `webinars` — ver seção completa "Tabelas: Sistema de Webinar", mais acima neste arquivo)

### Views novas (Dashboard — faturamento do polo):
- view_total_recebido_mes — soma parcelas pagas no mês corrente, **excluindo taxa de matrícula** (`tipo <> 'taxa_matricula'`; usa valor_liquido se cartão, senão valor) — é o valor usado no fechamento com o responsável do polo
- view_a_receber_mes — soma parcelas em aberto/parcial vencendo no mês corrente
- view_em_atraso — soma parcelas em aberto/parcial já vencidas
- Todas as 3 usam `(now() AT TIME ZONE 'America/Sao_Paulo')::date` como "hoje" (não CURRENT_DATE puro, que é UTC e adianta o dia à noite no horário de Brasília)

### View nova (05/08/2026 — separação taxa x parcela, BUG-041):
- view_taxas_recebidas_mes — soma só as taxas de matrícula pagas no mês (`tipo = 'taxa_matricula'`), mesmo cálculo de valor_liquido/valor das outras. Card separado no Dashboard e no Financeiro ("Taxas de Matrícula no Mês" — reinvestimento em tráfego), pra não misturar com o "Recebido de Parcelas no Mês" que o Diego usa no fechamento com o responsável de polo

### View nova (05/08/2026 — BUG-040):
- view_recebimentos_periodo — join parcelas_pagamentos → parcelas → matriculas → alunos, alimenta a aba "Recebimentos" do Financeiro (por período/vendedora); nunca existia no banco antes

### RPCs criadas nesta sessão (existiam só no código, nunca no banco):
- registrar_pagamento_parcela(p_parcela_id, p_valor_pago, p_data_pagamento, p_forma_pagamento, p_parcelas_cartao, p_taxa_cartao, p_valor_liquido, p_observacao) — "Dar Baixa"
- get_contrato_publico(p_token) / assinar_contrato_publico(p_token, p_nome, p_ip) — assinatura remota de contrato
- proximo_ctr_aluno() — 12/08/2026, BUG-049. Fonte única de CTR novo (puxa de `alunos_ctr_seq`, pulando terminados em 13) — usada tanto pelo trigger do cadastro manual quanto por `converter-matricula-aulao.ts`, pra nunca mais ficarem fora de sincronia
- is_admin() / is_admin_or_staff() — 18/08/2026, BUG-057 (falha de segurança crítica). `SECURITY DEFINER`, usadas dentro das policies de RLS de `alunos`, `matriculas`, `parcelas`, `matriculas_aulao`, `user_roles` e `colaboradores`, pra checar se quem está logado é admin/colaborador sem cair em recursão infinita (uma policy de `user_roles` não pode consultar `user_roles` diretamente dentro de si mesma — por isso a função)
- Ainda pendentes de verificar/criar (chamadas no código, não confirmadas no banco): add_milhas_eja, delete_pacote, resgatar_curso_vitrine. registrar_aula_assistida é legado (comentado como tal no código) e pode ser removida em vez de criada — o tracking real de progresso já funciona via aluno_aulas_assistidas (use-video-progress.ts)

### Triggers criados (automação de Pós-Venda):
- criar_pos_venda_nova_matricula (AFTER INSERT em matriculas) — semeia o 1º Pós-Venda, agendado 1 dia após a matrícula
- criar_proximo_pos_venda (AFTER UPDATE em pos_vendas) — quando uma etapa é marcada 'concluido', semeia a próxima: 2º = 5 dias após a confirmação do 1º; 3º = 10 dias após a confirmação do 2º

### Limpeza de dados (colaboradores/alunos):
- alunos: mantida só Marcia Antoneli (CTR 1714); demais alunos antigos (pré-migração, sem financeiro, movidos pra plataforma antiga do Diego) excluídos via delete_aluno_completo
- colaboradores: mantidos só Diego (dono) e Gislaine da Silva Borba; demais excluídos (matrículas que apontavam pra eles foram desvinculadas antes — colaborador_id=NULL, matrícula em si intacta)
- user_roles: Felipe Borba e Gislaine da Silva Borba receberam role='admin' (acesso total, igual ao Diego — sem isso, "Responsável" sozinho não libera itens adminOnly do menu como Cursos/Colaboradores/Webinars)

### Edge Functions publicadas (existiam só no código-fonte — ver BUG-030):
manage-colaboradores, asaas-api, manage-student-access, asaas-cobrar, asaas-vitrine-checkout, asaas-vitrine-status, asaas-webhook, asaas-vitrine-webhook, cancelar-boletos-migrados, gerar-boletos-migrados, panda-video-sync, send-push-notification

### Segurança / RLS — estado atual (18/08/2026, pós BUG-057)
**Regra geral:** staff (admin via `user_roles.role='admin'`, ou qualquer `colaboradores`) tem acesso total; aluno (usuário `authenticated` comum) só enxerga/edita os **próprios** registros. Nunca usar `qual: true` liberando geral pra `authenticated` numa tabela que tem dado de aluno — foi exatamente isso que causou o BUG-057.
- `alunos`: staff = ALL; aluno = ALL no próprio registro (`email = auth.email()`)
- `matriculas`: staff = ALL; aluno = SELECT nas próprias (via `aluno_id` → `alunos.email = auth.email()`)
- `parcelas`: staff = ALL; aluno = SELECT nas próprias (via `matricula_id` → `matriculas` → `alunos.email = auth.email()`)
- `matriculas_aulao`: staff = ALL; **sem policy pra aluno** (dado de lead/venda, aluno não precisa acessar) — mantém `anon_select`/`anon_update` só pro fluxo público `/matricula`
- `user_roles`: só admin (`is_admin()`) tem ALL; qualquer usuário só faz SELECT da própria linha (`user_id = auth.uid()`) — **ninguém além de admin escreve nessa tabela via API**, mesmo o próprio dono da linha
- `colaboradores`: SELECT = próprio registro ou admin; sem policy de escrita pra `authenticated` (gestão de colaborador passa por edge function com service role)
