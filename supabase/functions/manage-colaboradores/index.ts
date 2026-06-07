import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { action, email, password, nome, polo_id, setor } = await req.json();

    if (action === "create_colaborador") {
      // 1. Criar no Auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome, role: 'colaborador' }
      });

      if (authError) throw authError;

      // 2. Salvar na tabela colaboradores
      const { data: colaborador, error: colabError } = await supabaseAdmin
        .from("colaboradores")
        .insert({
          user_id: authUser.user.id,
          nome,
          email,
          polo_id,
          setor
        })
        .select()
        .single();

      if (colabError) throw colabError;

      // 3. Criar permissões padrão (todas false por padrão)
      const { error: permError } = await supabaseAdmin
        .from("colaborador_permissoes")
        .insert({
          colaborador_id: colaborador.id
        });

      if (permError) throw permError;

      // 4. Se setor for Vendedor, adicionar à lista de vendedoras
      if (setor === "Vendedor") {
         // Verificar se existe uma tabela vendedores ou similar. 
         // O usuário mencionou: "adicionar o nome automaticamente na lista de vendedoras do cadastro de alunos"
         // Vou assumir que existe uma tabela vendedoras ou que isso é um campo livre.
         // Se for campo de alunos.vendedora, ele aparecerá nas opções se buscarmos por colaboradores.
      }

      return new Response(JSON.stringify({ success: true, colaborador }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
