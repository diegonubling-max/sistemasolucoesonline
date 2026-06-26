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
    const foldersResp = await fetch(`${PANDA_BASE}/folders`, {
      headers: { Authorization: PANDA_API_KEY },
    });
    const foldersData = await foldersResp.json();
    const folders = foldersData.folders || foldersData || [];

    const resultados: any[] = [];

    for (const folder of folders) {
      const videosResp = await fetch(
        `${PANDA_BASE}/videos?folder_id=${folder.id}&per_page=100`,
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
        resultados.push({ pasta: folder.name, status: "curso não encontrado no banco" });
        continue;
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

      resultados.push({
        pasta: folder.name,
        curso: curso.nome,
        videos: videos.length,
        inseridos,
      });
    }

    return new Response(JSON.stringify({ success: true, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
