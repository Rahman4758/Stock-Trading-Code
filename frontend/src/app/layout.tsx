import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { SyncMonitor } from "@/components/layout/SyncMonitor";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { MarketFlowProvider } from "@/context/MarketFlowContext";
import { QueryProvider } from "@/components/QueryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "InstitutionalEdge",
  description: "Advanced Stock Selection & Tracking Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn(inter.className, "bg-background text-foreground antialiased")}>
        <QueryProvider>
          <Toaster richColors closeButton position="top-right" />
          <SyncMonitor />
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto bg-background/50 p-8">
              <MarketFlowProvider>{children}</MarketFlowProvider>
            </main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}

