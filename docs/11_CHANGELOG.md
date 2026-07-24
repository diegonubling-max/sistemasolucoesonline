# 11 — CHANGELOG

## Sistema Completo 07 (08/07/2026 — 16/07/2026)

### 08/07/2026 — Sistema de Alunos Externos (P001)
- Criada tabela `alunos_externos` com CTR série P
- Criada sequência `ctr_externo_seq`
- RPCs: `criar_aluno_externo_com_prova`, `login_aluno_externo`, `externo_tem_acesso_hoje`, `gerar_ctr_externo_existente`
- Login detecta prefixo "P" e redireciona para tela simplificada de prova
- Botão "Agendar Externo" no menu Provas Agendadas com seleção de matérias
- Botão "Gerar CTR" para externos antigos sem CTR
- Tela simplificada para externo (só prova, sem menu)

### 08/07/2026 — Sistema de Prova com Salvamento em Tempo Real
- RPC `salvar_resposta_prova` — salva cada resposta no jsonb em tempo real
- RPC `finalizar_materia_prova` — calcula nota com UPPER() na comparação
- Trigger `trg_prova_completa` — atualiza agendamento quando todas as matérias selecionadas são finalizadas
- Coluna `materias_selecionadas` (text[]) adicionada em `prova_agendamentos`
- FK `prova_resultados_aluno_id_fkey` removida, `aluno_id` tornado nullable
- Retomada após queda: busca respostas salvas no jsonb

### 08/07/2026 — Heartbeat de Presença
- Coluna `ultimo_heartbeat` adicionada em `prova_agendamentos`
- Frontend envia ping a cada 60 segundos durante a prova
- Badge 🟢 "Em Prova" se heartbeat < 2 minutos
- Badge 🟡 "Iniciou" se status = iniciado sem heartbeat recente

### 08/07/2026 — Correções Financeiras
- Trigger `gerar_comissao_pagamento` corrigido: `comissao_boleto` → `comissao_parcelado`
- Marilda (CTR 1733) parcela atualizada para status pago
- Trigger comissão corrigido: mais de 1 parcela = comissão parcelado (não avista)

### 08/07/2026 — Migração Pós-Vendas
- Gislaine (1706): etapa 1 e 2 concluídas, etapa 3 pendente
- Luana (1722): etapa 1 e 2 concluídas, etapa 3 pendente
- Thais (1728): etapa 1 concluída, etapa 2 pendente
- Loreni (1732): etapa 1 concluída, etapa 2 pendente
- João (1711): etapa 1 e 2 concluídas, etapa 3 pendente
- Lucas (1724): etapa 1 e 2 concluídas, etapa 3 pendente
- Marcos Leandro (1731): etapa 1 concluída, etapa 2 pendente
- Rosileide (1730): etapa 1 concluída, etapa 2 pendente
- Márcia (1714): etapa 1 e 2 concluídas, etapa 3 pendente

### 08/07/2026 — WhatsApp e Disparos
- Disparo automático de WhatsApp ao agendar prova para externo
- Lembrete 30min antes da prova incluindo externos (com CTR + senha)
- WhatsApp vitrine: botão com preview + confirmação via Z-API
- Filtro cobrança: exclui status isento, cancelado, valor <= 0
- Disparos FDS: excluem alunos aprovados/reprovados/inativos

### 08/07/2026 — Interface
- Badge 🔷 Externo (azul escuro) nas guias de provas
- Guia "Agendadas" inclui status 'iniciado'
- Removido "PROVA HOJE" vermelho
- Coluna "Notas" removida das guias de provas
- Guia Reagendar ordenada DESC

### 09/07/2026 — Bug Crítico: Notas Zeradas
- Bug: comparação case-sensitive (minúscula ≠ maiúscula) → todas as notas = 0
- Fix: UPPER() adicionado na função `finalizar_materia_prova`
- Ageu Costa (P002) recalculado: 85/100 aprovado

### 11/07/2026 — Inativação de Alunos
- Trigger `trg_ao_inativar_aluno` criado: cancela parcelas abertas + pós-vendas pendentes
- Enum `payment_status` expandido com valor 'cancelado'
- Rosileide (1730) e Mário (1738): parcelas canceladas
- Botão ativar/inativar com campos `ativo` + `status` sincronizados
- Badge Inativo: vermelho suave (bg-red-100 text-red-700)
- Colaboradores: ativar/inativar com bloqueio de login
- Modal de confirmação com aviso das consequências
- Histórico de Condições Canceladas visível no financeiro do aluno

