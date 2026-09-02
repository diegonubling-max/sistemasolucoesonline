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

### BUG-046: Erro ao gerar boleto/PIX mostrava só "Edge Function returned a non-2xx status code" (sem dizer o motivo real)
- **Sintoma:** ao tentar gerar boleto/PIX pra uma parcela (ex: aluna Francine, CTR 1741) que ainda não tinha cobrança no Asaas, o sistema mostrava só essa mensagem genérica, sem indicar o motivo real do erro.
- **Causa:** `supabase.functions.invoke()` (usado em `generateAsaasCobrar`, `src/services/asaas.ts`) só extrai automaticamente uma mensagem genérica quando a Edge Function responde com erro (status fora de 2xx) — o motivo real, que a função `asaas-cobrar` monta com cuidado (ex: "Erro ao criar cobrança: [motivo específico do Asaas]", problema no cadastro do aluno, chave da API do polo faltando, etc), fica no corpo (JSON) da resposta, em `error.context`, e o código não estava lendo esse corpo.
- **Solução (12/08/2026):** `generateAsaasCobrar` agora lê `error.context` e extrai a mensagem real do corpo da resposta antes de mostrar o erro pro usuário — a mensagem genérica só aparece como último recurso, se o corpo não puder ser lido.
- **Status:** ✅ Resolvido (a extração da mensagem foi corrigida; falta o Diego tentar gerar o boleto da Francine de novo pra a gente ver o motivo real do erro original e corrigir a causa raiz, se for algo além de mensagem genérica)

### BUG-047: Erro real ao gerar boleto de parcela já vencida (causa raiz do caso da Francine, CTR 1741)
- **Sintoma:** ao gerar boleto (ou PIX) pela 1ª vez pra uma parcela cuja data de vencimento já passou, dava erro. Antes do BUG-046 ser corrigido, o sistema só mostrava a mensagem genérica "Edge Function returned a non-2xx status code" — depois do BUG-046, passou a mostrar a mensagem real: "Erro ao criar cobrança: Não é permitido data de vencimento inferior a hoje."
- **Causa:** a edge function `asaas-cobrar` mandava a `data_vencimento` original da parcela pro Asaas sem checar se já tinha passado. O Asaas rejeita a criação de qualquer cobrança (boleto ou PIX) com `dueDate` no passado — mesmo pra parcelas legitimamente atrasadas.
- **Solução (12/08/2026):** se `data_vencimento` da parcela já passou, `asaas-cobrar` agora manda a data de **hoje** pro Asaas na criação da cobrança — a `data_vencimento` da parcela no banco **não muda**, continua com a data original, então os relatórios de "em atraso" continuam corretos. Instrumentação temporária de debug (tabela `debug_logs`) usada só pra diagnosticar esse caso já foi removida do código da função (a tabela ficou no banco, pode ser reaproveitada em debugs futuros).
- **Impacto:** no momento da correção, havia 3 outras parcelas na mesma situação (vencidas, sem cobrança gerada ainda) — agora também podem ter boleto/PIX gerado normalmente.
- **Status:** ✅ Resolvido

### BUG-048: Cadastro manual falhava em criar o acesso quando o e-mail já tinha login órfão ("A user with this email address has already been registered")
- **Sintoma:** ao cadastrar um aluno manualmente ("Novo Aluno"), aparecia o toast "Aluno salvo, mas erro ao criar acesso: A user with this email address has already been registered", mas o fluxo continuava normalmente pras próximas etapas (cursos, contrato) sem mais nenhum erro. No final, tudo parecia ter dado certo (aluno, matrícula, parcelas e contrato salvos) — só que o aluno **não conseguia fazer login**, porque a conta de acesso nunca foi criada nem corrigida.
- **Caso real:** Iosney Andrade Feitosa (CTR 1749) — existia uma conta em `auth.users` com o e-mail `1749@aluno.com` desde 05/08 (sobra órfã de uma tentativa de cadastro anterior que não deu certo), sem nenhum aluno correspondente. Ao recadastrar ela em 12/08, o e-mail colidiu com essa conta órfã, `criar-acesso-aluno` desistiu, e o resto do fluxo (matrícula, parcelas, cursos, contrato) seguiu e salvou normalmente, deixando a impressão de que só faltou "salvar o aluno" — na real faltou só o acesso.
- **Causa:** `criar-acesso-aluno.ts` só tentava `auth.admin.createUser` uma vez; se desse erro de e-mail duplicado, retornava erro e nunca tentava reaproveitar a conta existente.
- **Solução (12/08/2026):** quando o erro é de e-mail já registrado, a função agora localiza a conta existente pelo e-mail (mesma técnica já usada em `redefinir-senha-aluno.ts`) e atualiza a senha dela pra senha atual, em vez de desistir — o aluno passa a ter acesso funcionando de qualquer forma. `user_roles` também passou a checar se já existe antes de inserir (evita duplicar).
- **Correção pontual:** senha da Iosney (CTR 1749, e-mail `1749@aluno.com`) corrigida direto no banco (`1234iosney`) — login já está funcionando.
- **Status:** ✅ Resolvido

