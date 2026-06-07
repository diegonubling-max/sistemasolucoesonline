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

    const body = await req.json();
    const { action, email, password, nome, polo_id, setor, id, ativo, permissoes } = body;

    if (action === "create_colaborador") {
      // 1. Criar no Auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { 
          nome, 
          role: setor === 'Admin Polo' ? 'admin_polo' : 'colaborador' 
        }
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
          setor,
          ativo: true
        })
        .select()
        .single();

      if (colabError) throw colabError;

      // 3. Criar permissões
      const { error: permError } = await supabaseAdmin
        .from("colaborador_permissoes")
        .insert({
          colaborador_id: colaborador.id,
          ...permissoes
        });

      if (permError) throw permError;

      return new Response(JSON.stringify({ success: true, colaborador }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_colaborador") {
      if (!id) throw new Error("ID do colaborador não informado");

      // 1. Buscar colaborador para pegar o user_id
      const { data: colab, error: findError } = await supabaseAdmin
        .from("colaboradores")
        .select("user_id")
        .eq("id", id)
        .single();
      
      if (findError) throw findError;

      // 2. Atualizar Auth se necessário
      const authUpdates: any = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      if (nome) authUpdates.user_metadata = { nome };

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          colab.user_id,
          authUpdates
        );
        if (authError) throw authError;
      }

      // 3. Atualizar tabela colaboradores
      const colabUpdates: any = {};
      if (nome) colabUpdates.nome = nome;
      if (email) colabUpdates.email = email;
      if (polo_id) colabUpdates.polo_id = polo_id;
      if (setor) colabUpdates.setor = setor;
      if (ativo !== undefined) colabUpdates.ativo = ativo;

      const { error: colabError } = await supabaseAdmin
        .from("colaboradores")
        .update(colabUpdates)
        .eq("id", id);

      if (colabError) throw colabError;

      // 4. Atualizar permissões se enviadas
      if (permissoes) {
        const { error: permError } = await supabaseAdmin
          .from("colaborador_permissoes")
          .update(permissoes)
          .eq("colaborador_id", id);
        
        if (permError) throw permError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_colaborador") {
      if (!id) throw new Error("ID do colaborador não informado");

      // 1. Buscar para pegar user_id
      const { data: colab, error: findError } = await supabaseAdmin
        .from("colaboradores")
        .select("user_id")
        .eq("id", id)
        .single();
      
      if (findError) throw findError;

      // 2. Deletar do Auth
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(colab.user_id);
      if (authError) throw authError;

      // 3. Deletar da tabela colaboradores (permissões deletam em cascata)
      const { error: colabError } = await supabaseAdmin
        .from("colaboradores")
        .delete()
        .eq("id", id);

      if (colabError) throw colabError;

      return new Response(JSON.stringify({ success: true }), {
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
