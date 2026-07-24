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
| created_at | timestamptz | Data de criação |

**Regra:** Colaboradores inativos não aparecem nos selects de vendedora ao criar matrícula, mas aparecem em filtros históricos com "(inativa)".

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
| ctr | integer | Código do aluno (gerado por sequence + trigger) |
| senha | text | Senha (1234 + primeiro nome) |
| polo_id | uuid FK→polos | Polo vinculado |
| ativo | boolean | Se está ativo |
| status | text | 'ativo' ou 'inativo' (sincronizado com `ativo`) |
| origem | origem_aluno | Canal de aquisição |
| foto_url | text | URL da foto |
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
| valor_pago_total | decimal(10,2) | Total pago (para pagamento parcial) |
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
| utm_source/medium/campaign/content | text | Parâmetros UTM |
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

