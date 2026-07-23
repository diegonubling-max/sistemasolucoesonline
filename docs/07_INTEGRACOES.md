# 07 — INTEGRAÇÕES

## Asaas (Pagamentos)

### Ambiente
- **Produção** (não sandbox)
- API: `https://api.asaas.com/v3/`

### Funcionalidades
- Geração de cobrança PIX (QR Code + cópia-e-cola)
- Geração de boleto bancário
- Confirmação de recebimento manual via API (`/payments/{id}/receiveInCash`)

### Campos no Banco
Na tabela `parcelas`:
- `asaas_id` — ID da cobrança no Asaas (ex: `pay_lstead2chjdn0oal`)
- `asaas_url` — URL pública da cobrança
- `asaas_barcode` — Código de barras do boleto
- `asaas_pix_chave` — Chave PIX
- `asaas_pix_qrcode` — QR Code PIX

### Fluxo de Baixa Manual
1. Admin clica "Baixa" na parcela
2. Sistema atualiza status para 'pago' no banco
3. Se `asaas_id` existe, chama API Asaas para confirmar recebimento
4. Asaas para de enviar emails de cobrança

### Localização das Chaves
- API Key do Asaas: armazenada no banco por polo (NÃO hardcoded no código)
- Usada apenas em edge functions (server-side)
- NÃO exposta no frontend

### Parceria Principia
- Empresa que antecipa parcelas de boleto (70% do valor, até 3 meses)
- Exige contrato assinado pelo aluno
- Motivação para o checkout público (/matricula)

---

## Panda Video (Aulas)

### Dados
- **Library ID:** 0976615f-234
- **Player URL base:** `https://player-vz-0976615f-234.tv.pandavideo.com.br/embed/?v={video_id}`

### Edge Function: panda-video-sync
**Endpoint:** `https://{supabase_url}/functions/v1/panda-video-sync`

**Chamada:**
```sql
SELECT net.http_post(
  url := 'https://{supabase_url}/functions/v1/panda-video-sync',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"folder_name": "Nome da Pasta", "curso_nome": "Nome do Curso", "mode": "insert"}'::jsonb
);
```

**Verificação:**
```sql
SELECT content, status_code FROM net._http_response WHERE id = N;
```

### Cursos Importados

| Curso | Aulas | Status |
|-------|-------|--------|
| Biologia | 35 | ✅ Panda |
| Filosofia | 40 | ✅ Panda |
| Física | 42 | ✅ Panda |
| Geografia | 60 | ✅ Panda (migrado de YouTube) |
| História | 60 | ✅ Panda |
| Inglês | 82 | ✅ Panda |
| Matemática | 83 | ✅ Panda |
| Português | 40 | ✅ Panda |
| Química | 56 | ✅ Panda |
| Sociologia | 27 | ✅ Panda |
| Administração Mercado de Trabalho | 37 | ✅ Panda |
| Canva | 15 | ✅ Panda |
| Departamento Pessoal | 38 | ✅ Panda |
| Designer de Sobrancelha & Cílios | 14 | ✅ Panda |
| Energia Solar | 0 | ⏳ Aguardando reimportação |
| Frentista | 40 | ✅ Panda |
| Instagram para Vendas | 38 | ✅ Panda |

### Rastreamento de Progresso
- Evento: `panda_allData` (não `timeupdate`)
- Threshold: 70% do vídeo assistido = aula concluída
- Atualiza `aluno_aulas_assistidas` com percentual e tempo

### Migração YouTube → Panda
- Para preservar progresso: UPDATE na `url_video` das aulas existentes (mantém ID)
- NÃO deletar e recriar aulas se alunos já têm progresso

---

## Z-API (WhatsApp)

### ⏸️ Status atual (22/07/2026)
Todos os disparos automáticos via Z-API estão **pausados temporariamente** a pedido do Diego ("não será necessário por enquanto"). O único cron job ativo no projeto Supabase atual era `aulao-boas-vindas` (boas-vindas do Aulão) — foi desativado via `cron.alter_job(active := false)`, sem excluir o job, pra reativar rápido quando decidir voltar a usar. Os demais tipos de disparo na tabela abaixo são referência do sistema legado (Lovable) e não têm cron job correspondente recriado neste projeto Supabase ainda.

### Dados da Instância
- **Nome:** solucoes-online
- **Status:** Conectada
- **Endpoint base:** `https://api.z-api.io/instances/{instance_id}/token/{token}/`

### Segurança
- Chaves movidas de frontend para server-side em 15/07/2026
- Client-Token regenerado após exposição no bundle público
- Rota proxy: `/api/public/hooks/zapi-send`
- Chaves lidas de `process.env` (ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN)

### Tipos de Disparo (referência — ver status atual acima)

| Tipo | Quando | Exclusões |
|------|--------|-----------|
| Boas-vindas | Ao matricular | — |
| Cobrança diária | 09:00 BRT (cron) | isento, cancelado, valor 0, inativos |
| Motivacional diário | 09:00-10:30 BRT | inativos, prova finalizada |
| FDS (sábado) | Sábado manhã | inativos, prova finalizada, ciclo > 6 |
| FDS (domingo) | Domingo manhã | inativos, prova finalizada, ciclo > 6 |
| Lembrete prova 30min | A cada 30 min | — |
| Pós-Venda D+1/D+5/D+15 | Automático | — |
| Oferta cursos vitrine | Manual (por perfil) | — |
| Notificação vitrine | Admin clica botão | — |
| Agendamento externo | Ao agendar | — |
| Matrícula aulão | Ao matricular | — |

### Sistema de Ciclos FDS
- 6 ciclos (semanas desde matrícula)
- 24 mensagens no total (6 ciclos × sábado/domingo × assistiu/não assistiu)
- Armazenadas em `zapi_mensagens_fds`
- Após ciclo 6: para de enviar mensagens de FDS

### Envio de Mensagem
```typescript
// Frontend chama a rota proxy
await fetch('/api/public/hooks/zapi-send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: telefone, message: mensagem })
});
```

### Formatação de Telefone
```typescript
let tel = telefone.replace(/\D/g, '');
if (!tel.startsWith('55')) tel = '55' + tel;
```

---

## Firebase (Push Notifications)

### Dados
- **Project ID:** solucoes-online
- **Sender ID:** 548326438424

### Uso
- Push notifications para alunos na área de membros
- PWA support

---

## Integrações Futuras (Planejadas)
- **Meta Pixel:** rastreamento de conversões na página /matricula e /aulao
- **Utmify:** rastreamento de criativos de anúncios
- **Domínio próprio:** migração do lovable.app para domínio próprio via Vercel

## Supabase Storage — Buckets

| Bucket | Público | Uso |
|--------|---------|-----|
| `fotos-perfil` | Sim | Foto de perfil do aluno |
| `thumbnails-aulas` | Sim | Thumbnail de cada aula (criado 22/07/2026, políticas de acesso público criadas junto) |
| `thumbnails-cursos` | Sim | Thumbnail de curso (criado 22/07/2026, junto com o de aulas) |
| `thumbnails` | Sim | Bucket genérico de thumbnails de sessão anterior (21-22/07/2026) |

**Nota:** ao criar novo bucket, sempre criar também as políticas de `storage.objects` (select/insert/update/delete) pro bucket — RLS de `storage.objects` fica ativo por padrão mesmo com RLS desabilitado nas tabelas normais, e sem política nenhuma o upload falha silenciosamente (nenhum toast de erro claro do lado do Supabase, só falha genérica).
