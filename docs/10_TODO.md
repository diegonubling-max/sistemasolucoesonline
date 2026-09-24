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
- [x] Reimportar agendamentos de prova do sistema antigo — feito em 24/09/2026: 563 registros importados de um CSV novo (jan-dez/2026), com `status` já derivado de `resultado` na importação (evitando repetir o problema do BUG-083). Distribuição: Agendadas=11, Reagendar=72, Aprovados=479, Reprovados=1
- [ ] Reimportar 541 registros de documentação do sistema antigo — uma tentativa parcial (100 registros, lotes 02/03/04-2026) foi feita e depois excluída em 24/09/2026; **bloqueado** até corrigir o schema de `documentacao_alunos` (~20 colunas que o código espera não existem na tabela — ver BUG-083 em `14_BUGS_CONHECIDOS.md` e a nota em `03_DATABASE.md`)

## 🟡 Média Prioridade

### Página /matricula (Aulão — deadline 21/07/2026)
- [ ] Adicionar Meta Pixel + Utmify à página
- [ ] Adicionar banner 1080x600 no topo
- [ ] Testar fluxo completo (dados → pagamento → contrato → confirmação)
- [ ] Configurar UTM tracking

### Financeiro
- [x] Criar views: view_total_recebido_mes, view_a_receber_mes, view_em_atraso — já existem no banco
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
- [ ] Corrigir `ContratoAlunoModal.tsx` (ver/gerar contrato + compartilhar por WhatsApp) — ainda depende do esquema antigo de assinatura remota que não existe mais (mesma decisão de simplificação já tomada pro "Novo Aluno")
- [ ] Limpar as ~7 referências restantes à URL antiga do Lovable (`sistemasolucoesonline.lovable.app`) espalhadas pelo código