### BUG-049 (grave): CTR duplicado entre dois alunos diferentes — dois caminhos de geração de CTR fora de sincronia
- **Como foi descoberto:** Diego perguntou por que a Iosney (recadastrada manualmente em 12/08) ficou com CTR 1749 em vez de 1756 (sequência depois do Wendel, CTR 1755).
- **Causa raiz:** existem dois jeitos diferentes de gerar CTR no sistema, que nunca estiveram sincronizados:
  1. Cadastro manual ("Novo Aluno", `MatriculaFlow.tsx`) — usa o trigger `trg_ajustar_ctr` do banco, que puxa de `nextval('alunos_ctr_seq')`.
  2. Conversão do Aulão (`converter-matricula-aulao.ts`) — calculava `SELECT MAX(ctr)+1 FROM alunos` manualmente e inseria o CTR explícito, **sem nunca tocar na sequence**.
  Como o Aulão é o fluxo mais usado ultimamente, ele foi avançando o "maior CTR real" (até 1755) sem a sequence saber — a sequence ficou parada lá atrás (~1748). Quando o cadastro manual (via trigger/sequence) foi usado de novo, ele devolveu um número menor que já tinha sido "pulado" pelo outro caminho.
  Sem isso, ainda seria só um número fora de ordem, inofensivo — só que a tabela `alunos` **nunca teve uma constraint de unicidade no CTR**, e isso já causou uma colisão real: **Cristina Aparecida Costa e Gracilene da Conceição Madeira de Carvalho ficaram com o mesmo CTR (1750) e o mesmo login (`1750@aluno.com`)**, a Gracilene pegando o CTR pelo caminho do trigger logo depois da correção da Iosney.
- **Efeito colateral:** a correção do BUG-048 (feita mais cedo na mesma sessão, que reaproveita conta de e-mail já registrado) tratou essa colisão real como se fosse uma "conta órfã" e **sobrescreveu a senha da Cristina** com a senha gerada pra Gracilene — sem querer, quebrando o acesso dela.
- **Solução (12/08/2026):**
  1. Senha da Cristina restaurada (`1234cristina`) — acesso dela voltou ao normal.
  2. Gracilene recebeu um CTR novo e correto (1756) e um login próprio criado do zero (`1756@aluno.com` / `1234gracilene`).
  3. `alunos.ctr` ganhou uma constraint **UNIQUE** — trava de vez contra qualquer duplicidade futura, mesmo que outro bug de geração apareça.
  4. A sequence `alunos_ctr_seq` foi sincronizada com o maior CTR realmente em uso.
  5. Criada a função `proximo_ctr_aluno()` (puxa da mesma sequence, pulando terminados em 13) — **os dois fluxos agora usam a mesma fonte**. `converter-matricula-aulao.ts` não calcula mais `MAX(ctr)+1` manualmente, chama essa função.
- **Status:** ✅ Resolvido

### BUG-050: Pagamento confirmado no Asaas não deu baixa automática — caso da Gleci (CTR 1721)
- **Sintoma:** aluna paga o boleto (Gleci, parcela 1, dia 12/08), mas a parcela continuou aparecendo como "aberto" no sistema.
- **Diagnóstico:** consultei a cobrança direto na API do Asaas (usando `pg_net` do próprio Postgres, já que os logs de edge function do Supabase estavam com falha técnica na hora) — o Asaas confirma `status: RECEIVED`, `paymentDate: 2026-08-12`, `externalReference` batendo com o id da parcela certinha. Ou seja: o pagamento existe e está corretamente vinculado, mas o **webhook de confirmação nunca chegou** no sistema (mesma causa-raiz de fundo do BUG-045: a sincronização do webhook no painel do Asaas cai sozinha depois de falhas de entrega — mesmo já corrigido pra sempre responder 200, pode ter caído numa janela antes do fix, ou por outro motivo pontual do lado do Asaas).
- **Verificação:** rodei a mesma consulta pra todas as outras parcelas com boleto gerado e ainda "aberto" no sistema (Marcia Adriana Barbosa Machado CTR 1751, Francine Eliseu Serafim CTR 1741) — as duas realmente **não pagaram ainda** (Asaas confirma `OVERDUE`), não é o mesmo problema. Só a Gleci estava com pagamento perdido.
- **Solução pontual:** parcela da Gleci corrigida manualmente (status pago, data 12/08, valor líquido).
- **Solução estrutural (12/08/2026):** a ação "fetch" (usada no botão de verificar/atualizar cobrança) do `asaas-cobrar` só atualizava o link do boleto/PIX — nunca conferia se o Asaas já mostrava a cobrança como paga. Agora, toda vez que essa ação roda e o Asaas diz que já foi recebida, a parcela é marcada como paga também — funciona como uma segunda camada de segurança além do webhook, útil pra casos futuros em que a sincronização do Asaas falhar de novo.
- **Reforço adicional (mesma sessão, resposta à pergunta "vai acontecer com outros que ainda vão vencer?"):** criada `reconciliar-pagamentos` (edge function nova), agendada via `pg_cron` pra rodar toda manhã (6h Brasília) — confere automaticamente TODA parcela em aberto com cobrança já gerada, direto na API do Asaas, e dá baixa sozinha se já estiver paga. Cobre qualquer aluno futuro na mesma situação da Gleci, sem precisar de ninguém notar o problema. Testada rodando manualmente antes de agendar (2 parcelas verificadas, 0 corrigidas — as duas realmente ainda não pagas).
- **Status:** ✅ Resolvido (caso pontual + reforço estrutural + reconciliação automática diária). Deploy manual da função feito (v4)

