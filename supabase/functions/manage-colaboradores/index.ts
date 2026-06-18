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
      },
    );

    const body = await req.json();
    const { action, email, password, nome, polo_id, setor, id, ativo, permissoes, responsavel_polo, comissao_avista, comissao_parcelado } = body;

    if (action === "create_colaborador") {
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nome,
          role: setor === "Admin Polo" ? "admin_polo" : "colaborador",
        },
      });

      if (authError) throw authError;

      const { data: colaborador, error: colabError } = await supabaseAdmin
        .from("colaboradores")
        .insert({
          user_id: authUser.user.id,
          nome,
          email,
          polo_id,
          setor,
          ativo: true,
          responsavel_polo: !!responsavel_polo,
          ...(comissao_avista !== undefined ? { comissao_avista } : {}),
          ...(comissao_parcelado !== undefined ? { comissao_parcelado } : {}),
        })
        .select()
        .single();

      if (colabError) throw colabError;

      const permsToInsert = responsavel_polo
        ? Object.fromEntries(Object.keys(permissoes || {}).map((k) => [k, true]))
        : permissoes || {};

      const { error: permError } = await supabaseAdmin.from("colaborador_permissoes").insert({
        colaborador_id: colaborador.id,
        ...permsToInsert,
      });

      if (permError) throw permError;

      return new Response(JSON.stringify({ success: true, colaborador }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_colaborador") {
      if (!id) throw new Error("ID do colaborador não informado");

      const { data: colab, error: findError } = await supabaseAdmin
        .from("colaboradores")
        .select("user_id")
        .eq("id", id)
        .single();

      if (findError) throw findError;

      const authUpdates: any = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      if (nome) authUpdates.user_metadata = { nome };

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(colab.user_id, authUpdates);
        if (authError) throw new Error(`Auth update error: ${authError.message}`);
      }

      const colabUpdates: any = {};
      if (nome) colabUpdates.nome = nome;
      if (email) colabUpdates.email = email;
      if (polo_id) colabUpdates.polo_id = polo_id;
      if (setor) colabUpdates.setor = setor;
      if (ativo !== undefined) colabUpdates.ativo = ativo;
      if (responsavel_polo !== undefined) colabUpdates.responsavel_polo = !!responsavel_polo;
      if (comissao_avista !== undefined) colabUpdates.comissao_avista = comissao_avista;
      if (comissao_parcelado !== undefined) colabUpdates.comissao_parcelado = comissao_parcelado;

      const { error: colabError } = await supabaseAdmin.from("colaboradores").update(colabUpdates).eq("id", id);

      if (colabError) throw new Error(`Colab update error: ${colabError.message}`);

      if (permissoes || responsavel_polo) {
        const permsToUpdate = responsavel_polo
          ? Object.fromEntries(Object.keys(permissoes || {}).map((k) => [k, true]))
          : permissoes;
        if (permsToUpdate) {
          const { error: permError } = await supabaseAdmin
            .from("colaborador_permissoes")
            .update(permsToUpdate)
            .eq("colaborador_id", id);
          if (permError) throw new Error(`Perm update error: ${permError.message}`);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_colaborador") {
      if (!id) throw new Error("ID do colaborador não informado");

      const { data: colab, error: findError } = await supabaseAdmin
        .from("colaboradores")
        .select("user_id")
        .eq("id", id)
        .single();

      if (findError) throw new Error(`Colaborador não encontrado: ${findError.message}`);

      // Deletar do Auth (só se tiver user_id)
      if (colab.user_id) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(colab.user_id);
        if (authError) throw new Error(`Auth delete error: ${authError.message}`);
      }

      // Deletar permissões manualmente
      await supabaseAdmin.from("colaborador_permissoes").delete().eq("colaborador_id", id);

      // Deletar colaborador
      const { error: colabError } = await supabaseAdmin.from("colaboradores").delete().eq("id", id);

      if (colabError) throw new Error(`Colab delete error: ${colabError.message}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const message = error?.message || JSON.stringify(error) || "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
