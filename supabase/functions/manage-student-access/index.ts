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