### BUG-051: Voucher não aparecia na coluna nova (Matrículas Aulão) mesmo quando digitado
- **Sintoma:** aluno preenchia o voucher (certo ou errado) no `/matricula`, mas a coluna "Voucher" continuava mostrando "—".
- **Causa:** `voucher_code`/`voucher_aplicado` só eram salvos no `matriculas_aulao` no momento de **gerar o pagamento** de verdade (clicar em PIX/Cartão), não quando a pessoa preenchia e avançava. Se o teste (ou o próprio aluno) parasse no botão "Finalizar" sem chegar a gerar o pagamento, o voucher nunca era gravado.
- **Solução (05/08/2026):** `voucher_code` e `voucher_aplicado` agora são salvos junto com `forma_pagamento`, no mesmo momento (botão "Finalizar" do step 2).
- **Status:** ✅ Resolvido

### BUG-052: link do webinar abria o YouTube no navegador em vez do app, no Android
- **Sintoma:** ao ser liberado na "portaria" do webinar, no iPhone o link já abria certo no app do YouTube; no Android, abria no navegador.
- **Causa:** um link `https://` comum pro YouTube nem sempre abre no app no Android (depende de configuração do aparelho); no iOS já funciona via Universal Links.
- **Solução (05/08/2026):** detecção de Android via `navigator.userAgent`; nesse caso o link é montado no formato `intent://` (força abrir no app do YouTube instalado, com fallback pro navegador se não tiver o app). iOS continua com o link `https://` normal.
- **Status:** ✅ Resolvido

### BUG-053: player interno do webinar (aula gravada) — vídeo sumia da tela no mobile ao comentar
- **Sintoma:** no navegador do WhatsApp (in-app browser) no iPhone, ao tocar no campo de comentário pra digitar, o vídeo "subia" e desaparecia da visão.
- **Causa:** a tela usava `min-h-screen` (100vh fixo) — quando o teclado do celular abria, o espaço realmente visível diminuía, mas a altura da página continuava "grande demais", e o navegador rolava a tela toda pra mostrar o campo de texto, levando o vídeo junto pra fora.
- **Solução (05/08/2026):** trocado pra `h-dvh` (altura dinâmica, que já considera o teclado aberto) + `overflow-hidden` no container principal, com o vídeo travado numa altura fixa (`shrink-0`) — só a lista de comentários rola internamente agora, o vídeo fica parado no lugar. De brinde, a rotação automática pra paisagem em tela cheia dentro do navegador do WhatsApp é uma limitação do próprio app (in-app browser), não resolvível 100% pelo código — abrir no Safari/Chrome resolve.
- **Status:** ✅ Resolvido (layout) / ⚠️ limitação de plataforma (rotação em tela cheia dentro do WhatsApp)

### BUG-054: Sem áudio e sem como ativar, depois de travar os controles do YouTube (BUG do ajuste anterior)
- **Sintoma:** ao travar o player pra impedir avançar o vídeo (`controls=0`), o aviso "clique no vídeo pra ativar o áudio" parou de funcionar — sem os controles nativos do YouTube visíveis, não sobrou nenhum botão de volume pra clicar.
- **Causa:** consequência direta da trava anterior — `controls=0` esconde literalmente todos os controles do player, incluindo o de volume, mas o vídeo continua começando mudo (regra dos navegadores pra autoplay).
- **Solução (12/08/2026):** botão próprio "🔇 Ativar áudio" sobreposto no canto do vídeo (nos dois modos, ao vivo e gravado) — desaparece assim que clicado. No modo gravado usa a API do player (`unMute`/`setVolume`); no modo ao vivo manda o comando via `postMessage` pro iframe (precisou adicionar `enablejsapi=1` na URL do embed, que não estava lá).
- **Status:** ✅ Resolvido

### BUG-055 (crítico): tela travava com "Something went wrong!" logo depois de entrar na aula
- **Sintoma:** aluno preenchia nome e telefone pra entrar no webinar e, assim que era liberado, a tela toda quebrava mostrando o erro genérico do framework ("Something went wrong! Show Error"), em vez do player/chat.
- **Causa:** na correção anterior (BUG-054, botão "Ativar áudio"), dois hooks do React (`useRef` e `useState` pro controle do áudio) foram declarados **depois** de vários `return` condicionais da tela (aula não encontrada, bloqueado, aguardando início, tela de entrada, agendado, encerrado). Isso viola uma regra fundamental do React: hooks têm que ser chamados sempre na mesma ordem, em todo render, nunca depois de um retorno condicional. Enquanto a pessoa estava na tela de entrada (preenchendo nome/telefone), esses hooks nunca chegavam a ser executados; assim que ela era liberada e o componente tentava renderizar o player, a ordem dos hooks mudava de um render pro outro — o React detecta isso e quebra a tela inteira, sempre, de forma garantida (não é intermitente).
- **Solução (12/08/2026):** os dois hooks foram movidos pro topo do componente, junto com todos os outros — antes de qualquer `return` condicional.
- **Status:** ✅ Resolvido

