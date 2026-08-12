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

### BUG-026: Parcelas geradas erradas (taxa zerada, número de parcelas errado)
- **Causa 1 (dado errado, não código):** todos os pacotes tinham `valor_matricula = 0` (deveria ser sempre R$69,90) e `numero_parcelas = 1` (independente do nome do pacote — "1+9" tinha `numero_parcelas=1` em vez de 10, "12x" tinha 1 em vez de 12) — provavelmente zerado/perdido no reset do Supabase.
- **Solução (27/07/2026):** corrigidos os valores de todos os 6 pacotes ativos (`valor_matricula=69.90`, `numero_parcelas` batendo com o nome de cada um, `valor_total` recalculado).
- **Conferido:** `TrocarPacoteModal.tsx` já usava os campos genéricos corretamente — não precisou de mudança de código, só se beneficiou da correção dos dados.
- **Nota (28/07/2026):** o contador "Total de parcelas" na tela mostrava só as parcelas geradas pelo loop, sem contar a taxa de matrícula (ex: 1+9 mostrava "9" em vez de "10") — corrigido pra contar junto.
- **Correção adicional (28/07/2026):** o `numero_parcelas` dos pacotes de boleto ainda estava errado por interpretação equivocada do nome — "1+9" significa **10 parcelas iguais** de R$159,90 (não taxa + 9), e a taxa de R$69,90 é cobrada **à parte**, somada por cima. Corrigido: Boleto 1+6 → `numero_parcelas=7` (valor_total R$1.469,20), Boleto 1+9 → `numero_parcelas=10` (valor_total R$1.668,90, batendo com a constante `VALOR_BOLETO_TOTAL` já usada no Dashboard Aulão). Nenhum aluno de teste precisou de correção retroativa (já tinha sido excluído no teste do BUG-027).
- **Cartão — decisão de negócio (28/07/2026):** diferente do boleto, o cartão de crédito gera **uma única cobrança** com o valor total das parcelas (a operadora do cartão é quem divide em N vezes pro cliente, não o sistema) — o tratamento especial pro cartão no código do "Novo Aluno" (removido por engano nesta mesma sessão, achando que era um bug) foi **restaurado**, agora usando os dados corretos de `valor_total`/`valor_matricula`. A taxa de matrícula continua sendo uma linha separada de R$69,90.
- **Status:** ✅ Resolvido

### BUG-027: Excluir aluno dava erro de foreign key (matricula_cursos)
- **Causa:** a RPC `delete_aluno_completo` esquecia de limpar 5 tabelas relacionadas antes de apagar `matriculas`/`alunos`: `matricula_cursos`, `matricula_pacotes` (nova, criada nesta sessão), `cursos_vitrine`, `contratos`, `aluno_sessoes` — qualquer aluno com dados nessas tabelas (ou seja, praticamente todos) não conseguia ser excluído.
- **Solução (27/07/2026):** função reescrita pra limpar todas as tabelas que referenciam `alunos`/`matriculas` na ordem certa antes de excluir. `matriculas_aulao` não é apagada (é histórico de marketing/matrícula) — só desvinculada (`aluno_id = NULL`).
- **Status:** ✅ Resolvido

### BUG-028: SUPABASE_SERVICE_ROLE_KEY nunca existiu na Vercel (projeto sistemasolucoesonline)
- **Causa:** o projeto `sistemasolucoesonline` na Vercel só tinha 5 variáveis (`SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`) — a `SUPABASE_SERVICE_ROLE_KEY` nunca foi cadastrada lá. Isso quebrava qualquer endpoint que precisasse da Admin API do Supabase: `criar-acesso-aluno`, `redefinir-senha-aluno`, e (intermitentemente, dependendo de quando cada coisa foi testada) o próprio `converter-matricula-aulao`.
- **Solução (28/07/2026):** Diego pegou a chave `service_role` em Supabase → Settings → API Keys (aba "Legacy anon, service_role API keys" → Reveal) e cadastrou como `SUPABASE_SERVICE_ROLE_KEY` na Vercel (Production), com redeploy manual em seguida.
- **Status:** ✅ Resolvido