### 11/07/2026 — Financeiro
- Matrículas por Vendedora: colunas Data, Aluno, CTR, Forma Pgto, Telefone, Vendedora
- Cards por vendedora: total, ativas, inativas (aparecem só se tem vendas no período)
- Relatório de Vendas: mesmo padrão de ativas/inativas
- Guias "Primeiras Parcelas" e "Últimas Parcelas" removidas
- Vendedoras inativas aparecem nos filtros com "(inativa)"
- `forma_pagamento` preenchido em parcelas que estavam NULL

### 11/07/2026 — Cursos e Aulas
- 6 cursos vitrine reimportados: Administração (37), Canva (15), Depto Pessoal (38), Frentista (40), Instagram (38)
- Energia Solar: aulas apagadas aguardando reimportação

### 13/07/2026 — Geografia YouTube → Panda
- 60 aulas de Geografia migradas de YouTube para Panda Video
- Progresso de 4 alunos preservado (UPDATE de URL mantendo IDs das aulas)
- 0 aulas YouTube restantes nos cursos EJA

### 14/07/2026 — Regra de Liberação de Prova
- Implementada regra: 60 dias padrão / Acelerado sem restrição / agendamento sobrescreve
- Badge do pacote na aba Financeiro do aluno (🚀 Acelerado, 💰 Avista, etc)
- Seções da Prova Final reordenadas: Config → Novo Agendamento → Histórico
- Removida seção "Matérias da Prova Final" da área do aluno

### 14/07/2026 — Validação de Contrato
- Normalização de acentos na comparação de nome (removeAccents + normalize NFD)
- Fix para Marcos Aurélio (CTR 1715) que não conseguia assinar

### 14/07/2026 — Asaas
- Confirmação automática no Asaas ao dar baixa manual no sistema
- Marilda (1733) e Luana (1722) marcadas como recebidas no Asaas

### 15/07/2026 — Segurança
- Chaves Z-API movidas de frontend para server-side (rota /api/public/hooks/zapi-send)
- Client-Token Z-API regenerado
- .env adicionado ao .gitignore
- Auditoria: service_role key não exposta no frontend ✅
- Auditoria: Asaas chaves só em edge functions ✅

### 15/07/2026 — Página /matricula (Aulão)
- Checkout público criado com 3 opções (Boleto, Cartão, Avista)
- Contrato digital integrado
- WhatsApp automático para equipe
- Campo origem (enum origem_aluno): Google, Meta, Indicação, Outros, Lançamento
- Badge 🟠 Aulão no admin
- Tentativa de CTR com prefixo A (A0501) — revertido por incompatibilidade (CTR é integer)
- Aulão identificado por `origem = 'Lançamento'`, CTR numérico normal

### 15/07/2026 — Projeto Lovable Bloqueado
- Lovable Trust & Safety bloqueou o projeto por "abuso de crédito"
- Decisão FINAL — projeto não será reinstalado
- Email enviado pedindo export dos dados do Supabase
- Código preservado no GitHub (2.880 commits)

### 16/07/2026 — Reconstrução
- Novo projeto Supabase criado: `qohvseedougwymxjhbgi` (East US)
- 3 blocos SQL executados: enums/sequences/tabelas, funções/triggers/views, dados iniciais
- Banco reconstruído com todas as tabelas, triggers, RPCs e views
- Lovable novo em andamento (opção C: forçar código via GitHub)
- Deploy Vercel em andamento (frontend do GitHub → Vercel)
- Documentação oficial do projeto criada (15 arquivos)

---

## Sistema Completo 06 (anteriores — resumo)
- Sistema de ciclos FDS (6 ciclos × sáb/dom × assistiu/não)
- Pagamento parcial (tabela parcelas_pagamentos)
- Módulo Documentação e Certificação (3 guias)
- Provas Agendadas expandido (4 guias + migração 431 registros)
- Vitrine melhorias (perfil vocacional integrado)
- Campanhas de oferta por perfil vocacional
- Correções financeiras (timezone, comissões, filtros)
- Cursos Vitrine importados
- Varredura de segurança (Client-Token Z-API corrigido)

---

## Sessão 20-21/Jul/2026 — Aulão: Matrícula Pública + Pagamento + Dashboard

### Banco de Dados
- Tabela `matriculas_aulao` criada (matrículas públicas sem login/senha)
- Tabela `modelos_contrato` recriada (tinha sumido no reset do Lovable)
- Contrato oficial inserido como modelo ativo com variáveis [BRACKET]
- Colunas Asaas adicionadas em `polos` (asaas_api_key, asaas_ambiente, etc.)
- Colunas de pagamento Asaas adicionadas em `matriculas_aulao`
- Email tornado nullable em matriculas_aulao
- RPC `criar_matricula_lancamento` recriada (insere em matriculas_aulao, não em alunos)
- Função `enviar_boas_vindas_aulao_pendentes` reescrita pra chamar Z-API diretamente via pg_net
- Cron job `aulao-boas-vindas` ativo (a cada minuto)
- Segmento "EJA - Ensino Médio" reordenado pra ordem=0 (primeiro no menu)