### BUG-056: Botão "Depoimentos" do webinar abria a mesma tela do "Monitorar ao vivo"
- **Sintoma:** clicar no botão de Depoimentos (`/webinars/:id/depoimentos`) mostrava exatamente a mesma tela do Monitorar — sem dar pra ver os depoimentos reais que os alunos foram escrevendo ao vivo durante a aula original (usados depois pra sincronizar com o replay).
- **Causa:** o mesmo padrão do BUG-044, numa camada mais funda: `_admin.webinars.$id.tsx` (a tela de monitoramento) não seguia a convenção `.index.tsx`, então o TanStack Router passou a tratá-la como **layout-pai** de `_admin.webinars.$id.depoimentos.tsx` — e como a tela de monitoramento não tem `<Outlet />`, a rota de Depoimentos nunca tinha onde ser desenhada, então só a tela do Monitorar aparecia (mesmo a URL e o título mudando certinho).
- **Solução (12/08/2026):** renomeado `_admin.webinars.$id.tsx` → `_admin.webinars.$id.index.tsx` (mesmo padrão de `_admin.alunos.$id.index.tsx`), removendo a relação pai/filho acidental — `/webinars/$id` e `/webinars/$id/depoimentos` viram rotas irmãs, ambas filhas diretas do layout `_admin.tsx`. `routeTree.gen.ts` regenerado rodando o build completo do projeto, não editado à mão.
- **Status:** ✅ Resolvido

### BUG-057 (CRÍTICO — falha de segurança real): alunos com acesso a dados de admin
- **Como foi descoberto:** a aluna Marli mandou print mostrando que estava conseguindo acessar o sistema como admin.
- **Causa raiz:** as tabelas `alunos`, `matriculas`, `parcelas`, `user_roles` e `matriculas_aulao` tinham uma regra de segurança do banco (`RLS policy`) chamada `authenticated_full_access` com a condição `true` — ou seja, **qualquer usuário logado no sistema (inclusive um aluno) tinha leitura E escrita completa em TODOS os registros de TODOS os alunos**, não só os próprios. A proteção que existia (o "guard" que redireciona quem não é admin/colaborador) era só na tela — roda no navegador, depois que a página já carregou — e não protegia as consultas que o app faz direto no banco.
- **Gravidade extra:** a mesma falha valia pra tabela `user_roles` (que define quem é admin) — na teoria, um aluno poderia ter feito uma chamada direta pra se auto-promover a admin. Testei esse cenário especificamente depois da correção e confirmei que agora é bloqueado.
- **Solução (18/08/2026):**
  - Criadas duas funções auxiliares no banco (`is_admin()`, `is_admin_or_staff()`) que checam se quem está logado é admin ou colaborador.
  - `alunos`, `matriculas`, `parcelas`, `matriculas_aulao`: staff (admin/colaborador) mantém acesso total; aluno passa a só enxergar/editar os **próprios** registros (batendo pelo e-mail — mesmo padrão que as próprias telas do aluno já usavam pra buscar os dados).
  - `user_roles`: só admin pode ler/escrever tudo; qualquer usuário só enxerga a própria linha, e **ninguém além de admin consegue mais escrever nessa tabela pela API** (a criação de acesso de aluno já usava a chave de serviço do servidor, que não passa pela RLS — não foi afetada).
- **Testes feitos antes de considerar resolvido:**
  1. Simulei o login de uma aluna real: só via 1 aluno (ela mesma) em vez de todos.
  2. Tentei fazer essa aluna se promover a admin via `user_roles` — bloqueado pela regra do banco.
  3. Confirmei que ela ainda vê certinho as próprias parcelas (financeiro dela não quebrou).
  4. Confirmei que o Diego (admin) continua vendo todos os 28 alunos normalmente.
- **Status:** ✅ Resolvido — mas recomendo fortemente **pedir pra Marli confirmar** que não consegue mais acessar nada de admin, e trocar a senha dela por precaução.

### BUG-058: enviar_boas_vindas_aulao_pendentes() quebrada por credencial fixa do Z-API no SQL
- **Sintoma:** aparente ao testar o novo número do Z-API (19/08/2026) — a função de boas-vindas do Aulão não checava o interruptor "Boas-vindas ao matricular" e tinha o Client-Token ANTIGO do Z-API fixo direto no código SQL, que ficou inválido assim que o Diego gerou um Client-Token novo.
- **Causa:** a função `enviar_boas_vindas_aulao_pendentes()` chamava a API do Z-API diretamente, com URL/credenciais fixas no `CREATE FUNCTION` — nunca em sincronia com o que estava configurado na Vercel.
- **Solução (19/08/2026):** a função agora chama o próprio endpoint `/api/public/hooks/zapi-send` do sistema (que lê as credenciais das variáveis de ambiente da Vercel, sempre atualizadas), e passou a checar o interruptor `zapi_disparo_boas_vindas` antes de mandar (não checava antes).
- **Status:** ✅ Resolvido — testado com envio real (liguei o interruptor temporariamente, mandei pra um número de teste, confirmei recebimento, desliguei de volta)

### BUG-059: 3 dos 10 disparos automáticos de WhatsApp nunca funcionavam de verdade
- **Como foi descoberto:** pedido do Diego pra testar se todas as opções de "Disparos WhatsApp" (Configurações) estavam funcionando.
- **Achados:**
  1. **"Confirmação de pagamento"** nunca era chamada em NENHUM lugar do código — nem na tela de "Dar Baixa", nem nos webhooks do Asaas. O interruptor existia na tela, mas não tinha efeito nenhum porque não tinha nada ligado a ele.
  2. **"Lembrete 3 dias antes do vencimento"** e **"Aviso de atraso"** (endpoint `whatsapp-cobranca.ts`) mandavam a mensagem sempre, **ignorando completamente** o estado do interruptor — diferente do padrão usado no resto do sistema (`zApiService.ts`), que sempre checa o interruptor antes de mandar.
