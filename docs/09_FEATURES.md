# 09 — FEATURES

## Módulo: Autenticação
- ✅ Login admin/colaborador por email + senha
- ✅ Login aluno por CTR + senha
- ✅ Login aluno externo (prefixo P) com acesso temporário
- ✅ Bloqueio de login para colaboradores inativos
- ✅ Bloqueio de login para alunos inativos

## Módulo: Gestão de Alunos
- ✅ Cadastro completo (nome, CPF, telefone, email, data nascimento, sexo, foto)
- ✅ CTR auto-gerado (pula terminados em 13)
- ✅ Busca por nome, CTR ou telefone
- ✅ Busca no Dashboard
- ✅ Filtros: Todos, Ativos, Inativos, Sistema, Aulão
- ✅ Botão ativar/inativar com trigger automático (cancela parcelas + pós-vendas)
- ✅ Campos ativo + status sincronizados
- ✅ Badge Ativo (verde) / Inativo (vermelho suave)
- ✅ Badge 🟠 Aulão para origem = 'Lançamento'
- ✅ Badge ⏳ Aguardando confirmação para aulão com matrícula incompleta
- ✅ Campo origem para rastreamento de canal (enum: Google, Meta, Indicação, Outros, Lançamento)
- ✅ Multi-polo (4 polos)
- ✅ Log de exclusão de alunos
- ✅ Histórico de acesso (login/logout, duração, aulas assistidas com tempo e percentual) — corrigido 23/07/2026, ver BUG-020

## Módulo: Matrículas
- ✅ Fluxo de 5 etapas com navegação livre
- ✅ Contrato digital com assinatura (normalização de acentos)
- ✅ Declaração de Matrícula PDF
- ✅ 6 pacotes pré-definidos
- ✅ Pacote personalizado/negociado (forma_pagamento = boleto)
- ✅ Geração automática de parcelas (numeração 5001+)
- ✅ Trocar Pacote

## Módulo: Financeiro
- ✅ Dashboard: cards Pago/Aberto/Geral
- ✅ Badge do pacote na aba Financeiro do aluno (🚀 Acelerado, 💰 Avista, etc)
- ✅ Parcelas com status (aberto, pago, isento, parcial, cancelado)
- ✅ Pagamento parcial (tabela parcelas_pagamentos, badge 🟡 Parcial)
- ✅ Comissão proporcional ao pagamento parcial
- ✅ Comissão automática via trigger ao pagar Parcela 1
- ✅ Comissão personalizada por vendedora (Vera: 150/70)
- ✅ Financeiro: Recebimentos por período
- ✅ Financeiro: A Receber por período (exclui cancelados e inativos)
- ✅ Financeiro: Alunos em Atraso (exclui cancelados e inativos)
- ✅ Financeiro: Matrículas por Vendedora (colunas: Data, Aluno, CTR, Forma Pgto, Telefone, Vendedora; cards ativas/inativas)
- ✅ Financeiro: Relatório de Vendas (cards ativas/inativas)
- ✅ Financeiro: Comissões Vendedoras
- ✅ Histórico de Condições Canceladas (parcelas canceladas visíveis para consulta)
- ✅ Reativar condições anteriores / criar novo pacote
- ✅ Integração Asaas: confirmar recebimento ao dar baixa
- 🔧 Parcial: Views financeiras (view_recebimentos_periodo criada)

## Módulo: Cursos e Aulas
- ✅ 10 cursos EJA com aulas no Panda Video
- ✅ Cursos Vitrine por segmento
- ✅ Importação via edge function panda-video-sync
- ✅ Rastreamento de progresso (panda_allData, threshold 70%)
- ✅ Botão "Marcar como concluída" (individual e por matéria)
- ✅ Migração YouTube → Panda preservando progresso
- ✅ Upload de thumbnail por aula (Cursos → editar curso → editar aula) — buckets `thumbnails-aulas` e `thumbnails-cursos` criados no Supabase Storage com políticas públicas (22/07/2026). Coluna `thumbnail_url` em `aulas`.

