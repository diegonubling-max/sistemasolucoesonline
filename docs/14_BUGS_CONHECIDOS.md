# 14 — BUGS CONHECIDOS

## Resolvidos ✅

### BUG-001: Notas de prova sempre zeradas
- **Causa:** Comparação case-sensitive na `finalizar_materia_prova`. Respostas salvas em minúscula ('a'), `resposta_correta` em maiúscula ('A'). `'a' != 'A'` → 0 acertos.
- **Solução:** Adicionado `UPPER()` na comparação: `IF UPPER(v_correta) = UPPER(v_resposta)`
- **Status:** ✅ Resolvido (09/07/2026)
- **Afetados:** Ageu Costa (P002) — recalculado para 85/100

### BUG-002: Trigger comissão usava coluna inexistente
- **Causa:** Trigger `gerar_comissao_pagamento` referenciava `comissao_boleto` mas coluna real é `comissao_parcelado`
- **Solução:** Corrigida referência para `comissao_parcelado`
- **Status:** ✅ Resolvido (08/07/2026)

### BUG-003: Comissão de pacote personalizado como avista
- **Causa:** Quando `forma_pagamento` era NULL (pacote personalizado), o trigger tratava como avista e dava R$150 em vez de R$70
- **Solução:** Adicionada lógica: se `num_parcelas > 1` → comissão parcelado, independente da forma de pagamento
- **Status:** ✅ Resolvido (11/07/2026)

### BUG-004: Trigger prova completa disparava prematuramente
- **Causa:** Trigger verificava "existe linha com finalizado_em IS NULL?" mas matérias não iniciadas NÃO tinham registro, então retornava false (todas finalizadas) após a primeira matéria.
- **Solução:** Trigger agora compara `total_finalizadas >= array_length(materias_selecionadas)`
- **Status:** ✅ Resolvido (08/07/2026)

### BUG-005: Cobrança WhatsApp para parcelas R$0 (isento)
- **Causa:** Query de cobrança não filtrava parcelas com valor 0 ou status isento
- **Solução:** Adicionados filtros `.neq('status','isento').gt('valor', 0)` no endpoint whatsapp-cobranca.ts
- **Status:** ✅ Resolvido (08/07/2026)

### BUG-006: Aluno some da guia Agendadas ao iniciar prova
- **Causa:** Guia filtrava apenas `status = 'agendada'`. Ao iniciar, status mudava para 'iniciado' e aluno sumia.
- **Solução:** Filtro expandido para `.in('status', ['agendada', 'iniciado'])`
- **Status:** ✅ Resolvido (08/07/2026)

### BUG-007: Timezone nas datas de parcelas
- **Causa:** `new Date("YYYY-MM-DD")` interpretava como UTC, gerando datas erradas
- **Solução:** Usar `new Date(year, month-1, day)` para criar datas locais
- **Status:** ✅ Resolvido (sessão anterior SC06)

### BUG-008: Chaves Z-API expostas no frontend
- **Causa:** Instance ID, Token e Client-Token hardcoded em componentes frontend (zApiService.ts, VitrineInteresse.tsx, _admin.provas-agendadas.tsx)
- **Solução:** Criada rota server-side `/api/public/hooks/zapi-send`. Chaves movidas para `process.env`. Client-Token regenerado.
- **Status:** ✅ Resolvido (15/07/2026)

### BUG-009: Assinatura de contrato falhava com acentos
- **Causa:** Validação de nome comparava sem normalizar acentos. "Marcos Aurelio" ≠ "Marcos Aurélio"
- **Solução:** Adicionado `removeAccents()` com `normalize('NFD')` na comparação
- **Status:** ✅ Resolvido (14/07/2026)

### BUG-010: Banner "parcela em aberto" aparecia para aluno com tudo pago
- **Causa:** Lógica contava parcelas com status 'isento' como "em aberto"
- **Solução:** Banner só aparece se existe parcela com `status = 'aberto'` (ignora isento, pago, cancelado)
- **Status:** ✅ Resolvido (13/07/2026)

### BUG-011: Trigger inativação usava valor inexistente no enum
- **Causa:** `status IN ('aberto', 'pendente')` — 'pendente' não existe no enum payment_status
- **Solução:** Corrigido para `status = 'aberto'` apenas
- **Status:** ✅ Resolvido (15/07/2026)

### BUG-012: Mensagens FDS para alunos que já fizeram prova
- **Causa:** Disparos motivacionais não verificavam se o aluno já tinha resultado de prova
- **Solução:** Adicionado filtro excluindo alunos com resultado não NULL em prova_agendamentos
- **Status:** ✅ Resolvido (11/07/2026)