- **Solução (19/08/2026):**
  1. "Confirmação de pagamento" agora dispara no momento real da baixa manual de uma parcela (`_admin.alunos.$id.editar.tsx`).
  2. `whatsapp-cobranca.ts` passou a checar os interruptores `zapi_disparo_lembrete_vencimento` e `zapi_disparo_aviso_atraso` antes de mandar cada tipo de mensagem.
- **Achado maior, à parte (mesma investigação):** 6 dos 10 disparos (`nunca_acessou`, `4_dias_sem_acessar`, `sabado`, `domingo`, `lembrete_vencimento`, `aviso_atraso`) **nunca rodavam sozinhos** porque não existia nenhum `pg_cron` chamando os endpoints `zapi-jobs-diarios` e `whatsapp-cobranca` — o código sempre esteve certo (na maior parte), só faltava alguém "apertar o play" todo dia. Agendados agora: `whatsapp-cobranca-diario` (9h Brasília) e `zapi-jobs-diarios` (9h15, roda por grupo de CTR pra distribuir os disparos ao longo dos 10 dias).
- **Testado com envio real:** rodei os dois endpoints manualmente — `whatsapp-cobranca` mandou avisos reais pra alunos com parcela atrasada, `zapi-jobs-diarios` mandou mensagens reais de "nunca acessou" pro grupo de teste. Confirmei depois, com o log (`zapi_mensagens_log`), que o toggle desligado bloqueia o envio corretamente.
- **Incidente durante o teste:** testei `whatsapp-cobranca` rápido demais na primeira vez (antes do deploy da correção terminar de verdade no Vercel) — isso fez o código ANTIGO (sem checagem de interruptor) rodar uma vez e mandar 3 avisos de atraso reais pra alunos de verdade, mesmo com o interruptor desligado nas configurações. Já avisei o Diego. Reforça a lição: sempre esperar o deploy terminar antes de testar endpoints que enviam mensagens reais.
- **Confirmados OK desde antes (sem bug):** `agendamento_prova` (dispara ao agendar a prova) e `motivacional_primeiro_login` (dispara no primeiro login do aluno) — os dois já checavam o interruptor corretamente.
- **Status:** ✅ Resolvido — todos os 10 interruptores hoje estão desligados por decisão do Diego; o código e os agendamentos estão prontos, só falta ligar os que ele quiser usar

### BUG-060: "Sábado"/"Domingo" e outros disparos automáticos nunca funcionavam de verdade — 3 causas empilhadas
- **Como foi descoberto:** continuação da auditoria dos disparos automáticos, testando "Sábado" especificamente com o interruptor ligado.
- **Causas encontradas, uma atrás da outra:**
  1. `zapi-jobs-diarios.ts` buscava a mensagem do dia numa tabela (`zapi_mensagens_fds`) usando nomes de coluna que não existem (`dia`, `assistiu`) — o nome real é `dia_semana`/`tipo`. A busca sempre voltava vazia, então nunca tinha mensagem pra mandar.
  2. O placeholder do nome no texto da mensagem usava `{nome}` no banco, mas o código só substituía `[nome]` (colchetes) — nunca batia.
  3. A função de envio compartilhada (`zApiService.ts`) usava uma URL relativa (`/api/...`) pro endpoint que manda a mensagem de verdade — funciona certinho quando chamada do navegador, mas falha em silêncio quando chamada de dentro de um cron do servidor (que é exatamente o caso do sábado/domingo/nunca-acessou/4-dias). Além disso, o registro de log (`zapi_mensagens_log`) tentava gravar numa coluna (`erro_detalhe`) que também não existia, escondendo até o erro.
- **Solução (19/08/2026):** todas as 3 causas corrigidas juntas na reconstrução da fundação (ver item "Fundação dos disparos WhatsApp reconstruída" em 09_FEATURES.md) — nomes de coluna certos, placeholder `{nome}`, URL sempre absoluta, coluna `erro_detalhe` criada.
- **Status:** ✅ Resolvido (correção de código). ⚠️ Ainda não reconfirmado com um envio real de "Sábado"/"Domingo" depois da correção — próximo passo da auditoria

### BUG-061 (crítico): "Dar Baixa" quebrava sempre com erro de banco
- **Como foi descoberto:** ao testar o disparo #1 (Confirmação de pagamento) usando a tela real de "Dar Baixa".
- **Causa:** o código pegava o objeto inteiro vindo do formulário (`BaixaModal`) e jogava direto num `.update()` da tabela `parcelas`, incluindo campos que não são colunas reais dessa tabela (`valor_pago`, `parcelas_cartao`, `taxa_cartao` — os nomes certos são `valor_pago_total` e `valor_liquido`). Isso quebrava a baixa **sempre**, com a mensagem "Could not find the 'valor_pago' column of 'parcelas'".
- **Solução (19/08/2026):** mapeados explicitamente os campos certos antes do update, em vez de espalhar o objeto cru.
- **Status:** ✅ Resolvido e testado ao vivo (baixa realizada com sucesso, financeiro atualizado certinho)

### BUG-062: "Dar Baixa" sem trava de clique duplo
- **Como foi descoberto:** logo depois de corrigir o BUG-061, testando de novo — a confirmação de pagamento chegou 2x no WhatsApp de teste pro mesmo clique em "Confirmar Baixa".
- **Causa:** o botão nunca ficava desabilitado durante o processamento (diferente dos outros botões da mesma tela, que já tinham essa trava) — um clique duplo (ou clique repetido por lentidão de rede) disparava a baixa e o envio da confirmação duas vezes.
- **Solução (19/08/2026):** botão agora trava (`saving`) durante o processamento, igual às outras ações da tela.
- **Status:** ✅ Resolvido (correção de código) — ainda não reconfirmado com um clique único depois da correção (a conexão com o navegador caiu na hora de retestar)

