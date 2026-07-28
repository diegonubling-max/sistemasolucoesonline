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

### BUG-020: Histórico de acesso do aluno não aparecia (sessões e aulas assistidas)
- **Causa:** 4 colunas sumiram no reset do Supabase, mesmo padrão dos BUGs 017/018/019: `aluno_sessoes.login_em`, `aluno_sessoes.logout_em`, `aluno_sessoes.duracao_minutos` e `aluno_aulas_assistidas.assistida_em`. As sessões de login continuavam sendo criadas normalmente (`aluno_sessoes` só tinha `id`, `aluno_id`, `created_at`), mas qualquer tela que ordenasse ou lesse por essas colunas quebrava a query inteira — isso incluía o card "Alunos Online" do dashboard admin, a aba "Histórico" no perfil do aluno (sessões de login e aulas assistidas), e o encerramento de sessão ao fechar a aba. Também quebrava, silenciosamente, o botão **"Marcar como concluída"** no admin (o upsert tentava gravar `assistida_em`, que não existia, e falhava por inteiro).
- **Solução (23/07/2026):** As 4 colunas foram recriadas e retro-preenchidas com o `created_at` de cada registro já existente (11 sessões, 110 registros de aulas assistidas). Nenhuma mudança de código foi necessária — os dados já estavam certos, só faltavam as colunas no banco.
- **Status:** ✅ Resolvido — login/logout, duração da sessão, percentual e tempo assistido por aula, tudo funcionando de novo.

### BUG-021: Botões/links pra páginas novas não funcionavam (routeTree.gen.ts desatualizado)
- **Causa:** `src/routeTree.gen.ts` é um arquivo gerado automaticamente pelo plugin do TanStack Router (rodando junto do `vite build`/`vite dev`), mas fica commitado no repositório. Como várias páginas novas desta sessão (`/matricula-demo`, `/webinar/:id`, `/webinars`, `/webinars/:id`, `/api/public/hooks/converter-matricula-aulao`) foram criadas via commit direto na API do GitHub — sem rodar o build localmente — esse arquivo nunca foi atualizado. Resultado: o roteador em produção não conhecia essas rotas, então botões/links pra elas simplesmente não faziam nada ao clicar (sem erro visível, já que o React nem tenta navegar pra uma rota que não existe na árvore).
- **Como foi descoberto:** Diego reportou que o botão "ver quem está ao vivo" (Webinars) não funcionava.
- **Solução (23/07/2026):** Rodado `npm install --legacy-peer-deps` + `npx vite build` no sandbox pra regenerar o `routeTree.gen.ts` de verdade, e commitado o arquivo atualizado.
- **Prevenção:** ver nota em 15_CONVENCOES_IA.md, seção "Rotas novas" — sempre regenerar esse arquivo depois de criar uma rota nova.
- **Status:** ✅ Resolvido

### BUG-022: Cadastrar novo aluno dava erro "Could not find the 'cadastrado_por' column"
- **Causa:** mesmo padrão de sempre — 4 colunas sumiram no reset do Supabase: `alunos.cadastrado_por`, `cadastrado_por_id`, `menor_de_idade`, `responsavel_email`. O formulário "Novo Aluno" do admin sempre tentou gravar essas colunas, então o cadastro falhava logo na primeira etapa.
- **Solução (26/07/2026):** colunas recriadas.
- **Bônus corrigido no mesmo lugar:** o passo seguinte (criar o login do aluno) usava a RPC `criar_acesso_aluno`, que insere direto em `auth.users`/`auth.identities` via SQL — exatamente o padrão que já causou "Database error querying schema" no GoTrue antes (ver histórico dos 24 alunos migrados). Trocado por um endpoint novo (`/api/public/hooks/criar-acesso-aluno`) que usa a Admin API do Supabase, igual ao resto do sistema. Também corrigido o e-mail fictício gerado quando o aluno não informa e-mail: estava no formato `ctr{N}@solucoesonline.com.br`, agora usa o padrão real `{N}@aluno.com`.
- **Ainda usando a RPC arriscada (não mexido, menor prioridade):** `aluno.login.tsx` também chama `criar_acesso_aluno`, mas só como "garantia" — a função já verifica se o e-mail existe e não faz nada se existir, então o risco ali é bem menor (só afeta login de conta que nunca foi criada). Vale revisar no futuro.
- **Status:** ✅ Resolvido

