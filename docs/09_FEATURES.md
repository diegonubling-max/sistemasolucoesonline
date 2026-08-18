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
- ✅ Botão "Gerar acesso (Aulão)" — lista cadastros do `/matricula` sem login ainda e gera na hora, mesmo sem pagamento confirmado (28/07/2026)
- ✅ **(17/08/2026)** "Cadastrado por" agora também é gravado pra alunos do Aulão quando um colaborador gera o acesso manualmente — pelo botão "Gerar acesso (Aulão)" ou ao registrar um pagamento manual em Matrículas Aulão. Identifica quem estava logado (Diego, Felipe, Gislaine, etc) e salva em `alunos.cadastrado_por`/`cadastrado_por_id`, visível no perfil do aluno. Quando o próprio aluno confirma o pagamento sozinho (Asaas → webhook automático), fica em branco — ninguém "cadastrou" nesse caso
- ✅ Matrículas Aulão: reorganizado em 3 guias (12/08/2026) — "Ativos — ainda não pagaram" (padrão ao abrir), "Pagos e matriculados", "Inativados", cada uma com contador. Substituem os antigos filtros de Status (Todos/Ativos/Cancelados) e Pagamento (Todos/Pago/Aguardando), que foram removidos por ficarem redundantes; os filtros de Forma e Contrato continuam, agora refinando dentro de cada guia
- ✅ Matrículas Aulão: coluna "Voucher" nova (05/08/2026) — mostra o código que o aluno preencheu no `/matricula` (verde se é o voucher válido e foi aplicado no pagamento, laranja se preencheu um código errado, "—" se não preencheu nada). Dá pra ver de relance quem completou o cadastro mas não usou voucher
- ✅ Ícone 💲 (vermelho, na célula do CTR — entre CTR e Nome) quando o aluno não tem nenhuma parcela cadastrada em nenhuma matrícula — sinaliza financeiro pendente de configurar. Legenda dos ícones (vitrine, financeiro) fixada acima da tabela (05/08/2026) — removida a bolinha verde/vermelha ao lado do nome (redundante com a coluna Status/Badge Ativo-Inativo já existente)

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
- ✅ Financeiro: Fechamento Semanal (05/08/2026) — por colaborador/polo (ex: Felipe), período sexta a quinta (fecha toda sexta, semana anterior completa), soma parcelas pagas excluindo taxa de matrícula, exporta CSV. Divide automaticamente o total entre Matriz e o colaborador por percentual (`colaboradores.percentual_repasse`, padrão 30% — editável na própria tela com o lápis)
- ✅ Financeiro: Fechamento Semanal ganhou botão "Marcar como pago" (12/08/2026) — registra que aquele fechamento (colaborador + semana específica) foi pago, com a data do pagamento; fica visível como badge verde "Pago em DD/MM/AAAA" e dá pra desfazer. Guardado na tabela `fechamentos_semanais_pagamentos` (um registro único por colaborador+semana)
- ✅ Financeiro: reconciliação diária automática de pagamentos (12/08/2026, BUG-050) — edge function `reconciliar-pagamentos`, agendada via `pg_cron` (job `reconciliar-pagamentos-diario`, todo dia 6h da manhã de Brasília). Confere toda parcela em aberto com cobrança já gerada direto na API do Asaas e dá baixa sozinha se já estiver paga lá — pega casos em que o webhook de confirmação não chegou, sem precisar de ninguém notar ou clicar em nada. **(18/08/2026) Estendida pra também cobrir `matriculas_aulao`** — antes só cobria alunos já matriculados (tabela `parcelas`), deixando o funil do Aulão sem essa rede de segurança. Agora confere também todo lead do Aulão com `pagamento_status='pendente'` que já tem cobrança gerada; se o Asaas mostrar como pago, atualiza pra "confirmado" e dispara a criação do acesso do aluno automaticamente
- ✅ Dashboard/Financeiro: card "Recebido de Parcelas no Mês" separado de "Taxas de Matrícula no Mês" (05/08/2026) — taxa é reinvestimento em tráfego, não entra no fechamento com responsável de polo
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

## Módulo: Webinar / Aula ao Vivo (NOVO — 23/07/2026)
- ✅ Admin cria um "Webinar" com título + link do YouTube (ao vivo, não listado)
- ✅ Página pública `/webinar/:id` — aluno digita nome + WhatsApp (sem senha) pra entrar
- ✅ Vídeo do YouTube incorporado + chat ao vivo com emojis (tempo real via Supabase Realtime)
- ✅ Contador de pessoas online em tempo real
- ✅ Registro de entrada (nome, telefone, horário) e saída (detectada via Supabase Presence — sem heartbeat manual; o painel admin grava a saída assim que a conexão do aluno cai, ao fechar a aba ou perder internet) — ajustado 23/07/2026
- ✅ Painel admin `/webinars/:id` — feed ao vivo de quem entrou/saiu, com aviso destacado a cada saída
- ✅ Gráfico de pessoas online ao longo da aula (snapshot a cada minuto via cron `webinar-presenca`), pra identificar os momentos de maior queda
- 🔧 Streaming em si não é feito pelo sistema — Diego transmite pelo YouTube (ou outra plataforma) e o link é só incorporado

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