### BUG-029: Aba "Histórico" do aluno não mostrava aulas assistidas (só sessão de login)
- **Causa:** faltava a foreign key `aluno_aulas_assistidas.curso_id → cursos.id` no banco (só existia `aula_id → aulas.id`). A query do front (`select("*, cursos(nome), aulas(titulo)")`) depende dessa relação pro PostgREST conseguir montar o embed; sem ela, a consulta inteira falhava silenciosamente e a tela caía no fallback "Nenhuma aula assistida nesta sessão" pra toda sessão, mesmo com os dados certos no banco (confirmado com o CTR 1714 — 117 registros existentes, todos com `assistida_em` e matéria/aula corretos).
- **Solução (29/07/2026):** criada a FK `aluno_aulas_assistidas_curso_id_fkey` e recarregado o schema cache do PostgREST (`NOTIFY pgrst, 'reload schema'`). Nenhuma mudança de código foi necessária — a query e a tela (aba Histórico e aba Progresso) já estavam certas, só faltava a relação no banco.
- **Status:** ✅ Resolvido


### BUG-030: Nenhuma edge function estava publicada no Supabase (grave)
- **Causa:** as 15 edge functions do sistema existiam só no código-fonte (`supabase/functions/`), nunca tinham sido deployadas — `list_edge_functions` retornava vazio. Isso quebrava silenciosamente: `manage-colaboradores` (criar login de colaborador — foi o que travou ao dar acesso pra Gislaine), `asaas-cobrar` (cobrança avulsa por polo), `manage-student-access` (reset de senha de aluno), `asaas-vitrine-checkout`/`asaas-vitrine-status`/`asaas-vitrine-webhook` (compra de curso na vitrine), `asaas-webhook` (confirmação de pagamento do polo), `cancelar-boletos-migrados`/`gerar-boletos-migrados` (ferramentas de migração), `panda-video-sync`, `send-push-notification`.
- **Solução (04/08/2026):** publicadas 11 (todas com uso ativo no código). `create-aluno-auth` e `send-push` ficaram de fora (0 referências no front, prováveis legado). De brinde: corrigido mismatch de nome de campo `senha`/`password` em `manage-colaboradores` (impedia dar acesso a colaborador que ainda não tinha login) e 1 URL antiga do Lovable no webhook da vitrine.
- **Atenção:** `cancelar-boletos-migrados`, `gerar-boletos-migrados` e `panda-video-sync` têm chave de API (Asaas produção e Panda Video) hardcoded no código-fonte em vez de secret — funcionam, mas ficam expostas no repositório. `asaas-vitrine-checkout`/`status` dependem do secret `ASAAS_API_KEY_VITRINE` e `send-push-notification` do `FIREBASE_SERVICE_ACCOUNT` — não confirmado se já estão configurados no Supabase.
- **Status:** ✅ Resolvido (funções publicadas); ⚠️ segurança das chaves hardcoded pendente

### BUG-031: colaborador_permissoes/colaboradores com colunas faltando
- **Causa:** `colaborador_permissoes` faltava 6 colunas (`cadastrar_alunos`, `fazer_matriculas`, `dar_baixa_pagamentos`, `agendar_provas`, `ver_provas_agendadas`, `ver_relatorios`) e `colaboradores` faltava `responsavel_polo` — quebrava editar/criar/resetar senha de colaborador com "Edge Function returned a non-2xx status code".
- **Solução (04/08/2026):** todas as colunas recriadas.
- **Status:** ✅ Resolvido

