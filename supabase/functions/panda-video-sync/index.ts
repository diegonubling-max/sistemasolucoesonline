import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const PANDA_API_KEY = "panda-7a993d492e405bbf56879fc04322ffda815f60f7c5762f74f2588e3607835cf9";
const PANDA_BASE = "https://api-v2.pandavideo.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const MAPEAMENTO_CURSOS: Record<string, string> = {
  "Excel": "Excel Básico e Avançado",
  "Microsoft Word": "Word",
  "Inteligência Artificial": "Inteligencia Artificial - IA",
  "PhotoShop CC": "Photoshop",
  "Power BI": "Power BI",
  "Power Point": "Power Point",
  "Programação de sites Wordpress": "Wordpress",
  "Segurança na Internet": "Segurança na Internet",
  "SketchUp": "SketchUp",
  "Canva": "Canva",
  "Eletricista": "Eletricista",
};

function extrairOrdemDoTitulo(titulo: string, fallback: number): number {
  const m = (titulo || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : fallback;
}

async function processFolder(supabase: any, folders: any[], folderName: string, mode: "insert" | "update" | "update_by_title" = "insert", cursoNome?: string, ordemMinima: number = 0, parentFolder?: string) {
  let parentId: string | null | undefined = undefined;
  if (parentFolder) {
    const parent = folders.find(
      (f: any) => (f.name || "").toLowerCase() === parentFolder.toLowerCase()
    );
    if (!parent) {
      return { folder_name: folderName, error: `Pasta pai "${parentFolder}" não encontrada no Panda Video` };
    }
    parentId = parent.id;
  }

  const folder = folders.find(
    (f: any) =>
      (f.name || "").toLowerCase() === folderName.toLowerCase() &&
      (parentId === undefined || f.parent_folder_id === parentId)
  );

  if (!folder) {
    return { folder_name: folderName, error: `Pasta "${folderName}" não encontrada no Panda Video` };
  }

  const videosResp = await fetch(
    `${PANDA_BASE}/videos?folder_id=${folder.id}&limit=100`,
    { headers: { Authorization: PANDA_API_KEY } }
  );
  const videosData = await videosResp.json();
  const videos = videosData.videos || videosData || [];

  const nomeCurso = cursoNome || MAPEAMENTO_CURSOS[folder.name] || folder.name;
  const { data: curso } = await supabase
    .from("cursos")
    .select("id, nome")
    .ilike("nome", nomeCurso)
    .maybeSingle();

  if (!curso) {
    return {
      success: false,
      pasta: folder.name,
      status: "curso não encontrado no banco",
      videos: videos.length,
    };
  }

  if (mode === "update") {
    // Buscar aulas existentes do curso com url_video do YouTube
    const { data: aulasExistentes } = await supabase
      .from("aulas")
      .select("id, ordem, url_video, titulo")
      .eq("curso_id", curso.id);

    let atualizados = 0;
    const detalhes: any[] = [];
    const naoAtualizados: any[] = [];

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const titulo = v.title || v.name || "";
      const ordem = extrairOrdemDoTitulo(titulo, i + 1);
      const playerUrl =
        v.video_player ||
        `https://player.pandavideo.com.br/embed/?v=${v.video_id || v.id}`;

      const aula = (aulasExistentes || []).find((a: any) => a.ordem === ordem);
      if (!aula) {
        naoAtualizados.push({ ordem, motivo: "aula não encontrada" });
        continue;
      }
      if (!(aula.url_video || "").includes("youtube.com")) {
        naoAtualizados.push({ ordem, motivo: "url_video não é youtube" });
        continue;
      }

      const { error } = await supabase
        .from("aulas")
        .update({ url_video: playerUrl })
        .eq("id", aula.id);

      if (!error) {
        atualizados++;
        detalhes.push({ ordem, titulo: aula.titulo, nova_url: playerUrl });
      } else {
        naoAtualizados.push({ ordem, motivo: error.message });
      }
    }

    return {
      success: true,
      mode: "update",
      pasta: folder.name,
      curso: curso.nome,
      videos: videos.length,
      atualizados,
      nao_atualizados: naoAtualizados.length,
      detalhes: detalhes.slice(0, 5),
      nao_atualizados_detalhes: naoAtualizados.slice(0, 5),
    };
  }

  if (mode === "update_by_title") {
    const { data: aulasExistentes } = await supabase
      .from("aulas")
      .select("id, ordem, titulo, url_video")
      .eq("curso_id", curso.id);

    const porOrdem = new Map<number, any>();
    (aulasExistentes || []).forEach((a: any) => porOrdem.set(a.ordem, a));

    let atualizados = 0;
    let inseridos = 0;
    const detalhes: any[] = [];
    const naoAtualizados: any[] = [];

    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      const titulo = v.title || v.name || "";
      const ordem = extrairOrdemDoTitulo(titulo, i + 1);
      const playerUrl =
        v.video_player ||
        `https://player.pandavideo.com.br/embed/?v=${v.video_id || v.id}`;

      const aula = porOrdem.get(ordem);
      if (aula) {
        const { error } = await supabase
          .from("aulas")
          .update({ url_video: playerUrl })
          .eq("id", aula.id);
        if (!error) {
          atualizados++;
          detalhes.push({ ordem, titulo: aula.titulo, nova_url: playerUrl });
        } else {
          naoAtualizados.push({ ordem, motivo: error.message });
        }
      } else {
        const { error } = await supabase.from("aulas").insert({
          curso_id: curso.id,
          titulo,
          url_video: playerUrl,
          duracao_segundos: Math.round(v.length || 0),
          ordem,
          ativo: true,
        });
        if (!error) {
          inseridos++;
          detalhes.push({ ordem, titulo, nova_url: playerUrl, inserido: true });
        } else {
          naoAtualizados.push({ ordem, motivo: error.message });
        }
      }
    }

    return {
      success: true,
      mode: "update_by_title",
      pasta: folder.name,
      curso: curso.nome,
      videos: videos.length,
      atualizados,
      inseridos,
      nao_atualizados: naoAtualizados.length,
      detalhes: detalhes.slice(0, 10),
      nao_atualizados_detalhes: naoAtualizados.slice(0, 5),
    };
  }

  let inseridos = 0;
  let pulados = 0;
  const pulados_detalhes: any[] = [];
  const erros_insert: any[] = [];

  const { data: aulasExistentesInsert } = await supabase
    .from("aulas")
    .select("ordem")
    .eq("curso_id", curso.id);
  const ordensExistentes = new Set<number>((aulasExistentesInsert || []).map((a: any) => a.ordem));

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const titulo = v.title || v.name || "";
    const ordem = extrairOrdemDoTitulo(titulo, i + 1);

    if (ordem < ordemMinima) {
      pulados++;
      pulados_detalhes.push({ ordem, titulo: v.title || v.name, motivo: `ordem < ${ordemMinima}` });
      continue;
    }

    if (ordensExistentes.has(ordem)) {
      pulados++;
      pulados_detalhes.push({ ordem, titulo: v.title || v.name, motivo: "ordem já existe" });
      continue;
    }

    const playerUrl =
      v.video_player ||
      `https://player.pandavideo.com.br/embed/?v=${v.video_id || v.id}`;

    const { error } = await supabase.from("aulas").insert({
      curso_id: curso.id,
      titulo: v.title || v.name,
      url_video: playerUrl,
      duracao_segundos: Math.round(v.length || 0),
      ordem,
      ativo: true,
    });

    if (!error) {
      inseridos++;
      ordensExistentes.add(ordem);
    } else {
      erros_insert.push({ ordem, titulo: v.title || v.name, error });
    }
  }


  return {
    success: true,
    mode: "insert",
    pasta: folder.name,
    curso: curso.nome,
    videos: videos.length,
    inseridos,
    pulados,
    pulados_detalhes: pulados_detalhes.slice(0, 10),
    videos_raw: videos.slice(0, 2),
    erro_insert: erros_insert[0] ?? null,
    erros_insert,
  };
}



serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    let folderName: string | undefined;
    let folderNames: string[] | undefined;
    let cursoNome: string | undefined;
    let ordemMinima = 0;
    let mode: "insert" | "update" | "update_by_title" = "insert";
    let parentFolder: string | undefined;
    try {
      const body = await req.json();
      folderName = body?.folder_name;
      folderNames = body?.folder_names;
      cursoNome = body?.curso_nome;
      parentFolder = body?.parent_folder;
      if (typeof body?.ordem_minima === "number") ordemMinima = body.ordem_minima;
      if (body?.update_mode === true) mode = "update_by_title";
      else if (body?.mode === "update") mode = "update";
      else if (body?.mode === "update_by_title") mode = "update_by_title";
    } catch {
      // sem body — ok
    }

    const foldersResp = await fetch(`${PANDA_BASE}/folders`, {
      headers: { Authorization: PANDA_API_KEY },
    });
    const foldersData = await foldersResp.json();
    const folders = foldersData.folders || foldersData || [];

    // Array de pastas → processar em paralelo
    if (Array.isArray(folderNames) && folderNames.length > 0) {
      const resultados = await Promise.all(
        folderNames.map((name) => processFolder(supabase, folders, name, mode, cursoNome, ordemMinima, parentFolder))
      );
      return new Response(
        JSON.stringify({ success: true, mode, resultados }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resultado = await processFolder(supabase, folders, folderName, mode, cursoNome, ordemMinima, parentFolder);
    const status = (resultado as any).error ? 404 : 200;
    return new Response(JSON.stringify(resultado), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
