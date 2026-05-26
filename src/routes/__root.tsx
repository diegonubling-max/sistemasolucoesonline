import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Soluções Online" },
      { name: "description", content: "Sistema de gestão educacional" },
      { property: "og:title", content: "Soluções Online" },
      { name: "twitter:title", content: "Soluções Online" },
      { property: "og:description", content: "Sistema de gestão educacional" },
      { name: "twitter:description", content: "Sistema de gestão educacional" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9cb2a8bd-1438-4cc0-a70c-137c71ea470e/id-preview-a72e1abf--5b395dc8-3c40-4219-b045-de4f2ca28917.lovable.app-1779763984598.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9cb2a8bd-1438-4cc0-a70c-137c71ea470e/id-preview-a72e1abf--5b395dc8-3c40-4219-b045-de4f2ca28917.lovable.app-1779763984598.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();

  useEffect(() => {
    const isStudentArea = location.pathname.startsWith('/aluno') || location.pathname === '/_student';
    const body = document.body;
    if (isStudentArea) {
      document.documentElement.classList.add('student-area');
      body.style.backgroundColor = '#141414';
      body.style.color = '#FFFFFF';
    } else {
      document.documentElement.classList.remove('student-area');
      body.style.backgroundColor = '';
      body.style.color = '';
    }
  }, [location.pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

