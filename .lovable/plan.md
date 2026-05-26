## Problema
O enum `app_role` no banco só aceita `'admin'` e `'aluno'`. As policies criadas recentemente (`is_admin()`) e o botão "Recriar Admin" tentam usar `'administrador'`, que não existe no enum — daí o erro `invalid input value for enum app_role: "administrador"` ao inserir o role, e o RLS de `cursos` bloqueando o admin (que nunca recebeu o papel correto).

## Correção (padronizar tudo em `'admin'`)

1. **Migração SQL**
   - Recriar `is_admin()` e `is_student()` usando os valores existentes do enum (`'admin'`, `'aluno'`).
   - (Nenhuma alteração de policies necessária — elas usam as funções.)

2. **Edge function `manage-student-access`** (ação `recreate_admin`)
   - Trocar o insert/select de `user_roles` de `role: 'administrador'` para `role: 'admin'`.

3. **Verificação**
   - Após o deploy, clicar em "Recriar Admin", relogar e tentar salvar um curso.

Nenhuma outra funcionalidade é alterada.