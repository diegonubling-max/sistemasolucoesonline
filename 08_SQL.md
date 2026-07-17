# 08 — SQL

## Consultas Úteis

### Buscar aluno pelo nome
```sql
SELECT a.id, a.nome, a.ctr, a.telefone, a.ativo
FROM alunos a
WHERE a.nome ILIKE '%Nome%';
```

### Buscar matrícula pelo CTR
```sql
SELECT m.id AS matricula_id, a.nome, a.ctr, m.polo_id, m.status
FROM matriculas m
JOIN alunos a ON a.id = m.aluno_id
WHERE a.ctr = 1725;
```

### Ver parcelas de um aluno
```sql
SELECT p.id, p.numero, p.descricao, p.valor, p.status, p.forma_pagamento,
       p.data_vencimento, p.data_pagamento, p.valor_pago_total
FROM parcelas p
JOIN matriculas m ON m.id = p.matricula_id
JOIN alunos a ON a.id = m.aluno_id
WHERE a.ctr = 1733
ORDER BY p.numero;
```

### Ver comissões de uma vendedora no mês
```sql
SELECT a.nome AS aluno, a.ctr, c.valor, c.tipo_pagamento, c.competencia, c.status
FROM comissoes c
JOIN alunos a ON a.id = c.aluno_id
WHERE c.vendedora = 'Maria Eduarda'
  AND c.competencia >= '2026-07-01'
  AND c.competencia < '2026-08-01'
ORDER BY c.competencia;
```

### Ver agendamentos de prova
```sql
SELECT id, ctr, nome_aluno, data_prova, hora_prova, status, resultado, is_externo
FROM prova_agendamentos
ORDER BY data_prova DESC
LIMIT 20;
```

### Ver resultados de prova de um aluno
```sql
SELECT materia, total_acertos, total_questoes, percentual, aprovado, finalizado_em
FROM prova_resultados
WHERE agendamento_id = 'UUID_DO_AGENDAMENTO'
ORDER BY materia;
```

### Verificar cron jobs
```sql
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
```

### Verificar resultado de edge function
```sql
SELECT content, status_code FROM net._http_response WHERE id = N;
```

### Alunos inativos com parcelas abertas (verificação de integridade)
```sql
SELECT a.nome, a.ctr, COUNT(*) as parcelas_abertas
FROM parcelas p
JOIN matriculas m ON m.id = p.matricula_id
JOIN alunos a ON a.id = m.aluno_id
WHERE a.ativo = false
  AND p.status = 'aberto'
GROUP BY a.nome, a.ctr;
```

### Parcelas sem forma de pagamento
```sql
SELECT a.nome, a.ctr, p.id, p.descricao, p.valor
FROM parcelas p
JOIN matriculas m ON m.id = p.matricula_id
JOIN alunos a ON a.id = m.aluno_id
WHERE p.forma_pagamento IS NULL
  AND p.status != 'isento'
  AND p.valor > 0
ORDER BY a.nome;
```

### Parcelas pagas no sistema mas possivelmente abertas no Asaas
```sql
SELECT a.nome, a.ctr, p.asaas_id, p.status, p.valor
FROM parcelas p
JOIN matriculas m ON m.id = p.matricula_id
JOIN alunos a ON a.id = m.aluno_id
WHERE p.asaas_id IS NOT NULL
  AND p.status = 'pago'
ORDER BY a.nome;
```

## Operações Comuns

### Fix RLS quando dados somem
```sql
ALTER TABLE public.[tabela] DISABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
```

### Deletar aluno completo
```sql
SELECT delete_aluno_completo('UUID_DO_ALUNO');
```

### Marcar aulas como concluídas manualmente
```sql
UPDATE aluno_aulas_assistidas aa
SET percentual_assistido = 100.00, tempo_assistido = 999999
FROM aulas a JOIN cursos c ON c.id = a.curso_id
WHERE aa.aula_id = a.id
AND aa.aluno_id = 'UUID_DO_ALUNO'
AND c.nome IN ('Biologia', 'Filosofia')
AND aa.percentual_assistido < 70;
```

### Importar aulas do Panda Video
```sql
SELECT net.http_post(
  url := 'https://qohvseedougwymxjhbgi.supabase.co/functions/v1/panda-video-sync',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"folder_name": "Nome da Pasta", "curso_nome": "Nome do Curso", "mode": "insert"}'::jsonb
);
```

### Recalcular notas de prova (fix case-sensitive)
```sql
DO $$
DECLARE
  v_aluno_id uuid := 'UUID_ALUNO';
  v_agendamento_id uuid := 'UUID_AGENDAMENTO';
  v_rec RECORD;
  v_respostas jsonb;
  v_total int; v_acertos int;
  v_questao_id text; v_resposta text; v_correta text;
  v_percentual numeric;
BEGIN
  UPDATE prova_agendamentos SET resultado = NULL, status = 'iniciado'
  WHERE id = v_agendamento_id;

  FOR v_rec IN SELECT id, materia, respostas FROM prova_resultados 
               WHERE agendamento_id = v_agendamento_id
  LOOP
    v_total := 0; v_acertos := 0;
    FOR v_questao_id, v_resposta IN SELECT * FROM jsonb_each_text(v_rec.respostas) LOOP
      v_total := v_total + 1;
      SELECT pq.resposta_correta INTO v_correta FROM prova_questoes pq WHERE pq.id = v_questao_id::uuid;
      IF UPPER(v_correta) = UPPER(v_resposta) THEN v_acertos := v_acertos + 1; END IF;
    END LOOP;
    v_percentual := CASE WHEN v_total > 0 THEN round((v_acertos::numeric / v_total) * 100, 1) ELSE 0 END;
    UPDATE prova_resultados SET total_acertos = v_acertos, percentual = v_percentual,
      aprovado = (v_percentual >= 60), finalizado_em = now() WHERE id = v_rec.id;
  END LOOP;
END; $$;
```

## Enums — Valores Válidos
Sempre verificar antes de usar em WHERE/INSERT:
```sql
SELECT enum_range(NULL::payment_status);  -- aberto,pago,isento,parcial,cancelado
SELECT enum_range(NULL::sexo_aluno);       -- Masculino,Feminino
SELECT enum_range(NULL::origem_aluno);     -- Google,Meta,Indicação,Outros,Lançamento
```

## Dicas para Supabase SQL Editor
- Rodar blocos com `$$` separadamente (não misturar múltiplas functions com `$$` no mesmo bloco)
- Quando aparecer "Possível problema detectado" sobre RLS → clicar "Executar sem RLS"
- Quando aparecer "operações destrutivas" (DROP) → clicar "Executar consulta"
- Na aba anônima para evitar conflitos com extensões de tradução
- Desativar Chrome Translate na página do Supabase
