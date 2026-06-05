import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/admin/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeadsRegistration } from "@/components/admin/performance/LeadsRegistration";
import { PerformanceAnalysis } from "@/components/admin/performance/PerformanceAnalysis";
import { ClipboardList, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_admin/performance")({
  head: () => ({ meta: [{ title: "Performance — EduManager" }] }),
  component: Performance,
});

function Performance() {
  return (
    <div className="space-y-8">
      <PageHeader 
        title="Performance" 
        description="Acompanhamento de leads e conversão de vendas" 
      />

      <Tabs defaultValue="analise" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="registro" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Registro de Leads
          </TabsTrigger>
          <TabsTrigger value="analise" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Análise
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registro" className="mt-6">
          <LeadsRegistration />
        </TabsContent>

        <TabsContent value="analise" className="mt-6">
          <PerformanceAnalysis />
        </TabsContent>
      </Tabs>
    </div>
  );
}
