import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useVendedoras(poloId?: string | null) {
  return useQuery({
    queryKey: ["vendedoras-ativas", poloId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("colaboradores")
        .select("id, nome")
        .eq("setor", "Vendedor")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      if (poloId && poloId !== "all") q = q.eq("polo_id", poloId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
    staleTime: 60_000,
  });
}
