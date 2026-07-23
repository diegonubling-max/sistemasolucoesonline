# 10 — TODO (Pendências)

## 🔴 Alta Prioridade

### Reconstrução do Sistema (URGENTE)
- [ ] Deploy do frontend na Vercel (código no GitHub, Supabase novo criado)
- [ ] Configurar variáveis de ambiente na Vercel (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, ZAPI_*)
- [ ] Atualizar .env no GitHub com novas credenciais do Supabase
- [ ] Recriar edge function panda-video-sync no novo Supabase
- [ ] Reimportar aulas do Panda Video (todos os cursos)
- [ ] Re-cadastrar alunos (aguardando export do Lovable ou cadastro manual)
- [ ] Re-cadastrar questões de prova (prova_questoes)
- [ ] Recriar cron jobs no novo Supabase
- [ ] Configurar Lovable novo importando código via GitHub (Opção C)

### Dados dos Alunos
- [ ] Aguardar resposta do Lovable sobre export do Supabase antigo
- [ ] Se não devolver: re-cadastrar alunos manualmente (lista com Mônica/equipe)
- [ ] Reimportar 431 agendamentos de prova do sistema antigo
- [ ] Reimportar 541 registros de documentação do sistema antigo

## 🟡 Média Prioridade

### Página /matricula (Aulão — deadline 21/07/2026)
- [ ] Adicionar Meta Pixel + Utmify à página
- [ ] Adicionar banner 1080x600 no topo
- [ ] Testar fluxo completo (dados → pagamento → contrato → confirmação)
- [ ] Configurar UTM tracking

### Financeiro
- [ ] Criar views: view_total_recebido_mes, view_a_receber_mes, view_em_atraso
- [ ] Baixa sincronizar com Asaas automaticamente (testar)
- [ ] Criar função de integridade do banco (verificar inconsistências)

### Cursos
- [ ] Energia Solar: reimportar aulas quando Diego subir no Panda
- [ ] Importar cursos pendentes (AutoCAD, Edição de Vídeo, Marketing Digital)

### Domínio Próprio
- [ ] Migrar sistemasolucoesonline.lovable.app para domínio próprio (via Vercel)
- [ ] Configurar SSL e DNS

## 🔵 Baixa Prioridade

### Segurança
- [ ] Reativar RLS quando migrar para domínio próprio
- [ ] Implementar autenticação robusta (Supabase Auth ou JWT custom)

### Funcionalidades Futuras
- [ ] Editar mensagens Z-API pelo painel admin
- [ ] Disparo Z-API por pontos Milhas EJA
- [ ] Importação alunos outros polos (Novo Hamburgo, Porto Alegre)
- [ ] Bloquear avanço rápido no player Panda
- [ ] Menu "Alunos Migrados" no sistema
- [ ] Lógica de cursos por perfil vocacional na aba Perfil
- [ ] Dashboard em tempo real ("alunos online")
- [ ] Ambiente de staging/teste separado
- [ ] Geração de PDF da Declaração com logo + assinatura

### Melhorias
- [ ] Criar checklist de teste pós-alteração
- [ ] Criar função SQL de verificação de integridade
- [ ] Configurar branches Git (main = produção, dev = desenvolvimento)
- [ ] Diego reenviar as questões da Prova Final (10 por matéria) — `prova_questoes` está vazia desde o reset do Supabase
- [ ] Reativar disparo automático de boas-vindas Z-API (`aulao-boas-vindas`) quando Diego decidir (`cron.alter_job(job_id := 1, active := true)`)
- [ ] Revisar responsividade mobile da área do aluno com prints reais do Diego (98% dos alunos assistem aula pelo celular)
