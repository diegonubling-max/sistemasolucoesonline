# 05 — FRONTEND

## Framework
- React + TypeScript + TanStack Start (SSR)
- TailwindCSS + shadcn/ui
- Rotas file-based em `src/routes/`
- Mobile-first para área do aluno

## Painel Administrativo

### Menu Lateral
1. **Dashboard** — visão geral, busca por nome/CTR/telefone, cliques na vitrine com botão WhatsApp
2. **Alunos** — listagem com filtros (Todos/Ativos/Inativos/Sistema/Aulão), busca por nome/CTR/telefone, badges de status
3. **Cursos** — gerenciamento de cursos EJA e Vitrine
4. **Segmentos** — categorias dos cursos vitrine
5. **Pacotes** — pacotes de matrícula disponíveis
6. **Colaboradores** — listagem com filtro Todos/Ativos/Inativos, ativar/inativar com bloqueio de login
7. **Documentação** — 3 guias: Documentação, Envios para Certificadora, Certificados
8. **Provas Agendadas** — 4 guias: Agendadas, Aprovados, Reprovados, Reagendar
9. **Pós-Venda** — follow-up D+1, D+5, D+15 (exclui inativos)
10. **Financeiro** — Recebimentos, A Receber, Alunos em Atraso, Matrículas por Vendedora, Relatório de Vendas, Comissões
11. **Configurações** — toggle Z-API, disparos WhatsApp

### Página de Detalhes do Aluno
**Header:** Nome | CTR #XXXX | Botão Ativo/Inativo (verde/vermelho) | Reenviar Acesso | Ações

**Abas:**
- **Dados Gerais** — informações cadastrais, foto
- **Financeiro** — cards Pago/Aberto/Geral, badge do pacote (🚀 Acelerado / 💰 Avista / 💳 Cartão / 📄 Boleto), tabela de parcelas com ações (Baixa, Excluir), Histórico de Condições Canceladas
- **Vitrine** — cursos disponíveis com perfil vocacional
- **Progresso** — aulas assistidas por matéria
- **Histórico** — log de atividades
- **Mensagens** — histórico de WhatsApp enviados

### Provas Agendadas

**Guia Agendadas:**
- Filtro: inclui status 'agendada' e 'iniciado'
- Badge 🟢 "Em Prova" se `ultimo_heartbeat` < 2 minutos
- Badge 🟡 "Iniciou" se status = 'iniciado' mas não está online
- Badge 🔷 "Externo" (azul escuro, cor do menu lateral) se `is_externo = true`
- Botão "📋 Agendar Externo" — abre modal com formulário + seleção de matérias
- Botão "Gerar CTR" para externos antigos sem CTR
- Ordenação: data mais próxima primeiro

**Guia Reprovados:**
- Botão "🔄 Reagendar Reprovadas" — cria novo agendamento só com matérias reprovadas
- Detalhes com notas por matéria (botão 👁️)

**Guia Reagendar:**
- Ordenação: mais recente primeiro (DESC)

**Colunas da tabela (todas as guias):**
- Sem coluna "Notas" (removida — notas aparecem só nos detalhes via 👁️)

### Financeiro

**Guias removidas:** Primeiras Parcelas, Últimas Parcelas

**Matrículas por Vendedora:**
- Colunas: Data, Aluno, CTR, Forma Pgto (badge colorida), Telefone, Vendedora
- Cards por vendedora: total matrículas, 🟢 ativas, 🔴 inativas
- Cards aparecem SOMENTE se vendedora tem vendas no período filtrado
- Filtros: vendedora (inclui inativas com "(inativa)"), período, forma de pagamento
- Vendedoras inativas aparecem no filtro para consulta histórica

**Relatório de Vendas:**
- Mesmo padrão: cards com ativas/inativas por vendedora

**A Receber:**
- Exclui: parcelas canceladas, alunos inativos
- Badge colorida de forma de pagamento

**Alunos em Atraso:**
- Exclui: parcelas canceladas, isento, alunos inativos

## Área do Aluno

### Acesso
- URL: /aluno/login
- Login: CTR + senha
- Prefixo "P" → login de externo (tela simplificada, só prova)

### Menu
- Início (dashboard com banners)
- Meus Cursos (aulas EJA + Vitrine)
- Financeiro (parcelas, status de pagamento)
- Prova Final (configurações, agendamento, histórico)

### Prova Final
**Seções (nesta ordem):**
1. Configurações da Prova Final
2. Novo Agendamento
3. Histórico de Agendamentos

**Regra de liberação:**
- Mostra contagem regressiva: "Faltam X dias"
- Se liberada: botão ativo para agendar/fazer prova
- Se agendada: "Sua prova está agendada para [data]"

### Tela de Prova (durante a prova)
- Timer no canto superior
- Lista de matérias com status: ✅ Concluída, 🔄 Em andamento, ⬜ Não iniciada
- Somente matérias do campo `materias_selecionadas`
- 1 questão por vez (1 de 10, 2 de 10...)
- Resposta salva a cada clique
- Sem resultado individual por matéria até terminar todas
- Resultado final com tabela: Matéria | Acertos | % | Status

### Área do Aluno Externo (após login P)
- Sem sidebar/menu lateral
- Sem acesso a aulas, vitrine, financeiro
- Header: "Olá, [nome]! Prova do dia [data]"
- Direto para tela de prova
- Botão "Sair"

### Banner da Área do Aluno
- Formato: 1080x500px (JPG/PNG/WEBP)
- Por polo (cada polo tem seus banners)
- Até 3 banners ativos por polo

## Página Pública: /matricula (Checkout Aulão)
- Mobile-first
- Banner 1080x600px no topo
- 3 etapas: Dados → Pagamento → Contrato
- Data de nascimento: campo texto com máscara (não calendário)
- Sexo: select (Masculino/Feminino)
- Pagamento: 3 cards (Boleto, Cartão, Avista) — só preferência, sem pagamento real
- Contrato: texto completo + checkbox + assinatura digital
- Confirmação: CTR + senha + link para login + botão copiar
- WhatsApp automático para equipe (telefone: 48991535895)

## Badges Visuais

| Badge | Cor | Onde |
|-------|-----|------|
| Ativo | Verde | Alunos, Colaboradores |
| Inativo | Vermelho suave (bg-red-100 text-red-700) | Alunos, Colaboradores |
| 🟠 Aulão | Laranja (bg-orange-100 text-orange-700) | Alunos com origem = 'Lançamento' |
| ⏳ Aguardando confirmação | Amarelo | Alunos aulão com matrícula incompleta |
| 🔷 Externo | Azul escuro (cor do menu lateral, bg-blue-900 text-white) | Provas Agendadas |
| 🟢 Em Prova | Verde | Provas Agendadas (heartbeat < 2min) |
| 🟡 Iniciou | Amarelo | Provas Agendadas (status iniciado, sem heartbeat) |
| 🟡 Parcial | Amarelo | Financeiro (pagamento parcial) |
| Vencido | Vermelho | Financeiro (parcela vencida) |
| PIX | Verde | Forma de pagamento |
| Boleto | Amarelo | Forma de pagamento |
| Cartão | Azul | Forma de pagamento |
| 🚀 Plano Acelerado | Laranja | Aba financeiro do aluno |

## Arquivo Principal do Financeiro
`src/routes/_admin.financeiro.tsx` — contém as guias Matrículas por Vendedora, Relatório de Vendas, etc.
