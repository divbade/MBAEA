import Sidebar from "@/components/Sidebar";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main
                className="flex-1 p-8"
                style={{ marginLeft: "var(--sidebar-width)" }}
            >
                <div className="max-w-5xl mx-auto">{children}</div>
            </main>
        </div>
    );
}