### BUG-063: "Forma Pgto" em branco no Financeiro > Matrículas por Vendedora pra matrículas vindas do Aulão
- **Como foi descoberto:** Diego notou que Leila Hilton Gonçalves e Vanilson Ferreira Gandra apareciam sem nenhuma forma de pagamento (só "—") na tela "Matrículas por Vendedora", mesmo com o pagamento confirmado no Asaas.
- **Causa:** `converter-matricula-aulao.ts` (webhook automático disparado quando o Asaas confirma o pagamento do checkout público do Aulão) cria o aluno, a matrícula, os `matricula_cursos` e o contrato ("Termo de Matrícula (Aulão)") — mas **nunca gravava nada em `parcelas`**. A informação do pagamento (valor, forma, status) ficava só em `matriculas_aulao`. Toda tela financeira (Matrículas por Vendedora, Financeiro do aluno, Relatório de Vendas) lê a forma de pagamento a partir da parcela nº1 (`tipo = 'parcela'` e `numero = 1`) — sem essa parcela, a coluna fica em branco mesmo o aluno tendo pago normalmente. É o mesmo ponto cego do BUG-040 (que resolveu o `colaborador_id` faltando), só que pro lado das `parcelas`.
- **Alcance:** 6 de 28 matrículas do Aulão estavam sem nenhuma parcela (checado em 24/08/2026): Carla Regina Borba Alves, Leila Hilton Gonçalves, Vanilson Ferreira Gandra, Gabriel Dos Santos, Silvina Rosa Alencar e Aline Soares de Oliveira.
- **Solução (24/08/2026):**
  1. **Código:** `converter-matricula-aulao.ts` agora grava a parcela nº1 (`tipo='parcela'`, `status='pago'`, valor/forma de pagamento espelhados de `matriculas_aulao`) logo depois de criar a matrícula — igual ao que o `MatriculaFlow.tsx` já fazia pro fluxo manual. Se essa gravação falhar, só loga o erro e segue o fluxo (não trava a liberação de acesso do aluno).
  2. **Backfill:** 5 dos 6 alunos tinham pagamento confirmado e rastreável em `matriculas_aulao` (mesmo valor R$69,90, boleto, com `asaas_payment_id` real) — parcela nº1 criada retroativamente pra cada um: Carla, Leila, Vanilson, Gabriel e Aline.
  3. **Silvina Rosa Alencar ficou de fora do backfill de propósito:** o registro dela em `matriculas_aulao` está com `pagamento_status = 'pendente'`, valor diferente (R$997, cartão) e `aluno_id` nulo (não linkado à matrícula real dela) — não bate com o padrão dos outros 5, então não dá pra simplesmente replicar. Precisa checar no Asaas o que realmente aconteceu com o pagamento dela antes de lançar a parcela manualmente.
- **Status:** ✅ Código aplicado no repositório (25/08/2026, commits em `converter-matricula-aulao.ts`, `_admin.alunos.index.tsx`, `_admin.financeiro.tsx`, `SalesReport.tsx`) e 5/6 alunos com backfill feito direto no banco. ⏳ Falta só investigar o caso da Silvina Rosa Alencar (ver acima).

### BUG-064: Webinar — vídeo travava pausado depois do salto pro minuto certo
- **Causa:** ao simular "entrar já no minuto certo" (seekTo do YouTube), o player às vezes ficava PAUSADO depois do salto. Como os controles ficam escondidos de propósito, o aluno não tinha nenhum jeito de retomar manualmente — nem depoimentos nem contador avançavam, já que dependem do tempo real do vídeo passando.
- **Solução (28/08/2026):** `playVideo()` chamado explicitamente logo depois de cada `seekTo()`, mais reforço via `onStateChange` que retoma o play sozinho se o vídeo pausar em qualquer momento.
- **Status:** ✅ Resolvido

### BUG-065: Webinar — navegador embutido do WhatsApp/Instagram quebra o player
- **Como foi descoberto:** teste real do Diego — no computador funcionou, no link aberto de dentro do WhatsApp não funcionou (vídeo tocava mas "cego": sem salto de entrada, sem depoimentos, sem contador).
- **Causa:** o navegador embutido de apps (WhatsApp, Instagram, Facebook, WeChat, Line, ou WebView Android genérica) bloqueia a comunicação que a API do player (YouTube/Panda) precisa pra funcionar — o vídeo toca, mas não dá pra ler o tempo atual nem controlar programaticamente.
- **Solução (28/08/2026):** função `detectarNavegadorEmbutido()` checa a UA assim que a página carrega. Android: sai sozinho pro navegador padrão via `intent://` (usuário nem percebe). iOS: mostra tela de instrução bloqueante ("toque nos ••• e escolha Abrir no Safari"), já que o WhatsApp no iPhone não permite forçar a saída programaticamente.
- **Status:** ✅ Resolvido

