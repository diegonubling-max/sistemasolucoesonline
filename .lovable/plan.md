### Plano de Implementação: Aba de Pagamentos e Seção Financeira

1. **Atualização da Interface de Matrícula (MatriculaFlow.tsx)**
   - Adicionar uma nova etapa (step 4) no fluxo `MatriculaFlow`.
   - Implementar a lógica de desbloqueio da nova Aba 4 após a conclusão da Aba 3.
   - Criar o componente da Aba 4 contendo:
     - Seção "Taxa de Matrícula" com opções "Cobrar" ou "Isentar" e campo de data de vencimento.
     - Seção "Parcelas" com campo para "Melhor dia de vencimento", botão "Gerar parcelas" e tabela editável de parcelas.
     - Lógica de geração automática de parcelas baseada na quantidade definida pelo pacote selecionado.
     - Totalizador financeiro atualizado em tempo real.
     - Novo botão "Concluir Matrícula" na Aba 4 que realiza o salvamento final na nova tabela `parcelas`.

2. **Atualização da Tela de Detalhes do Aluno (alunos.$id.index.tsx)**
   - Adicionar a seção "Financeiro" contendo:
     - Resumo financeiro (Total pago, total em aberto, total geral).
     - Card de controle da Taxa de Matrícula com botão de baixa.
     - Tabela detalhada de parcelas com controle de status (badge de cores) e botão de baixa de parcelas individuais.
     - Lógica de atualização de status do pagamento para as parcelas.

3. **Validações e Melhorias**
   - Garantir a persistência correta na nova tabela `parcelas`.
   - Adicionar estados de loading para operações assíncronas.
   - Manter a compatibilidade com a tradução e formatação monetária (pt-BR).

**Detalhamento Técnico:**
- A nova tabela `parcelas` já foi criada via migração.
- Utilizarei `useMutation` para as operações de salvamento de parcelas e baixa de pagamentos.
- As consultas ao banco usarão a biblioteca `supabase` integrada.
- As mudanças seguirão o padrão de design existente no projeto.
