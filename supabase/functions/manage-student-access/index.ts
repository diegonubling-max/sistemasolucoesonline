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

    const { email, nome, action, newPassword } = await req.json()

    if (action === 'reset_password') {
      // Find user by email
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

    // Default: Check/Create access
    // 1. Check if user exists
    const { data: listData, error: listError } = await supabaseClient.auth.admin.listUsers()
    if (listError) throw listError
    
    const existingUser = listData.users.find(u => u.email === email)
    
    if (existingUser) {
      // Ensure user has the role
      await supabaseClient.from('user_roles').upsert({
        user_id: existingUser.id,
        role: 'aluno'
      }, { onConflict: 'user_id' })

      return new Response(JSON.stringify({ 
        message: 'Acesso já existente vinculado', 
        user_id: existingUser.id,
        is_new: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Generate password
    const cleanNome = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    const base = cleanNome.substring(0, 4).padEnd(4, 'x')
    const year = new Date().getFullYear()
    const password = `${base}@${year}`

    // 3. Create user
    const { data: authUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome }
    })

    if (createError) throw createError

    // 4. Assign role
    const { error: roleError } = await supabaseClient.from('user_roles').insert({
      user_id: authUser.user.id,
      role: 'aluno'
    })

    if (roleError) throw roleError

    return new Response(JSON.stringify({ 
      message: 'Acesso criado com sucesso', 
      user_id: authUser.user.id,
      password,
      is_new: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
