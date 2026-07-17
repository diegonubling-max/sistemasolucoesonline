# 01 — MASTER: Visão Geral do Projeto

## Objetivo do Sistema
Sistema de gestão escolar completo para a Escola Soluções Online, uma escola EJA (Educação de Jovens e Adultos) 100% online. O sistema gerencia todo o ciclo de vida do aluno desde a matrícula até a certificação, incluindo aulas em vídeo, provas online, controle financeiro, documentação e comunicação automatizada via WhatsApp.

## Modelo de Negócio
- Escola EJA 100% online com certificado reconhecido pelo MEC
- Aluno assiste aulas gravadas na plataforma
- Prova Final única online (10 questões por matéria, mínimo 60% para aprovação)
- Prazo mínimo de 60 dias para prova (exceto pacote Acelerado)
- Certificado emitido por certificadoras parceiras credenciadas
- Conclusão em até 6 meses

## Público-Alvo
Jovens e adultos que não concluíram o Ensino Fundamental ou Médio. Perfil: pessoas com pouca familiaridade com tecnologia, acessam principalmente pelo celular.

## Módulos do Sistema

### 1. Autenticação
- Login Admin/Colaborador: email + senha
- Login Aluno: CTR (número sequencial) + senha (1234 + primeiro nome)
- Login Aluno Externo: CTR série P (P001, P002) + senha
- Colaboradores inativos são bloqueados no login

### 2. Gestão de Alunos
- Cadastro completo (nome, CPF, telefone, email, data nascimento, sexo)
- CTR gerado automaticamente (sequência numérica, pula terminados em 13)
- Status ativo/inativo com trigger automático (cancela parcelas e pós-vendas)
- Busca por nome, CTR ou telefone
- Multi-polo (Florianópolis, Novo Hamburgo, Porto Alegre, Porto Alegre - Bruna)
- Campo `origem` para rastrear canal de aquisição (Google, Meta, Indicação, Outros, Lançamento)

### 3. Matrículas
- Fluxo de 5 etapas com navegação livre
- Contrato digital com assinatura (validação por nome + telefone + CPF, ignora acentos)
- Pacotes pré-definidos (Avista, Avista Acelerado, Boleto, Cartão, Cartão Acelerado)
- Pacote personalizado/negociado
- Geração automática de parcelas com numeração sequencial (5001+)
- Declaração de Matrícula em PDF

### 4. Financeiro
- Parcelas com status: aberto, pago, isento, parcial, cancelado
- Integração Asaas (PIX e Boleto)
- Pagamento parcial com comissão proporcional
- Dashboard: Recebimentos, A Receber, Alunos em Atraso
- Matrículas por Vendedora (com contagem ativas/inativas)
- Relatório de Vendas por período
- Comissões por vendedora
- Confirmação no Asaas ao dar baixa manual

### 5. Comissões
- Avista: R$120 (padrão), R$150 (Vera Altneter)
- Parcelado/Boleto: R$50 (padrão), R$70 (Vera Altneter)
- Gerada automaticamente via trigger ao pagar Parcela 1
- Lógica: mais de 1 parcela = comissão parcelado (independente da forma de pagamento)

### 6. Cursos e Aulas
- 10 matérias EJA: Biologia, Filosofia, Física, Geografia, História, Inglês, Matemática, Português, Química, Sociologia
- Cursos Vitrine (profissionalizantes) por segmento
- Vídeo-aulas hospedadas no Panda Video
- Rastreamento de progresso (evento panda_allData, threshold 70%)
- Botão "Marcar como concluída" (individual e por matéria) no admin
- Importação via edge function `panda-video-sync`

### 7. Prova Final
- Questões em `prova_questoes` (10 por matéria, 4 alternativas)
- Matérias selecionáveis por agendamento (campo `materias_selecionadas`)
- Salvamento de respostas em tempo real (cada questão salva individualmente)
- Retomada após queda (busca respostas salvas no jsonb)
- Cálculo automático de nota com UPPER() na comparação
- Trigger `trg_prova_completa` atualiza agendamento quando todas matérias selecionadas são finalizadas
- Regra: >= 60% = aprovado na matéria
- Resultado geral: aprovado se TODAS as matérias >= 60%
- Reagendamento de matérias reprovadas
- Heartbeat de presença (último heartbeat < 2 min = 🟢 Em Prova)