### BUG-032: "Gerar acesso (Aulão)" falhava com "e-mail já registrado"
- **Causa:** excluir aluno (`delete_aluno_completo`) nunca apagou o login dele no Supabase Auth, só o registro em `alunos`. Depois de uma limpeza em massa de alunos, sobraram dezenas de logins órfãos (`1715@aluno.com` até `1748@aluno.com`) que colidem com o cálculo de "próximo CTR" (baseado só em `max(ctr)` da tabela `alunos`, que ficou baixo após a limpeza).
- **Solução (04/08/2026):** `converter-matricula-aulao.ts` agora tenta criar o login e, se colidir (e-mail já registrado), incrementa o CTR e tenta de novo (até 50x) em vez de falhar. Os logins órfãos em si continuam existindo (não bloqueiam mais nada, mas podem ser limpos depois via Admin API).
- **Status:** ✅ Resolvido

### BUG-033: Aluno do Aulão aparecia e sumia da lista de Alunos
- **Causa:** `converter-matricula-aulao.ts` só salvava `polo_id` na matrícula, nunca no registro do aluno em si. A tela de Alunos filtra por `alunos.polo_id`, então o aluno some sempre que o filtro de polo não está em "Todos".
- **Solução (05/08/2026):** aluno já recebe `polo_id` na criação; feito backfill do caso já afetado (Marcelo Fernando).
- **Status:** ✅ Resolvido

### BUG-034: RPC registrar_pagamento_parcela não existia
- **Causa:** usada em "Dar Baixa" (perfil do aluno e tela Financeiro), mas nunca foi criada no banco — mesma categoria dos outros bugs de "feature referenciada mas nunca criada no backend".
- **Solução (05/08/2026):** função criada — registra em `parcelas_pagamentos`, soma `valor_pago_total`, decide status pago/parcial, e pra cartão anota parcelas/taxa/valor líquido automaticamente na observação (e grava `valor_liquido` na própria parcela — ver BUG-036).
- **Status:** ✅ Resolvido

### BUG-035: Assinatura de contrato por link público completamente quebrada
- **Causa:** faltavam colunas inteiras em `contratos` (`token_unico`, `conteudo_html`, `matricula_id`, `nome_confirmacao`, `data_assinatura`, `ip_assinatura`) e as RPCs `get_contrato_publico`/`assinar_contrato_publico` nunca existiam, mesmo com a tela (`ContratoAlunoModal.tsx`, `/contrato/:token`) já pronta há tempo.
- **Solução (05/08/2026):** colunas e as duas RPCs criadas. De brinde: mais 3 URLs antigas do Lovable corrigidas no mesmo modal.
- **Status:** ✅ Resolvido

### BUG-036: Cards do Dashboard (Total Recebido/A Receber/Em Atraso) sempre R$0,00
- **Causa:** dependiam de 3 views (`view_total_recebido_mes`, `view_a_receber_mes`, `view_em_atraso`) que nunca existiam no banco — erro engolido silenciosamente pelo `.maybeSingle()` do front. Faltava também a coluna `parcelas.valor_liquido`.
- **Solução (05/08/2026):** views e coluna criadas; `registrar_pagamento_parcela` atualizada pra gravar `valor_liquido` na parcela. Depois, corrigido um segundo problema de fuso horário: as views usavam `CURRENT_DATE` (UTC do servidor), que à noite já considera "hoje" um dia à frente do horário de Brasília — fazendo parcela vencendo hoje contar como atrasada. Trocado por `(now() AT TIME ZONE 'America/Sao_Paulo')::date` nas 3 views.
- **Status:** ✅ Resolvido

### BUG-037: "Total de Matrículas" no Dashboard maior que o total de alunos
- **Causa:** a tela "Novo Aluno" (`MatriculaFlow.tsx`) sempre criava uma matrícula nova ao salvar financeiro/pacote, mesmo quando o aluno já tinha uma (ex: criada automaticamente pelo Aulão, só com acesso) — gerando duas matrículas por aluno (uma vazia + uma com o financeiro real).
- **Solução (05/08/2026):** consolidados no banco os casos já existentes (parcelas/comissões/pacote movidos pra matrícula original, duplicata removida); `MatriculaFlow.tsx` corrigido pra reaproveitar a matrícula existente do aluno em vez de duplicar.
- **Status:** ✅ Resolvido

