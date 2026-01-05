import "./globals.css";

export const metadata = {
  title: "DotAgent - Agent Management",
  description: "Manage your AI agents with style",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-[#FFF8DC] text-black">{children}</body>
    </html>
  );
}
