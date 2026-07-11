import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useVendedoras(
  poloId?: string | null,
  opts?: { includeInactive?: boolean }
) {
  const includeInactive = opts?.includeInactive ?? false;
  return useQuery({
    queryKey: ["vendedoras", poloId ?? "all", includeInactive ? "all-status" : "ativas"],
    queryFn: async () => {
      let q = supabase
        .from("colaboradores")
        .select("id, nome, ativo")
        .eq("setor", "Vendedor")
        .order("nome", { ascending: true });
      if (!includeInactive) q = q.eq("ativo", true);
      if (poloId && poloId !== "all") q = q.eq("polo_id", poloId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; ativo: boolean }[];
    },
    staleTime: 60_000,
  });
}