### Frontend — Páginas Públicas
- `/matricula` — Checkout completo: 3 etapas, cronômetro regressivo, prova social, banner, salvamento progressivo, contrato com validação digital SHA-256
- `/pagamento/:id` — Pagamento cartão avulso (link enviado pelo admin)
- `/contrato/:id` — Assinatura de contrato avulsa (link enviado pelo admin)

### Frontend — Admin
- Menu "Dashboard Aulão" com cards de faturamento Boleto/Cartão
- Menu "Matrículas Aulão" com filtros (Forma, Contrato, Pagamento), numeração, coluna pagamento, ações (editar, excluir, copiar link pagamento, copiar link contrato, enviar contrato WhatsApp)

### Backend — Rotas Server-Side
- `/api/public/hooks/asaas-aulao` — Cria cobrança PIX (R$69,90) ou Cartão (R$1.438,80 em até 12x)
- `/api/public/hooks/asaas-webhook-aulao` — Webhook para confirmação de pagamento PIX
- Credenciais Z-API e Supabase adicionadas como fallback nas rotas

### Integrações
- Asaas produção configurado no polo (API key no banco)
- Webhook Asaas configurado (PAYMENT_CONFIRMED + PAYMENT_RECEIVED)
- Z-API configurado e testado (Instance 3F4CC1DC, número 48 98439-3047)
- Boas-vindas Z-API dispara direto do banco via pg_net (delay 2-4min aleatório)

### Removidos
- Opção "À Vista (PIX)" do checkout
- Campos email e sexo do cadastro público
- Notificação automática do Asaas pro aluno
- Notificação WhatsApp pra equipe na matrícula


## Sessão 21-22/Jul/2026 — Correções e melhorias pós-lançamento

### Banco de Dados
- Colunas curso_id, duracao_total, ultima_posicao adicionadas em aluno_aulas_assistidas
- Colunas descricao, valor_matricula, numero_parcelas adicionadas em pacotes
- Tabela banners_polo recriada
- Storage bucket 'thumbnails' criado com políticas públicas
- Registros com forma_pagamento='pix' migrados pra 'cartao' em matriculas_aulao

### Frontend
- Área do aluno: % concluído calculado em tempo real (era hardcoded 0%)
- Checkmark verde nas aulas concluídas na sidebar do aluno
- Salvamento progressivo na matrícula (dados→pagamento→contrato)
- Bloco de validação digital no contrato (SHA-256, MP 2.200-2/2001)
- Página /pagamento/:id para pagamento avulso de cartão
- Página /contrato/:id para assinatura remota de contrato
- Botão copiar link do contrato (laranja) e copiar link de pagamento (azul) no admin
- Botão enviar contrato via WhatsApp removido (substituído pelo copiar link)
- Opção "À Vista (PIX)" removida do seletor de edição
- Seletor de parcelas: padrão 12x, ordem decrescente, label "Sem Juros"
- Botão cartão mudado pra "Confirmar Matrícula" (sem preço)
- Valores restaurados: PIX R$69,90 / Cartão 12x R$119,90

### Backend
- Webhook Asaas corrigido: não sobrescreve pagamento_valor com valor da parcela
- Notificação WhatsApp pra equipe removida do fluxo de matrícula
- Link de ajuda aponta pro número do Z-API (48 98439-3047)
- Boas-vindas Z-API: chamada direta via pg_net (não passa pelo servidor)

### Integrações
- Asaas: notificações automáticas desativadas (postalService: false)
- Z-API: credenciais como fallback no código server-side
- Webhook Asaas: fila de sincronização ativada pra resolver status "Interrompido"


## Sessão 22/Jul/2026 — Thumbnail de aula, perfil do aluno editável, inativação no Aulão

### Banco de Dados / Storage
- Buckets `thumbnails-aulas` e `thumbnails-cursos` criados no Supabase Storage (públicos), com políticas de select/insert/update/delete — upload de thumbnail de aula estava implementado no frontend mas falhava porque os buckets nunca existiam
- BUG-017 corrigido: coluna `foto_perfil` (não existe mais) → `foto_url` na tabela `alunos`, em 3 pontos do código; tipos gerados (`types.ts`) atualizados

### Frontend
- Perfil do aluno (`/aluno/perfil`): card "Dados da Conta" agora editável (nome e telefone), com botão de lápis, Salvar/Cancelar; CTR continua somente leitura
- Admin → Matrículas Aulão: novo botão "Inativar" (aluno desistiu) que muda status pra `cancelado` com confirmação, e "Reativar" pra reverter — reaproveita o filtro já existente que impede o disparo de boas-vindas Z-API pra matrículas canceladas
- Menu "Prova Final" removido temporariamente da área do aluno (desktop e mobile) a pedido do Diego — flag `PROVA_FINAL_HABILITADA` em `_student.tsx`; acesso direto pela URL também bloqueado (redireciona pro dashboard)