## Módulo: Página Pública /matricula — atualização 04-05/08/2026
- ✅ Meta Pixel (2773111239702600): Lead (avança do passo 1), CompleteRegistration (finaliza matrícula/assinatura), Purchase (só quando pagamento confirmado — valor real, com/sem voucher)
- ✅ Captura utm_term e fbclid (antes só source/medium/campaign/content); cookie solucoes_utm como fallback pro WhatsApp não repassar UTM
- ✅ Reconstrução do cookie _fbc a partir do fbclid — corrige atribuição de campanha/criativo no Gerenciador de Anúncios (senão o Meta não conseguia ligar o clique no anúncio, feito em /aulao noutro subdomínio, à conversão aqui)
- ✅ Voucher da aula ao vivo (código "1627off", case-insensitive): preço padrão em destaque (12x R$259,90) → campo de cupom → forma de pagamento só aparece com cupom válido (ou link "Não tenho o código", preço cheio). Cartão com cupom: 12x R$119,90. Validação sempre no servidor, nunca confia no navegador
- ✅ Botão final "Garantir minha vaga" (era "Ir para o pagamento" — trocado por texto convidativo, mas não enganoso sobre o que acontece a seguir)
- ✅ **(17/08/2026) /matricula-demo reescrita do zero** — antes ela replicava o `/matricula` só sem pixel/UTM, mas por baixo dos panos ainda salvava de verdade em `matriculas_aulao` (via `criar_matricula_lancamento`) e até processava pagamento real via Asaas (PIX/cartão) se alguém preenchesse dados reais. Agora é 100% mock: espelha visualmente o fluxo atual (modal de acesso → voucher → dados → forma de pagamento), **sem campo de CPF**, e **não faz nenhuma chamada de banco, Asaas ou API**. Serve só pra mostrar o passo a passo durante a aula ao vivo. **Sem nenhum aviso visual de "é uma demonstração"** — precisa ficar visualmente idêntica ao `/matricula` real, já que o Diego usa esse link ao vivo, na tela, durante a própria aula. Boleto: clicar em "Garantir minha vaga" permanece na mesma tela, sem navegar nem gerar nada. **Cartão: clicar em "Garantir minha vaga" mostra o "print" da tela real de pagamento no cartão** (mesmos campos — nome, número, validade, CVV, parcelas — digitáveis pra ficar realista, mas o botão "Confirmar Matrícula" não processa nada de verdade), com botão "← Voltar" pra continuar a demonstração
- ✅ **(12/08/2026) Modal de acesso antes de tudo** — assim que a página `/matricula` carrega, antes do formulário de dados, mostra uma pergunta: "Você assistiu à aula ao vivo completa e tem o voucher que foi liberado nela?" com botões Sim/Não. **Sim** → segue pro fluxo de matrícula (agora: voucher → dados → forma de pagamento, ver item abaixo). **Não** → mostra uma segunda tela avisando que as vagas são exclusivas pra quem assistiu à aula ao vivo, sem opção de continuar. Não salva nada no banco nessa etapa (é só um filtro de entrada, antes de qualquer dado do aluno)
- ✅ **(12/08/2026) Fluxo reordenado: voucher vem antes dos dados, não depois** — depois de responder "Sim" no modal de acesso, a próxima tela é só o campo do código (sem mostrar preço nenhum, texto fala em "bolsa de estudo" pra quem participou da aula), com o botão "Confirmar código" desabilitado até o código bater. Só depois disso é que aparece o formulário de dados pessoais, e só depois dos dados é que aparece a forma de pagamento (com o preço promocional já garantido, sem mais precisar digitar o voucher de novo). A opção antiga "Não tenho o código" foi removida — agora é obrigatório ter o código certo pra passar dessa etapa

## Módulo: Migração de vídeo Panda → YouTube
- ✅ Cada curso pode ter youtube_playlist_id + youtube_playlist_count; aulas com ordem dentro desse limite tocam automaticamente da playlist do YouTube (não listada), o resto continua no Panda até completar o upload
- ✅ Histórico de aulas assistidas 100% preservado (vinculado a aula_id, não ao vídeo)
- ✅ 10 matérias já migradas: Português, Biologia, Matemática, Sociologia, Química, Filosofia, Física, Inglês, História, Geografia

## Módulo: Webinar — replay com depoimentos reais (04/08/2026)
- ✅ Aula gravada (flag `gravado` no webinar) + depoimentos reais da aula ao vivo original cadastrados manualmente (nome, texto, minuto:segundo) em /webinars/:id/depoimentos
- ✅ Player usa YouTube IFrame API pra aulas gravadas (rastreia currentTime) e revela os depoimentos no chat no segundo exato, marcados com 🎥 pra diferenciar de comentário ao vivo real
- ✅ Chat ao vivo dos alunos continua funcionando normalmente em paralelo, com equipe respondendo