### BUG-023: Cadastrar/editar aluno dava erro "Could not find the 'dias_prova_final' column"
- **Causa:** mesmo padrão de sempre — `alunos.dias_prova_final` sumiu no reset do Supabase. Essa coluna é o prazo (em dias) configurável por aluno pra liberar a Prova Final — usada na aba "Prova Final" da edição do aluno (`ConfigurarProvaFinal`, dentro de `_admin.alunos.$id.editar.tsx`), que recalcula e grava `data_liberacao_prova` a partir dela. Sem a coluna, o cadastro/edição falhava por inteiro.
- **Solução (26/07/2026):** coluna recriada (`integer DEFAULT 60`), preenchida com 60 pros 24 alunos já existentes.
- **Nota:** essa configuração por aluno é independente do trigger `trg_definir_liberacao_prova` (que usa 60 dias fixos como padrão pra matrículas novas) — o admin pode ajustar esse prazo individualmente por aqui depois.
- **Status:** ✅ Resolvido

### BUG-024: Formulário de aluno com mais colunas faltando + redefinir senha quebrado em 3 lugares
- **Causa 1:** mais 5 colunas sumiram no reset: `alunos.observacao`, `origem_detalhe`, `responsavel_nome`, `responsavel_telefone`, `responsavel_cpf`. Fiz uma checagem completa de todos os campos do formulário `AlunoForm.tsx` contra o banco de uma vez, pra parar de descobrir uma coluna por vez.
- **Causa 2 (mais séria):** a RPC `redefinir_senha_aluno` **não existe mais no banco** — e ela era chamada em 3 lugares: quando o admin edita o nome do aluno e opta por resetar a senha, quando o admin clica em "redefinir senha padrão", e **quando o próprio aluno troca a senha dele no perfil** (essa era a mais grave, afetava alunos reais direto).
- **Solução (26/07/2026):** colunas recriadas; criado endpoint `/api/public/hooks/redefinir-senha-aluno` usando Admin API do Supabase (localiza o usuário pelo e-mail via `listUsers` e atualiza a senha com `updateUserById`) — substituindo a RPC ausente nos 3 lugares.
- **Bônus corrigido:** e-mail fictício (`ctr{N}@solucoesonline.com.br`) corrigido pro padrão real (`{N}@aluno.com`) em mais 2 lugares (edição de aluno e redefinição de senha); URL antiga do Lovable (`sistemasolucoesonline.lovable.app`) trocada pela URL certa (`sistema.supletivosolucoesonline.com.br`) na mensagem de WhatsApp de redefinição de senha.
- **Encontrado mas não mexido:** ainda existem outras referências à URL antiga do Lovable espalhadas em ~7 arquivos (`ContratoAlunoModal.tsx`, `MatriculaFlow.tsx`, `zApiService.ts`, `__root.tsx`, `login.tsx`, `aluno.login.tsx`, `lembrete-prova.ts`, `_admin.provas-agendadas.tsx`) — vale uma limpeza dedicada depois.
- **Status:** ✅ Resolvido

### BUG-025: Guias Cursos/Pacote/Pagamentos/Contrato do "Novo Aluno" quebradas
- **Pacote:** a tabela **inteira** `matricula_pacotes` não existia no banco (não era só uma coluna) — recriada. Isso também estava quebrando silenciosamente relatórios do Financeiro que dependem dela (`SalesReport.tsx`, `_admin.financeiro.tsx`).
- **Pacote (negociação personalizada):** coluna `matriculas.observacao` também sumiu (diferente da de `alunos`, já corrigida antes) — recriada.
- **Pagamentos:** coluna `parcelas.polo_id` sumiu — recriada.
- **Contrato — o mais sério:** a tabela `contratos` foi reconstruída com uma estrutura bem diferente do que esse fluxo esperava (o antigo recurso de **assinatura remota por link único com token e validação de identidade** sumiu por completo — colunas `matricula_id`/`conteudo_html`/`token_unico` não existem, e as RPCs `get_contrato_publico` e afins também não existem mais no banco).
- **Decisão do Diego:** em vez de reconstruir o recurso de link remoto do zero, o contrato do "Novo Aluno" agora é **assinado na hora**, dentro do próprio cadastro — mesmo estilo simplificado do `/matricula`. Removido código morto (`createContract`, mutação nunca usada) e a URL antiga do Lovable que construía o link.
- **Encontrado mas não mexido:** `ContratoAlunoModal.tsx` (usado em outros lugares pra ver/gerar contrato, com botão de compartilhar por WhatsApp) **também** depende do mesmo esquema antigo quebrado — precisa da mesma decisão de simplificação, ainda pendente.
- **Status:** ✅ Cursos/Pacote/Pagamentos resolvidos. ✅ Contrato do Novo Aluno resolvido (assinatura imediata). ⏳ `ContratoAlunoModal.tsx` ainda pendente.