### Pendente
- Revisão de responsividade mobile na área do aluno — aguardando prints do Diego indicando qual tela está aparecendo "espremida" no celular (dashboard, financeiro, perfil e player de aula já foram revisados no código e usam padrões responsivos)


## Sessão 22/Jul/2026 (continuação) — Ordenação de alunos, pausa Z-API, matrícula simplificada, pagamento manual somativo

### Admin — Alunos
- Lista de Alunos passa a ordenar por CTR decrescente (era por data de criação)

### Z-API
- Disparo automático `aulao-boas-vindas` pausado (`cron.alter_job active=false`) a pedido do Diego — "não será necessário por enquanto"

### Matrícula pública (/matricula)
- Guia "Contrato" removida — vira "Termo de Matrícula", oculto por padrão, só abre em modal ao clicar em "Ler o termo completo"
- Fluxo passa de 3 pra 2 etapas: Dados → Pagamento + Termo (aceite por checkbox)
- Removida a exigência de redigitar nome/CPF pra assinar — usa automaticamente o nome já preenchido na etapa 1
- Botão final "Confirmar Matrícula" leva direto pra tela de boas-vindas + pagamento

### Matrículas Aulão — Pagamento manual
- Novo botão 💲 "Registrar pagamento" (sempre visível) pra lançar pagamentos recebidos fora do Asaas (Pix manual, dinheiro, transferência, outro)
- Cada lançamento é **somado** ao total já pago (histórico completo em nova tabela `matriculas_aulao_pagamentos`), não substitui
- Caso real resolvido: aluno Paulo Acássio de Lima pagou R$ 69,90 (Asaas) + R$ 159,90 (Pix, manual) = R$ 229,80 registrados corretamente

### Dashboard Aulão
- BUG-018 corrigido: "Recebido" (Boleto/Cartão) calculava `quantidade paga × valor fixo`, ignorando pagamentos extras/parciais — agora soma o `pagamento_valor` real de cada matrícula


## Sessão 23/Jul/2026 — Página de demonstração e restauração da Prova Final

### Nova página
- `/matricula-demo` criada — cópia idêntica de `/matricula` sem o popup de prova social, pra uso em demonstração ao vivo em aula

### Prova Final restaurada (BUG-019)
- Descoberto que 3 colunas essenciais sumiram no reset do Supabase: `alunos.data_liberacao_prova`, `alunos.materias_prova`, `polos.whatsapp` — qualquer query que as selecionasse falhava por inteiro
- Colunas recriadas; `data_liberacao_prova` recalculada pra todos os 24 alunos atuais (1ª matrícula + 60 dias)
- Criado curso pseudo "Prova Final" (`is_prova_final = true`) vinculado à matrícula de todos os alunos EJA ativos — é isso que faz a thumbnail aparecer no final da lista de matérias
- Triggers criados pra automatizar isso em matrículas futuras: `trg_definir_liberacao_prova`, `trg_antecipar_liberacao_prova` (Mônica agenda antes do prazo), `trg_vincular_prova_final`
- Flag `PROVA_FINAL_HABILITADA` religada pra `true` — menu e rota `/aluno/prova-final` de volta
- **Pendente:** `prova_questoes` está vazia — Diego precisa reenviar as 10 questões por matéria
- Data-base dos 24 alunos migrados corrigida manualmente por Diego pra 01/07/2026 (libera em 30/08/2026)

### Acesso automático após pagamento (/matricula)
- Ao confirmar pagamento (webhook Asaas, cartão na hora, ou registro manual no admin), o sistema agora cria automaticamente o aluno, o acesso (via Admin API, nunca SQL direto), a matrícula e libera os cursos — antes disso não existia (aulão gerava só um registro sem login)
- Login e senha aparecem na tela do `/matricula` e são enviados por WhatsApp
- Nova rota `/api/public/hooks/converter-matricula-aulao` (ver 06_BACKEND.md)
- Fora do escopo por enquanto: não gera parcelas/financeiro automaticamente

### Histórico de acesso do aluno (BUG-020)
- 4 colunas sumiram no reset: `aluno_sessoes.login_em/logout_em/duracao_minutos` e `aluno_aulas_assistidas.assistida_em` — quebravam o card "Alunos Online", a aba "Histórico" do perfil do aluno e o botão "Marcar como concluída" no admin
- Colunas recriadas e retro-preenchidas a partir do `created_at` de cada registro — nenhuma mudança de código foi necessária