### BUG-038: Menu Pós-Venda nunca mostrava matrícula nova
- **Causa:** a tela só gerenciava registros de `pos_vendas` já existentes — nada no sistema (nem trigger, nem código) jamais criava esses registros quando uma matrícula era feita.
- **Solução (05/08/2026):** implementados 2 triggers. `criar_pos_venda_nova_matricula` semeia o 1º Pós-Venda 1 dia após a matrícula. `criar_proximo_pos_venda` semeia a próxima etapa quando a anterior é marcada concluída (2º = 5 dias após a confirmação do 1º; 3º = 10 dias após a confirmação do 2º — se não confirmado, a etapa atual continua aparecendo indefinidamente). Feito backfill do 1º Pós-Venda pras matrículas já existentes sem nenhum registro.
- **Status:** ✅ Resolvido

### BUG-039: Área do Aluno (Financeiro) não mostrava nenhuma parcela (aberta ou paga)
- **Causa:** `src/routes/_student.aluno.financeiro.tsx` faz `select("id, asaas_customer_id")` na tabela `alunos`, mas a coluna `asaas_customer_id` nunca existia no banco — mesma categoria dos outros bugs de "coluna referenciada no código mas nunca criada". O `select` falhava, `aluno` vinha `null`, e o passo seguinte (`.eq("aluno_id", aluno.id)`) lançava exceção — a query inteira caía em erro silencioso e a tela sempre mostrava "Nenhuma cobrança encontrada", mesmo com parcelas existindo no banco. Mesma coluna também é usada (e seria afetada) pela edge function `asaas-cobrar` e por `src/services/asaas.ts` ao cachear o customer do Asaas.
- **Solução (05/08/2026):** coluna `alunos.asaas_customer_id` (text) criada. Nenhuma mudança de código foi necessária — a tela já tinha toda a lógica pronta (cards Pago/Em Aberto/Total do Contrato, tabela de parcelas com status, botão "Ver PDF do Boleto" que abre `parcelas.asaas_url`, botões "Gerar Boleto"/"Gerar PIX" quando a parcela ainda não tem cobrança gerada).
- **Status:** ✅ Resolvido

### BUG-040: Financeiro admin (Recebimentos/A Receber/Relatório de Vendas) com dados faltando
- **Recebimentos por Período (sempre vazio):** dependia da view `view_recebimentos_periodo`, que nunca existia no banco.
- **A Receber (faltavam parcelas de Margie e Gleci):** causa raiz dupla. (1) `EditarParcelas` (`_admin.alunos.$id.editar.tsx`, botão de adicionar parcela avulsa) nunca gravava `polo_id` na parcela nova — a parcela de cartão da Margie (R$1.438,80) tinha `polo_id` nulo e o filtro de polo da tela a excluía. (2) Nenhuma tela de "A Receber" trava por isso normalmente, mas ficou registrado pra não repetir.
- **Relatório de Vendas (vendas do Diego/admin não apareciam):** `converter-matricula-aulao.ts` (fluxo público `/matricula`) nunca gravava `colaborador_id` na matrícula — não tem seleção de vendedora no checkout público. A seção "Vendas por Vendedora" só soma matrículas com `colaborador_id` preenchido, então toda venda do Aulão ficava de fora do relatório.
- **Solução (05/08/2026):** view `view_recebimentos_periodo` criada (join `parcelas_pagamentos` → `parcelas` → `matriculas` → `alunos`). `EditarParcelas` corrigido pra herdar `polo_id` da matrícula ao criar parcela avulsa. `converter-matricula-aulao.ts` corrigido pra gravar `colaborador_id` = Diego (vendedor padrão do Aulão, já que o checkout público não escolhe vendedora). Backfill: todas as matrículas com `colaborador_id` nulo (7 alunos) atualizadas pra Diego; as 2 parcelas com `polo_id` nulo (ambas da Margie) corrigidas herdando o polo da matrícula.
- **Status:** ✅ Resolvido