### 8. Alunos Externos (Prova)
- Tabela separada `alunos_externos`
- CTR série P (P001, P002, P003...)
- Acesso temporário válido APENAS no dia da prova
- Login detecta prefixo "P" e busca em `alunos_externos`
- Função `externo_tem_acesso_hoje()` valida acesso
- Mônica seleciona matérias e agenda
- WhatsApp automático com CTR + senha no agendamento e 30min antes

### 9. Documentação e Certificação
- 3 guias: Documentação, Envios para Certificadora, Certificados
- Checklist de documentos (RG/CPF, Comp. Residência, Históricos)
- 6 certificadoras cadastradas (CECO, Educa Nexus, Ifope, Nobel, Referencial, Santa Rita)
- Upload de documentos via Supabase Storage
- Envio para certificadora com controle de lotes

### 10. Pós-Venda
- 3 etapas: D+1, D+5, D+15
- Etapa seguinte criada automaticamente ao concluir anterior
- Alunos inativos não aparecem no pós-venda

### 11. WhatsApp (Z-API)
- Boas-vindas ao matricular
- Cobrança diária (exclui isento, cancelado, valor 0, inativos)
- Motivacional diário (segunda a sábado, por grupo de CTR)
- Ciclos de fim de semana (6 ciclos, assistiu/não assistiu)
- Lembrete 30min antes da prova
- Pós-Venda D+1, D+5, D+15
- Oferta de cursos vitrine por perfil vocacional
- Notificação vitrine (aluno clicou em curso)
- Toggle global liga/desliga
- Chaves movidas para server-side (rota /api/public/hooks/zapi-send)

### 12. Gamificação (Milhas EJA)
- Pontos por assistir aulas, completar matérias, login diário
- 4 níveis de membership
- Vitrine de resgate com checkout

### 13. Área do Aluno
- Login por CTR + senha
- Responsiva / PWA
- Menu: Início, Meus Cursos, Financeiro, Prova Final
- Banners por polo (1080x500px)
- Push Notifications (Firebase)
- Perfil vocacional integrado ("Descubra seu Potencial")

### 14. Página de Matrícula Pública (/matricula)
- Checkout para aulão/lançamento (sem pagamento online)
- Campos: nome, email, telefone, CPF, data nascimento, sexo
- Opções: Boleto (1+9 x R$159,90), Cartão (12x R$119,90), Avista (R$1.198)
- Contrato digital integrado
- Alunos de aulão identificados por `origem = 'Lançamento'` e badge 🟠
- WhatsApp automático para equipe após matrícula

## Polos
- **Florianópolis** (Matriz) — ID: `32671c78-9076-4f88-8161-bfd5ee8e866b`
- Novo Hamburgo
- Porto Alegre
- Porto Alegre - Bruna

## Colaboradores Ativos (Polo Florianópolis)

| Nome | Email | Setor |
|------|-------|-------|
| Gabrielly Mann | gabriellymann19@gmail.com | Vendedor |
| Gislaine da Silva Borba | laineborbasap@gmail.com | Administrativo |
| Maria Eduarda | maria.muller1305@gmail.com | Vendedor |
| Mônica Chaiane | monica@solucoesonline.com | Setor de Provas |
| Rita de Cassia Nubling | ritanubling@hotmail.com | Vendedor |
| Vera Altneter | altnetervera.correa06@gmail.com | Vendedor |

## Visão do Sistema
O sistema foi construído para ser operado por pessoas com pouco conhecimento técnico. A interface é projetada para clareza, com badges visuais, botões grandes e fluxos guiados. O público (alunos) acessa majoritariamente pelo celular via links do WhatsApp, então todas as telas devem ser mobile-first.
