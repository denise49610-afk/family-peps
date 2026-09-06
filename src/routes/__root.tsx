import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/shell";
import { EditorsProvider } from "@/components/editors-context";
import { EditorsHost } from "@/components/forms";
import { ChatWatch } from "@/components/chat-watch";
import { FamilyHydrator } from "@/components/family-hydrator";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Fami'Zen";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: APP_NAME },
      { name: "theme-color", content: "#F4EFE6" },
      {
        name: "description",
        content:
          "L'appli qui simplifie la vie de votre famille — claire, ludique, ensemble.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <EditorsProvider>
            <FamilyHydrator />
            <div className="zen-wash min-h-dvh">
              <AppShell>
                <Outlet />
              </AppShell>
              <EditorsHost />
              <ChatWatch />
              <Toaster richColors position="top-center" closeButton />
            </div>
          </EditorsProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
