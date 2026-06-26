import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const PANDA_API_KEY = "panda-7a993d492e405bbf56879fc04322ffda815f60f7c5762f74f2588e3607835cf9";
const PANDA_BASE = "https://api-v2.pandavideo.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    let folderName: string | undefined;
    try {
      const body = await req.json();
      folderName = body?.folder_name;
    } catch {
      // sem body — ok
    }

    const foldersResp = await fetch(`${PANDA_BASE}/folders`, {
      headers: { Authorization: PANDA_API_KEY },
    });
    const foldersData = await foldersResp.json();
    const folders = foldersData.folders || foldersData || [];

    // Sem folder_name → retorna apenas a lista de pastas disponíveis
    if (!folderName) {
      return new Response(
        JSON.stringify({
          success: true,
          pastas: folders.map((f: any) => ({ id: f.id, name: f.name })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const folder = folders.find(
      (f: any) => (f.name || "").toLowerCase() === folderName!.toLowerCase()
    );

    if (!folder) {
      return new Response(
        JSON.stringify({ error: `Pasta "${folderName}" não encontrada no Panda Video` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const videosResp = await fetch(
      `${PANDA_BASE}/videos?folder_id=${folder.id}&limit=100`,
      { headers: { Authorization: PANDA_API_KEY } }
    );
    const videosData = await videosResp.json();
    const videos = videosData.videos || videosData || [];

    const { data: curso } = await supabase
      .from("cursos")
      .select("id, nome")
      .ilike("nome", folder.name)
      .maybeSingle();

    if (!curso) {
      return new Response(
        JSON.stringify({
          success: false,
          pasta: folder.name,
          status: "curso não encontrado no banco",
          videos: videos.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let inseridos = 0;
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const playerUrl = `https://player.pandavideo.com.br/embed/?v=${v.video_id || v.id}`;

      const { error } = await supabase.from("aulas").upsert(
        {
          curso_id: curso.id,
          titulo: v.title || v.name,
          url_video: playerUrl,
          ordem: i + 1,
          ativo: true,
        },
        { onConflict: "curso_id,ordem" }
      );

      if (!error) inseridos++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        pasta: folder.name,
        curso: curso.nome,
        videos: videos.length,
        inseridos,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
