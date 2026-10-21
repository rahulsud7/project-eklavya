import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata = {
  title: "Project Eklavya",
  description: "Democratizing 1-on-1 AI Mentorship",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-[#F6F4EE] text-[#24211D] min-h-screen antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}