## Módulo: Prova Final
- ✅ Banco de questões (10 por matéria, 4 alternativas)
- ✅ Matérias selecionáveis por agendamento
- ✅ Salvamento de respostas em tempo real
- ✅ Retomada após queda (busca respostas salvas)
- ✅ Cálculo automático de nota (UPPER() na comparação)
- ✅ Trigger automático de resultado (trg_prova_completa)
- ✅ Reagendamento de matérias reprovadas
- ✅ Heartbeat de presença (🟢 Em Prova)
- ✅ 4 guias: Agendadas, Aprovados, Reprovados, Reagendar
- ✅ Badge 🔷 Externo (azul escuro)
- ✅ Botão Agendar Externo com seleção de matérias
- ✅ Botão Gerar CTR para externos antigos
- ✅ Regra 60 dias / Acelerado / agendamento sobrescreve
- ✅ Detalhes com notas por matéria (botão 👁️)

## Módulo: Alunos Externos
- ✅ Tabela separada (alunos_externos)
- ✅ CTR série P (P001, P002...)
- ✅ Login temporário (só no dia da prova)
- ✅ Tela simplificada (só prova, sem menu)
- ✅ RPC: criar_aluno_externo_com_prova
- ✅ WhatsApp automático (agendamento + lembrete 30min)

## Módulo: Documentação e Certificação
- ✅ Checklist de documentos
- ✅ 6 certificadoras cadastradas
- ✅ Envio para certificadora com lotes
- ✅ Controle de certificados (digital + físico)
- ✅ Upload de documentos (Storage)
- ✅ 541 registros migrados do sistema antigo

## Módulo: Pós-Venda
- ✅ 3 etapas: D+1, D+5, D+15
- ✅ Etapa seguinte auto-criada ao concluir anterior
- ✅ Alunos inativos excluídos
- ✅ Migração de dados do sistema antigo

## Módulo: WhatsApp (Z-API)
- ⏸️ **Disparos pausados temporariamente** a pedido do Diego (22/07/2026) — ver 07_INTEGRACOES.md pro status atual real por cron job
- ✅ Boas-vindas, cobrança, motivacional, FDS, lembrete prova
- ✅ Pós-Venda D+1, D+5, D+15
- ✅ Oferta cursos por perfil vocacional
- ✅ Notificação vitrine (botão com preview + confirmação)
- ✅ Toggle global liga/desliga
- ✅ 6 ciclos de FDS (24 mensagens)
- ✅ Chaves movidas para server-side
- ✅ Client-Token regenerado
- ✅ Filtros: exclui inativos, prova finalizada, isento, cancelado, valor 0

## Módulo: Gamificação (Milhas EJA)
- ✅ Sistema de pontos
- ✅ 4 níveis de membership
- ✅ Vitrine de resgate
- ✅ Questionário "Descubra seu Potencial"

## Módulo: Área do Aluno
- ✅ Login por CTR
- ✅ Responsiva / PWA
- ✅ Banners por polo
- ✅ Push Notifications (Firebase)
- ✅ Progresso de aulas
- ✅ Financeiro com aviso de parcelas (corrigido: não conta isento)
- ✅ Prova Final com regra de liberação — reativada 23/07/2026 (estrutura de banco restaurada, ver BUG-019). Menu e rota `/aluno/prova-final` de volta. **Falta apenas Diego reenviar as questões** (`prova_questoes` está vazia)
- ✅ Perfil do aluno editável (nome e telefone) — botão de lápis no card "Dados da Conta" (22/07/2026). CTR permanece somente leitura.
- ✅ Upload de foto de perfil (bucket `fotos-perfil`)

## Módulo: Página Pública /matricula
- ✅ Fluxo em 2 etapas (Dados → Pagamento + Termo), atualizado 22/07/2026
- ✅ 2 opções de pagamento (Boleto, Cartão) com checkout real via Asaas
- ✅ Termo de matrícula oculto por padrão (abre em modal), aceite só por checkbox — sem redigitar nome/CPF
- ✅ Registro de pagamentos fora do Asaas (Pix manual, dinheiro, transferência) pelo admin, somativo com histórico
- 🔧 Pendente: pixel Meta + Utmify
