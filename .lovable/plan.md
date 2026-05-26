## Diagnóstico

O erro `new row violates row-level security policy for table "cursos"` acontece porque a tabela `cursos` só permite criar/editar registros quando a função `is_admin()` retorna verdadeiro.

Ao verificar o banco, encontrei que a tabela `user_roles` está vazia, ou seja: nenhum usuário está com o papel `admin`. Por isso, mesmo logado, o sistema não autoriza salvar cursos.

## O que precisa ser feito

1. Restaurar o usuário administrador correto na tabela `user_roles` com `role = 'admin'`.
2. Manter as políticas atuais de `cursos`, especialmente `Admins full access`, sem abrir acesso público.
3. Não alterar relacionamento entre alunos e cursos nesta correção.
4. Verificar se o botão/ação de “Recriar Admin” continua usando `admin`, não `administrador`.

## Correção proposta

Executar uma correção pontual no banco para inserir o role `admin` para o usuário configurado como administrador, usando o e-mail salvo em `ADMIN_EMAIL`/usuário admin existente.

## Resultado esperado

Depois disso, ao relogar como administrador, salvar curso deve voltar a funcionar, e excluir aluno não deve excluir cursos nem excluir curso deve excluir aluno.