### BUG-013: Função buscar_email_por_ctr duplicada (integer + text)
- **Causa:** Ao mudar CTR para text e depois reverter para integer, ficaram duas versões da função
- **Solução:** Dropadas ambas e recriada apenas a versão integer
- **Status:** ✅ Resolvido (15/07/2026)

### BUG-014: Alunos recebendo cobrança do Asaas após baixa no sistema
- **Causa:** Dar baixa no sistema não confirmava o recebimento no Asaas. Asaas continuava enviando emails de cobrança.
- **Solução:** Ao dar baixa, chamar API Asaas `/v3/payments/{id}/receiveInCash`
- **Status:** ✅ Resolvido (14/07/2026)

### BUG-017: Perfil do aluno em branco (nome, telefone, CTR e foto todos "---")
- **Causa:** Query em `_student.aluno.perfil.tsx` selecionava a coluna `foto_perfil`, que não existe mais na tabela `alunos` (foi recriada como `foto_url` em algum reset anterior). O Supabase/PostgREST rejeita a query inteira quando uma coluna não existe, então nome/telefone/CTR também ficavam em branco, não só a foto. O mesmo erro estava no card "Alunos Online" do dashboard admin (`_admin.index.tsx`).
- **Solução:** Trocado `foto_perfil` → `foto_url` nos 3 lugares (select, update do upload de foto, render) em `_student.aluno.perfil.tsx` e `_admin.index.tsx`, e corrigido `src/integrations/supabase/types.ts` (tipos gerados desatualizados).
- **Status:** ✅ Resolvido (22/07/2026)

### BUG-018: Dashboard Aulão — "Recebido" (Boleto/Cartão) não refletia pagamentos extras/parciais
- **Causa:** O cálculo era `quantidade de matrículas pagas × valor fixo` (ex: 1 boleto pago = sempre R$ 69,90), em vez de somar o valor real (`pagamento_valor`) de cada matrícula. Quando um aluno pagava mais de uma vez (ex: taxa inicial + parcela depois), o valor extra não aparecia no dashboard.
- **Solução:** `recebidoBoleto`/`recebidoCartao` agora somam `pagamento_valor` de cada matrícula paga, que por sua vez é sempre a soma dos lançamentos em `matriculas_aulao_pagamentos`.
- **Status:** ✅ Resolvido (22/07/2026)

### BUG-019: Prova Final inacessível — colunas essenciais sumiram no reset do Supabase
- **Causa:** O reset do Lovable/Supabase recriou as tabelas de prova mas não recriou 3 colunas que o código já esperava: `alunos.data_liberacao_prova` (data de liberação calculada), `alunos.materias_prova` (matérias personalizadas do aluno) e `polos.whatsapp` (WhatsApp do setor de provas por polo). Qualquer query que selecionasse essas colunas falhava por inteiro (mesmo padrão do BUG-017), deixando a tela `/aluno/prova-final` e o card "Prova Final" do dashboard sem funcionar. Além disso, nenhum curso tinha `is_prova_final = true`, então a thumbnail da prova nem aparecia na lista de matérias do aluno.
- **Solução (23/07/2026):** Colunas recriadas; `data_liberacao_prova` recalculada pra todos os 24 alunos atuais (data da 1ª matrícula + 60 dias); criado curso pseudo "Prova Final" (`is_prova_final = true`) vinculado a todas as matrículas EJA ativas; triggers criados para automatizar isso em matrículas futuras (`trg_definir_liberacao_prova`, `trg_antecipar_liberacao_prova` quando a Mônica agenda antes do prazo, `trg_vincular_prova_final`); flag `PROVA_FINAL_HABILITADA` religada em `src/routes/_student.tsx`.
- **Correção aplicada (23/07/2026):** Diego ajustou manualmente — os 24 alunos migrados agora usam 01/07/2026 como data-base (em vez da data de reconstrução do banco, 17/07/2026) + 60 dias, liberando em 30/08/2026 pra todos.
- **Pendente:** a tabela `prova_questoes` está vazia (0 questões) — Diego precisa reenviar as perguntas de cada matéria pra prova poder ser realizada de fato.
- **Status:** ✅ Estrutura corrigida / ⏳ Aguardando reenvio das questões

## Conhecidos / Não Resolvidos ⚠️

### BUG-015: View recebimentos com double-counting
- **Causa:** Parcelas pagas em full também aparecem em parcelas_pagamentos, causando contagem dupla em algumas views
- **Solução pendente:** Ajustar view para usar `NOT EXISTS` corretamente
- **Status:** ⚠️ Parcialmente resolvido (view criada com filtro, mas precisa validação)

### BUG-016: Extensão de tradução do Chrome causa erros no Supabase
- **Causa:** Chrome Translate interfere com o DOM do Supabase Dashboard
- **Workaround:** Usar aba anônima ou desativar tradução para supabase.com
- **Status:** ⚠️ Workaround (problema do Chrome, não do sistema)