### BUG-026: Parcelas geradas erradas (taxa zerada, número de parcelas errado, cartão virava 1 cobrança só)
- **Causa 1 (dado errado, não código):** todos os pacotes tinham `valor_matricula = 0` (deveria ser sempre R$69,90) e `numero_parcelas = 1` (independente do nome do pacote — "1+9" tinha `numero_parcelas=1` em vez de 9, "12x" tinha 1 em vez de 12) — provavelmente zerado/perdido no reset do Supabase.
- **Causa 2 (código):** o botão "Gerar parcelas" do fluxo "Novo Aluno" tinha um tratamento especial pra pacotes do tipo `cartao`, que sempre gerava **uma única linha** com o valor total (ignorando `numero_parcelas`) — só o boleto e a negociação personalizada usavam o loop genérico correto.
- **Solução (27/07/2026):** corrigidos os valores de todos os 6 pacotes ativos (`valor_matricula=69.90`, `numero_parcelas` batendo com o nome de cada um, `valor_total` recalculado); removido o tratamento especial do cartão no código — agora cartão usa o mesmo loop genérico que boleto, gerando o número certo de parcelas.
- **Conferido:** `TrocarPacoteModal.tsx` já usava os campos genéricos corretamente — não precisou de mudança de código, só se beneficiou da correção dos dados.
- **Nota (28/07/2026):** o contador "Total de parcelas" na tela mostrava só as parcelas geradas pelo loop, sem contar a taxa de matrícula (ex: 1+9 mostrava "9" em vez de "10") — o banco sempre salvou certo (confirmado: 10 parcelas, R$1.509,00 pro aluno Nicole Borba Nubling/CTR 1746), era só o rótulo na tela. Corrigido pra contar junto.
- **Status:** ✅ Resolvido

### BUG-027: Excluir aluno dava erro de foreign key (matricula_cursos)
- **Causa:** a RPC `delete_aluno_completo` esquecia de limpar 5 tabelas relacionadas antes de apagar `matriculas`/`alunos`: `matricula_cursos`, `matricula_pacotes` (nova, criada nesta sessão), `cursos_vitrine`, `contratos`, `aluno_sessoes` — qualquer aluno com dados nessas tabelas (ou seja, praticamente todos) não conseguia ser excluído.
- **Solução (27/07/2026):** função reescrita pra limpar todas as tabelas que referenciam `alunos`/`matriculas` na ordem certa antes de excluir. `matriculas_aulao` não é apagada (é histórico de marketing/matrícula) — só desvinculada (`aluno_id = NULL`).
- **Status:** ✅ Resolvido

## Conhecidos / Não Resolvidos ⚠️

### BUG-015: View recebimentos com double-counting
- **Causa:** Parcelas pagas em full também aparecem em parcelas_pagamentos, causando contagem dupla em algumas views
- **Solução pendente:** Ajustar view para usar `NOT EXISTS` corretamente
- **Status:** ⚠️ Parcialmente resolvido (view criada com filtro, mas precisa validação)

### BUG-016: Extensão de tradução do Chrome causa erros no Supabase
- **Causa:** Chrome Translate interfere com o DOM do Supabase Dashboard
- **Workaround:** Usar aba anônima ou desativar tradução para supabase.com
- **Status:** ⚠️ Workaround (problema do Chrome, não do sistema)
