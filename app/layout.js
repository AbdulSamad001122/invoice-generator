import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ClientProvider } from "@/contexts/ClientContext";
import { ItemProvider } from "@/contexts/ItemContext";
import { InvoiceProvider } from "@/contexts/InvoiceContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { Analytics } from "@vercel/analytics/next";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import SidebarAwareNavbar from "@/components/SidebarAwareNavbar";
import { themeInitScript } from "@/lib/themeScript";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Invoice Generator",
    template: "%s · Invoice Generator",
  },
  description: "Create professional invoices with client management",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      appearance={{
        variables: { colorPrimary: "#171717", borderRadius: "0.625rem" },
      }}
    >
      <html lang="en" suppressHydrationWarning={true}>
        <head>
          {/* Apply the saved theme before first paint (no light flash in dark mode) */}
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider>
            <ToastProvider>
              <ClientProvider>
                <ItemProvider>
                  <InvoiceProvider>
                    <SidebarProvider>
                      <AppSidebar />
                      <SidebarInset>
                        <div className="flex flex-col min-h-screen">
                          <SidebarAwareNavbar />
                          <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:px-8 md:py-8">
                            {children}
                          </main>
                        </div>
                      </SidebarInset>
                    </SidebarProvider>
                    <Analytics />
                  </InvoiceProvider>
                </ItemProvider>
              </ClientProvider>
            </ToastProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
