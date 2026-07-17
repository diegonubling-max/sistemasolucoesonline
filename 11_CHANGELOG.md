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
