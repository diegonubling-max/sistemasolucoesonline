O problema real é que o usuário `diegonubling@gmail.com` não existe mais no sistema de autenticação, por isso qualquer senha retorna “Invalid login credentials”.

Plano de correção:

1. Recriar/resetar o usuário administrador
   - Executar a ação existente `recreate_admin` para criar novamente o login `diegonubling@gmail.com`.
   - Definir a senha usando o valor atual configurado em `ADMIN_PASSWORD`.

2. Validar permissões
   - Conferir se o usuário recriado recebeu a role `admin` em `user_roles`.
   - Garantir que ele tenha acesso às telas administrativas.

3. Orientar novo teste
   - Após recriar, você deve tentar entrar novamente com `diegonubling@gmail.com` e a senha do `ADMIN_PASSWORD`.

Não vou alterar nenhuma funcionalidade do sistema; a ação será apenas recuperar o acesso do administrador.