## Módulo: Webinar — portaria dos 20 minutos (05/08/2026, tolerância ajustada de 10→20)
- ✅ Objetivo: evitar que quem entra atrasado na aula ao vivo (sem ver a explicação) vá pro pitch sem entender o valor e enxergue só o preço
- ✅ Regra: 1ª tentativa de uma pessoa (identificada por telefone) só é liberada se estiver até 20 min depois do horário real que o admin clicou em "Iniciar" (`webinars.iniciado_em`, não um horário fixo cravado). Passou de 20 min → bloqueado, mostra mensagem de que não dá mais pra entrar
- ✅ Reentrada: quem já teve acesso liberado antes (mesmo telefone) é reconhecido e entra na hora, sem checar horário de novo — cobre queda de sinal/conexão
- ✅ Se a pessoa tenta entrar antes do admin clicar em "Iniciar", mostra tela de espera com botão "Tentar entrar" (sem bloquear, sem contar como tentativa)
- ✅ Painel admin do webinar (`/webinars/:id`) ganhou card "Bloqueados (chegaram tarde)" + tabela com nome/telefone/horário da tentativa e um botão "Chamar no WhatsApp" (wa.me), pra equipe já ir chamando durante a própria aula
- ✅ Tabela de participantes "liberados" (os que realmente assistiram) separada dos bloqueados
- ⚠️ Limitação conhecida: o reconhecimento por telefone é por igualdade exata da máscara digitada — se a pessoa digitar o número diferente da 1ª vez (com/sem 9º dígito, etc), não reconhece como reentrada e trata como tentativa nova
- ✅ **(12/08/2026) Redirect direto pro YouTube revertido, a pedido do Diego** — a página `/webinar/:id` voltou a mostrar o player interno do sistema (chat + vídeo) pra quem é liberado, em vez de mandar direto pro YouTube. A função `montarLinkYoutubeApp` (Android via `intent://`) continua no código, sem uso — fica pronta caso o redirect direto seja reativado no futuro
- ✅ **(12/08/2026) Player travado — aluno não avança o vídeo nem vê opções do YouTube** — nos dois modos (ao vivo e gravado): sem barra de progresso/controles (`controls=0`), sem atalhos de teclado pra pular (`disablekb=1`), sem sugestões de outros vídeos (`rel=0`), sem tela cheia (`fs=0`), sem anotações (`iv_load_policy=3`), marca d'água discreta (`modestbranding=1`). O aluno só assiste, sem navegar dentro do vídeo
- ✅ **(18/08/2026) Redirect direto pro YouTube reativado, a pedido do Diego** — depois de preencher nome/WhatsApp e ser liberado, `/webinar/:id` volta a mandar direto pro YouTube (função `montarLinkYoutubeApp`: força abrir no app no Android via `intent://`, iOS já abre no app sozinho via Universal Links) em vez de mostrar o player interno. O player interno com chat/depoimentos/trava de controles (item acima) continua no código, só ficou inacessível de novo — fácil reverter tirando o redirect se precisar no futuro
- ✅ Botão "Exportar Excel" no painel de monitoramento (`/webinars/:id`, 05/08/2026) — baixa um `.xlsx` (biblioteca `xlsx`/SheetJS) com 2 abas: "Conseguiu entrar" (nome, WhatsApp, horário que entrou/saiu, status) e "Não conseguiu (atraso)" (nome, WhatsApp, horário que tentou). Nome do arquivo já vem com a data da aula

## Módulo: Perfil do Aluno (admin) — novidades
- ✅ Botão "Copiar acesso" — modal com login/senha/link prontos num texto, pra colar manualmente no WhatsApp (sem envio automático via Z-API, por decisão do Diego)
- ✅ Botão de baixar boleto em PDF em cada parcela tipo boleto — abre o PDF do Asaas; se ainda não tiver cobrança gerada, cria na hora antes de abrir
- ✅ Botão "Gerar acesso (Aulão)" no menu Alunos — converte lead do /matricula em aluno completo mesmo sem pagamento confirmado

## Módulo: Pós-Venda — automação (05/08/2026)
- ✅ 1º Pós-Venda criado automaticamente 1 dia após a matrícula
- ✅ 2º e 3º só são criados quando a etapa anterior é confirmada (2º = 5 dias após confirmar o 1º; 3º = 10 dias após confirmar o 2º)
- ✅ Etapa não confirmada continua aparecendo indefinidamente até ser feita

## Módulo: Dashboard
- ✅ Cards de faturamento (Total Recebido/A Receber/Em Atraso) funcionando de verdade (antes sempre zerados — views não existiam)
- ✅ Seção "Interesse na Vitrine" removida
- 🔧 Pendente (não verificado/criado ainda): add_milhas_eja, delete_pacote, resgatar_curso_vitrine — funcionalidades de milhas/vitrine podem estar quebradas do mesmo jeito que estava o financeiro