### BUG-066: Webinar — vídeo some da tela ao digitar comentário no mobile
- **Causa:** o navegador mobile (Safari/Chrome) rolava a página inteira pra cima quando o teclado abria no campo de comentário, levando o vídeo junto pra fora da tela.
- **Solução (28-29/08/2026):** container raiz com `position: fixed` (não só `h-dvh`), e reforço adicional travando o `<body>` inteiro (`position: fixed; overflow: hidden`) enquanto a página do webinar está aberta — o container fixo sozinho não bastou, o body ainda conseguia rolar por trás dele.
- **Status:** ✅ Resolvido

### BUG-067: Webinar — botão "Ativar áudio" desaparecendo (mobile e depois desktop)
- **Histórico:** 3 tentativas até acertar. 1ª: botão dentro do vídeo (`absolute`) — sumia em telas onde o vídeo ficava mais alto que a tela toda (vídeo em aspect-ratio 16:9 baseado na largura). 2ª: botão fixo no rodapé (`fixed bottom`) — resolvia o desaparecimento, mas passou a sobrepor o campo de comentário no mobile. 3ª: botão numa barra normal logo abaixo do vídeo — voltou a sumir, dessa vez no desktop (telas largas fazem o vídeo ficar bem alto).
- **Solução final (28-31/08/2026):** `position: fixed` no canto **superior esquerdo** da tela (`top-20 left-4`), com efeito pulsando — sempre visível, independente do tamanho do vídeo, sem sobrepor o campo de comentário (que fica embaixo, no mobile).
- **Status:** ✅ Resolvido

### BUG-068: Webinar — depoimentos só apareciam depois de minimizar e reabrir (iPhone)
- **Causa:** o Safari/iOS pausa a execução do JavaScript da página quando ela fica em segundo plano (app minimizado) — o "relógio" que lê o tempo do vídeo e revela os depoimentos ficava parado até a pessoa voltar, e aí processava tudo de uma vez.
- **Solução (29/08/2026):** listener de `visibilitychange` — quando a aba volta a ficar visível, força uma leitura imediata do tempo do vídeo (sem esperar o próximo ciclo do poll de 1s) e garante que o vídeo não ficou pausado nesse meio tempo.
- **Status:** ✅ Resolvido

### BUG-069: Webinar — histórico de entrada/saída não registrava reentradas
- **Como foi descoberto:** teste real — aluna entrou, saiu, voltou; o sistema só registrou a 1ª entrada/saída, nunca a volta dela.
- **Causa raiz:** a tabela `webinar_participantes` **não tinha policy de UPDATE pra visitante anônimo** (só INSERT e SELECT) — toda vez que o aluno reentrava ou mandava um "heartbeat", a atualização falhava **silenciosamente** por RLS, sem erro visível.
- **Solução (29/08/2026):** adicionada a policy `anon_update` faltante + nova tabela `webinar_sessoes` (histórico completo — cada entrada/saída vira uma linha nova, não só a primeira/última). Admin ganhou botão "Histórico" por aluno na tela de monitoramento, com todas as sessões daquele aluno num modal.
- **Status:** ✅ Resolvido

### BUG-070: Webinar — vídeo do Panda renderizava pequeno, sobrando espaço preto
- **Como foi descoberto:** print do Diego (Android e iPhone) — vídeo ocupava só um cantinho da área preta reservada pra ele.
- **Causa:** deixar o `PandaPlayer` (API oficial do Panda Video) criar o próprio elemento do zero (passando `video_id`/`library_id`, sem um `<iframe>` já existente) fazia o player não respeitar o tamanho do container.
- **Solução (31/08/2026):** passou a renderizar um `<iframe>` próprio com `src` direto (mesmo padrão já usado nos vídeos de curso do sistema, que sempre preenche 100% corretamente) e só conectar o `PandaPlayer` nesse iframe já existente (passando só o id do elemento) — em vez de deixar a biblioteca criar o player sozinha.
- **Status:** ✅ Resolvido

### BUG-071: Webinar — depoimentos do Panda só apareciam ao minimizar/reabrir (Android, sem estar em 2º plano)
- **Como foi descoberto:** mesmo sintoma do BUG-068, mas dessa vez no Android e SEM precisar de segundo plano de verdade — só minimizar e reabrir na hora já resolvia, o que não bate com throttling de JS em background.
- **Causa raiz (diferente do BUG-068):** conectar o `PandaPlayer` a um `<iframe>` que **já existe** (ver BUG-070) faz o evento `onReady` às vezes nunca disparar — o "handshake" com o iframe pode já ter acontecido antes da gente conseguir escutar. Sem o `onReady`, o relógio (poll que lê o tempo do vídeo a cada 1s) nunca começava de verdade — a única atualização de tempo vinha do reforço de "voltar a ficar visível" (BUG-068), que faz só UMA leitura pontual, revelando todos os depoimentos pendentes de uma vez só naquele momento.
- **Solução (31/08/2026):** não depende mais só do `onReady` — tenta iniciar o relógio por conta própria depois de 2s e 5s, mesmo que o `onReady` nunca tenha disparado (seguro: os métodos do player não fazem nada se chamados cedo demais, só retornam `undefined`).
- **Status:** ✅ Resolvido

### BUG-072: Webinar Safari/iPhone — "Importing a module script failed" após deploys seguidos
- **Como foi descoberto:** print do Diego — página em branco no Safari do iPhone com esse erro, enquanto no Android funcionava normal.
- **Causa provável:** cache do Safari com uma versão antiga da página (HTML) tentando carregar um arquivo JS que já não existe mais no servidor, por causa dos vários deploys seguidos feitos na mesma sessão de testes.
- **Status:** ⚠️ Não confirmado como bug de código — orientado o Diego a testar em aba anônima/recarregar sem cache antes de investigar mais a fundo. Se persistir mesmo com cache limpo, precisa investigar de verdade.

