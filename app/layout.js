import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";
import { MantineProvider, ColorSchemeScript } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { Bebas_Neue, Sora } from "next/font/google";
import { theme } from "./theme";

const titleFont = Bebas_Neue({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-title",
});

const bodyFont = Sora({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata = {
  title: "Golf Muerte Lenta",
  description: "Registro de jugadas y apuestas entre amigos de la ML",
  manifest: "/manifest.json",
  themeColor: "#F7F1E8",
  icons: {
    icon: [
      { url: "/logo_180.png", sizes: "180x180", type: "image/png" },
    ],
    apple: [
      { url: "/logo_180.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    title: "Golf Muerte Lenta",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es-MX"
      data-mantine-color-scheme="light"
      suppressHydrationWarning
    >
      <head>
        <ColorSchemeScript />
      </head>
      <body className={`${titleFont.variable} ${bodyFont.variable}`}>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <Notifications position="top-right" />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
