import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Defensa en profundidad: el proxy ya redirige, pero cada segmento server-side
  // vuelve a verificar la sesión antes de renderizar datos.
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={session.user.name ?? session.user.email ?? ""} role={session.user.role} />
        <main className="flex-1 overflow-auto bg-background p-4">{children}</main>
      </div>
    </div>
  );
}