### BUG-073: Editar valor/vencimento de uma parcela não atualizava a cobrança já gerada no Asaas
- **Como foi descoberto:** Diego editou manualmente a parcela nº1 da Maria Aparecida Lopes (CTR 1772), de R$159,90/28-08 pra R$229,80/29-08. A tela do sistema já mostrava certo, mas o boleto baixado (PDF) continuou com os dados antigos.
- **Causa:** o botão de baixar boleto sempre busca a cobrança pelo `asaas_id` já salvo na parcela — editar o valor/vencimento no banco não manda nenhuma atualização pro Asaas, então a cobrança lá continua com os dados de quando foi criada.
- **Solução (28/08/2026):** botão novo "Cancelar e Regerar Cobrança" (ver `09_FEATURES.md`) — cancela a cobrança antiga e gera uma nova com os valores atuais, num clique só.
- **Status:** ✅ Resolvido (feature nova) — o caso pontual da Maria Aparecida precisa o Diego clicar no botão novo pra corrigir de fato (o cancelamento da cobrança antiga não acontece retroativamente sozinho)

### BUG-074: Webinar — reabrir a mesma aba/navegador não registrava reentrada no histórico
- **Como foi descoberto:** teste real — só ficava registrada a 1ª entrada/saída de cada aluno, mesmo quando ele claramente saiu e voltou várias vezes.
- **Causa raiz:** a restauração do participante salvo no `localStorage` (usada pra evitar pedir nome/telefone de novo ao atualizar/reabrir a página) só atualizava o estado **na tela** — nunca tocava no banco. Só a lógica de reentrada manual (formulário preenchido de novo) gravava a sessão nova em `webinar_sessoes` e resetava `saiu_em`. Como reabrir a mesma aba/navegador é o jeito mais comum de "sair e voltar" de verdade, esse caminho passava batido pelo banco.
- **Solução (01/09/2026):** a restauração via `localStorage` agora também reseta `saiu_em` e insere uma sessão nova no histórico, igual já acontecia na reentrada manual.
- **Status:** ✅ Resolvido

### BUG-075: Webinar Panda Video — vídeo travado no iPhone mesmo depois de 2 tentativas de correção
- **Como foi descoberto:** persistia mesmo depois do BUG-071 (retry insistente do relógio) — no iPhone, os depoimentos continuavam só aparecendo ao minimizar/reabrir.
- **Causa raiz de verdade:** o reforço "se o vídeo pausar sozinho, retoma o play" só rodava **dentro do `onReady`** — que é justamente o evento que não dispara de forma confiável quando o `PandaPlayer` se conecta a um `<iframe>` já existente (ver BUG-070/071). Se o vídeo nunca chegasse a tocar de verdade (autoplay bloqueado silenciosamente no Safari), nada tentava dar play de novo — `getCurrentTime()` continuava retornando um número válido (0, parado), então a tentativa de iniciar o relógio "funcionava" tecnicamente, só que o tempo nunca avançava.
- **Solução (01/09/2026):** o reforço de `play()` passou a rodar numa verificação própria, **independente do `onReady`**, chamando `play()` a cada segundo sem parar, desde o instante em que o player é criado — não só quando `isPaused()` confirma que está pausado (que também pode não ser confiável sem o handshake completo).
- **Status:** ✅ Resolvido

### BUG-076: Webinar — "gravado" desligado sem querer desativa toda a simulação de aula ao vivo
- **Como foi descoberto:** teste real com alunos de verdade (01/09/2026) — depoimentos roteirizados não apareceram (só comentários reais), contador de espectadores mostrou o número real de gente online (não a curva simulada), e o vídeo voltava pro início toda vez que um aluno saía e voltava, em vez de pular pro minuto certo.
- **Causa raiz:** os 3 sintomas têm uma causa só — o campo `webinars.gravado` estava `false` no webinar usado. Esse campo liga TUDO: depoimentos sincronizados, contador simulado, e o salto de entrada pro minuto certo (ver seção "Simulação de aula ao vivo" em `03_DATABASE.md`). Causa mais provável: clique acidental no selo **"🎥 Gravado"**, que fica bem do lado do título na lista de Webinars e é fácil de esbarrar sem querer.
- **Solução (01/09/2026):** adicionada uma confirmação (`window.confirm`) antes de **desmarcar** gravado, explicando claramente o que isso desliga — assim não dá mais pra desligar sem querer com um clique único.
- **Status:** ✅ Resolvido (proteção contra o erro humano — o webinar específico de ontem já tinha encerrado, sem correção retroativa possível)



### BUG-015: View recebimentos com double-counting
- **Causa:** Parcelas pagas em full também aparecem em parcelas_pagamentos, causando contagem dupla em algumas views
- **Solução pendente:** Ajustar view para usar `NOT EXISTS` corretamente
- **Status:** ⚠️ Parcialmente resolvido (view criada com filtro, mas precisa validação)

### BUG-016: Extensão de tradução do Chrome causa erros no Supabase
- **Causa:** Chrome Translate interfere com o DOM do Supabase Dashboard
- **Workaround:** Usar aba anônima ou desativar tradução para supabase.com
- **Status:** ⚠️ Workaround (problema do Chrome, não do sistema)
