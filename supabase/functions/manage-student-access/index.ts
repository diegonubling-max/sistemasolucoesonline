import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, nome, action, password, newPassword } = await req.json()

    if (action === 'reset_password') {
      const { data: users, error: listError } = await supabaseClient.auth.admin.listUsers()
      if (listError) throw listError
      
      const user = users.users.find(u => u.email === email)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: updateError } = await supabaseClient.auth.admin.updateUserById(user.id, {
        password: newPassword
      })
      if (updateError) throw updateError

      return new Response(JSON.stringify({ message: 'Senha atualizada com sucesso' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (action === 'delete_user') {
      const { data: users, error: listError } = await supabaseClient.auth.admin.listUsers()
      if (listError) throw listError
      
      const user = users.users.find(u => u.email === email)
      if (!user) {
        return new Response(JSON.stringify({ message: 'Usuário não encontrado no Auth, ignorando' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(user.id)
      if (deleteError) throw deleteError

      return new Response(JSON.stringify({ message: 'Usuário removido do Auth com sucesso' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'create') {
      // Create user with provided password
      const { data: authUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email,
        password: password,
        email_confirm: true,
        user_metadata: { nome }
      })

      if (createError) throw createError

      // Assign role
      const { error: roleError } = await supabaseClient.from('user_roles').insert({
        user_id: authUser.user.id,
        role: 'aluno'
      })

      if (roleError) throw roleError

      return new Response(JSON.stringify({ 
        message: 'Acesso criado com sucesso', 
        user_id: authUser.user.id,
        is_new: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'recreate_admin') {
      const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? ''
      const adminPassword = Deno.env.get('ADMIN_PASSWORD') ?? ''
      if (!adminEmail || !adminPassword) {
        return new Response(JSON.stringify({ error: 'ADMIN_EMAIL/ADMIN_PASSWORD não configurados' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: users, error: listError } = await supabaseClient.auth.admin.listUsers()
      if (listError) throw listError
      const existing = users.users.find(u => u.email === adminEmail)

      let userId: string
      if (existing) {
        const { error: updErr } = await supabaseClient.auth.admin.updateUserById(existing.id, {
          password: adminPassword,
          email_confirm: true,
        })
        if (updErr) throw updErr
        userId = existing.id
      } else {
        const { data: created, error: createErr } = await supabaseClient.auth.admin.createUser({
          email: adminEmail,
          password: adminPassword,
          email_confirm: true,
        })
        if (createErr) throw createErr
        userId = created.user.id
      }

      // Garante role de administrador
      const { data: roles } = await supabaseClient
        .from('user_roles').select('id').eq('user_id', userId).eq('role', 'administrador')
      if (!roles || roles.length === 0) {
        const { error: roleErr } = await supabaseClient
          .from('user_roles').insert({ user_id: userId, role: 'administrador' })
        if (roleErr) throw roleErr
      }

      return new Response(JSON.stringify({
        message: existing ? 'Admin resetado com sucesso' : 'Admin criado com sucesso',
        email: adminEmail,
        user_id: userId,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})