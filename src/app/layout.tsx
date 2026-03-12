import "./globals.css";

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale?: string }>;
}>) {
  const { locale } = await params;
  const lang = locale === "nl" ? "nl" : locale === "en" ? "en" : "de";

  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
