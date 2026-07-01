import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface BannerCarouselProps {
  poloId?: string | null;
}

export function BannerCarousel({ poloId: poloIdProp }: BannerCarouselProps) {
  const { session } = useAuth();
  const [index, setIndex] = useState(0);

  // Busca o polo_id direto do aluno logado (fallback caso prop não venha)
  const { data: poloIdFromAluno } = useQuery({
    queryKey: ["banner-aluno-polo", session?.user.email],
    queryFn: async () => {
      const { data } = await supabase
        .from("alunos")
        .select("polo_id")
        .eq("email", session?.user.email ?? "")
        .maybeSingle();
      return (data as any)?.polo_id ?? null;
    },
    enabled: !!session?.user.email && !poloIdProp,
  });

  const poloId = poloIdProp ?? poloIdFromAluno ?? null;

  const { data: banners } = useQuery({
    queryKey: ["student-banners", poloId],
    queryFn: async () => {
      if (!poloId) return [];
      const { data, error } = await supabase
        .from("banners_polo")
        .select("id, titulo, imagem_url, ordem")
        .eq("polo_id", poloId)
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!poloId,
  });

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % banners.length);
    }, 5000);
    return () => clearInterval(t);
  }, [banners]);

  if (!banners || banners.length === 0) {
    return (
      <div className="relative w-full h-[180px] md:h-[400px] sm:rounded-2xl overflow-hidden bg-gradient-to-r from-[#1E3A5F] to-[#2D6ADF] flex items-center px-4 sm:px-8 md:px-12 shadow-2xl">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold text-white tracking-tight">
            Bem-vindo(a) de volta!
          </h1>
          <p className="text-sm sm:text-lg md:text-xl text-white/80">
            Continue seus estudos de onde você parou.
          </p>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-l from-white/10 to-transparent pointer-events-none" />
      </div>
    );
  }

  const safeIndex = Math.min(index, banners.length - 1);

  return (
    <div className="relative w-full h-[400px] sm:rounded-2xl overflow-hidden shadow-lg bg-gray-100">
      {banners.map((b, i) => (
        <img
          key={b.id}
          src={b.imagem_url}
          alt={b.titulo || `Banner ${i + 1}`}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-700",
            i === safeIndex ? "opacity-100" : "opacity-0"
          )}
        />
      ))}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 z-10">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Ir para banner ${i + 1}`}
              className={cn(
                "h-2 rounded-full transition-all",
                i === safeIndex ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