### BUG-041: Dashboard/Financeiro misturava taxa de matrícula com recebimento de parcelas
- **Pedido do Diego:** taxa de matrícula (reinvestimento em tráfego) precisa ficar separada do total recebido de parcelas — é o valor que ele usa no fechamento com o responsável de cada polo, e taxa não entra nessa conta.
- **Solução (05/08/2026):** `view_total_recebido_mes` agora exclui `tipo = 'taxa_matricula'` (fica só parcelas). Nova view `view_taxas_recebidas_mes` soma só as taxas do mês. Dashboard e Financeiro ganharam um card novo "Taxas de Matrícula no Mês" ao lado de "Recebido de Parcelas no Mês". Cálculo por polo (`statsByPolo`, hoje oculto no Dashboard) também ajustado pra excluir taxa.
- **Achado no caminho:** a taxa de R$69,90 da Margie Dewites (paga 04/08) estava classificada como `tipo='parcela'` em vez de `tipo='taxa_matricula'` (inconsistência pontual, provavelmente lançamento manual) — corrigida a pedido do Diego.
- **Status:** ✅ Resolvido

### BUG-042/043: Área do Aluno — trocar de aula sempre voltava pra Aula 01 (cursos migrados pro YouTube)
- **Sintoma:** aluno assiste a Aula 01, clica na Aula 02 (ou qualquer outra), e o player volta a tocar a Aula 01 de novo. Reportado no curso de Português, mas afeta em algum grau todos os cursos migrados do Panda pro YouTube (praticamente todos: Biologia, Filosofia, Física, Geografia, História, Inglês, Matemática, Português, Química, Sociologia).
- **Causa:** os cursos migrados usam um embed de playlist do YouTube (`youtube.com/embed/videoseries?list=...&index=N`), onde `N` é a posição da aula dentro da playlist. Duas causas empilhadas: (1) o `<iframe>` que toca o vídeo, em `_student.aluno.curso.$id.tsx`, não tinha `key` — então ao trocar de aula, o React reaproveitava o mesmo elemento `<iframe>` só trocando o atributo `src`, sem forçar navegação nova. (2) Mesmo depois de corrigir isso com `key` (forçando remount completo), o Diego confirmou em teste real (com hard refresh) que o problema continuava — o parâmetro `?index=N` na URL de um embed de playlist do YouTube é, na prática, não confiável mesmo numa carga 100% nova do iframe: o player às vezes simplesmente ignora e começa do vídeo 1.
- **Solução (05/08/2026):**
  1. `key={activeAula?.id}` em todos os `<iframe>` do player (YouTube playlist, YouTube avulso, Vimeo, Pandavideo) — força remount completo a cada troca de aula.
  2. Reforço via API: `useVideoProgress` (hook `use-video-progress.ts`) ganhou o parâmetro `youtubePlaylistIndex`. Quando o vídeo é de uma playlist, o hook manda o comando `playVideoAt` pela IFrame API do YouTube via `postMessage` (3 tentativas, em 1.2s/2s/3s depois do handshake `listening`), forçando o player a pular pro índice certo mesmo se o parâmetro da URL for ignorado.
- **Status:** ✅ Resolvido — Diego confirmou que funcionou após o reforço via `playVideoAt`. Verificação cruzada nos 10 cursos migrados (Biologia, Filosofia, Física, Geografia, História, Inglês, Matemática, Português, Química, Sociologia): nenhum tem `ordem` duplicado ou com buraco na sequência dentro da faixa migrada pro YouTube — a correção (feita em componente/hook compartilhado) vale pra todos igual, não precisou de ajuste curso a curso

### BUG-044: "Monitorar ao vivo" do Webinar renderizava a lista em vez do painel de acompanhamento
- **Sintoma:** ao clicar em "Monitorar ao vivo" (ícone de pessoas) na lista de Webinars, a URL mudava pra `/webinars/:id` e o título da aba ficava certo ("Monitorar Webinar"), mas o conteúdo mostrado na tela continuava sendo a própria lista de webinars — parecia que o clique "não abria a janela".
- **Causa:** o arquivo da lista (`_admin.webinars.tsx`) não seguia a convenção de nomenclatura usada no resto do sistema (que usa sufixo `.index.tsx` pra páginas de lista, ex: `_admin.alunos.index.tsx`). Sem esse sufixo, o TanStack Router tratava esse arquivo como **layout-pai** de `/webinars/$id` e `/webinars/$id/depoimentos` — só que o componente da lista não tinha um `<Outlet />` reservado pra renderizar a rota filha dentro dele. Resultado: a rota filha era corretamente casada (por isso o título vinha certo, do `head()` dela), mas nunca tinha onde ser desenhada na tela — só a lista (rota-pai) aparecia.
- **Solução (05/08/2026):** renomeado `_admin.webinars.tsx` → `_admin.webinars.index.tsx` (mesmo padrão do resto do sistema), o que remove a relação pai/filho acidental — `/webinars`, `/webinars/$id` e `/webinars/$id/depoimentos` passam a ser rotas irmãs, todas filhas diretas do layout `_admin.tsx` (que já tem `<Outlet />` correto). `routeTree.gen.ts` regenerado do zero rodando o build completo do projeto (clone + `npm install` + `vite build`), não editado manualmente, pra garantir consistência. Testado ao vivo no navegador: o painel abre corretamente agora, com dados reais.
- **Status:** ✅ Resolvido

### BUG-045: Webhook do Asaas se desativava sozinho no painel do Asaas (pagamentos não confirmavam no sistema)
- **Sintoma:** Diego via no painel do Asaas que a "sincronização" do webhook aparecia como interrompida. Ele reativava, uma fila de eventos pendentes aparecia e processava, mas pouco depois a sincronização voltava a ficar interrompida sozinha — enquanto isso, alunos que pagavam (Aulão) não tinham o pagamento refletido no sistema.
- **Causa:** o Asaas tem um mecanismo automático de proteção: se o endpoint do webhook responder erro (qualquer status HTTP fora da faixa 2xx) repetidas vezes, ele desativa a sincronização sozinho pra não ficar tentando entregar pra um endpoint que parece estar quebrado. Os dois endpoints (`asaas-webhook-aulao.ts`, usado no Aulão, e a edge function `asaas-webhook`, usada pelas parcelas dos alunos matriculados) respondiam com erro HTTP 500 sempre que um erro interno acontecia ao salvar no banco (mesmo um erro raro e pontual) — e alguns desses erros pontuais foram suficientes pra disparar a proteção automática do Asaas.
- **Solução (05/08/2026):** os dois webhooks agora **sempre respondem 200 pro Asaas**, mesmo quando um erro interno acontece — o erro fica só registrado no log (`console.error`) pra investigação, mas nunca é repassado como falha de entrega pro Asaas. Isso segue a prática recomendada pra endpoints de webhook (confirmar recebimento rápido, tratar erros internamente). Deploy feito tanto no Vercel (`asaas-webhook-aulao.ts`) quanto na edge function do Supabase (`asaas-webhook`, redeployada manualmente — essa não sobe sozinha só com o push no GitHub).
- **Ação pendente do Diego:** reativar a sincronização do webhook mais uma vez no painel do Asaas (a última vez, depois disso não deve mais cair sozinha).
- **Status:** ✅ Resolvido — aguardando o Diego confirmar que não caiu mais depois de reativar uma última vez

## Conhecidos / Não Resolvidos ⚠️

### BUG-015: View recebimentos com double-counting
- **Causa:** Parcelas pagas em full também aparecem em parcelas_pagamentos, causando contagem dupla em algumas views
- **Solução pendente:** Ajustar view para usar `NOT EXISTS` corretamente
- **Status:** ⚠️ Parcialmente resolvido (view criada com filtro, mas precisa validação)

### BUG-016: Extensão de tradução do Chrome causa erros no Supabase
- **Causa:** Chrome Translate interfere com o DOM do Supabase Dashboard
- **Workaround:** Usar aba anônima ou desativar tradução para supabase.com
- **Status:** ⚠️ Workaround (problema do Chrome, não do sistema)
