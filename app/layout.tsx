import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import Script from "next/script"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import { ErrorReporter, ConsoleReporter, ReactErrorBoundary } from "@/components/error-reporter"
import { AppAnalytics } from "@/components/app-analytics"
import { ThemeProvider } from "@/components/theme-provider"
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"
import { AppInstallRegistration } from "@/components/app-install-registration"
import { OfflineQuranSync } from "@/components/offline-quran-sync"

const ibmPlexArabic = localFont({
  src: [
    { path: "./fonts/IBMPlexSansArabic-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSansArabic-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexSansArabic-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/IBMPlexSansArabic-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-ibm-plex-arabic",
  display: "swap",
})

const amiriQuran = localFont({
  src: "./fonts/AmiriQuran.ttf",
  variable: "--font-amiri-quran",
  display: "swap",
})

const paletteInitializationScript = `(function(){try{
var k="wird-color-palette-v1",p=localStorage.getItem(k),a=["olive","turquoise","gold","blue","beige","charcoal","custom"];
if(p==="ruby")p="gold";if(p==="plum")p="charcoal";if(!a.includes(p))p="olive";
localStorage.setItem(k,p);document.documentElement.dataset.palette=p;
var c=null;if(p==="custom")try{c=JSON.parse(localStorage.getItem("wird-custom-palette-v1")||"null")}catch(e){}
var h=function(v,d){return typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v)?v:d};
if(p==="custom"){
c={primary:h(c&&c.primary,"#276653"),accent:h(c&&c.accent,"#d6b55d"),background:h(c&&c.background,"#f5f1e7")};
var q=function(x){var v=[1,3,5].map(function(o){var n=parseInt(x.slice(o,o+2),16)/255;return n<=.03928?n/12.92:Math.pow((n+.055)/1.055,2.4)});return v[0]*.2126+v[1]*.7152+v[2]*.0722>.47?"#17201d":"#ffffff"},f=q(c.background),pf=q(c.primary),af=q(c.accent),st=f==="#ffffff"?"#ffffff":"#000000",sr=f==="#ffffff"?"8%":"3%",s=document.documentElement.style,m=function(n,v){s.setProperty(n,v)};
m("--background",c.background);m("--foreground",f);m("--card","color-mix(in srgb, "+c.background+", "+st+" "+sr+")");m("--card-foreground",f);m("--popover","color-mix(in srgb, "+c.background+", "+st+" "+sr+")");m("--popover-foreground",f);m("--primary",c.primary);m("--primary-foreground",pf);m("--secondary","color-mix(in srgb, "+c.accent+", "+c.background+" 72%)");m("--secondary-foreground",f);m("--muted","color-mix(in srgb, "+c.background+", "+f+" 7%)");m("--muted-foreground","color-mix(in srgb, "+f+", "+c.background+" 38%)");m("--accent",c.accent);m("--accent-foreground",af);m("--border","color-mix(in srgb, "+f+", transparent 78%)");m("--input","color-mix(in srgb, "+f+", transparent 78%)");m("--ring",c.primary);m("--quran-active",c.primary);m("--mushaf-paper","color-mix(in srgb, "+c.background+", "+st+" "+sr+")");m("--mushaf-ink",f);m("--mushaf-border","color-mix(in srgb, "+c.primary+", transparent 42%)");m("--mushaf-meta","color-mix(in srgb, "+c.primary+", "+f+" 28%)");m("--quran-highlight",c.accent);m("--destructive","#b34a3c");m("--destructive-foreground","#ffffff");m("--chart-1",c.primary);m("--chart-2",c.accent);m("--chart-3","#b34a3c");m("--chart-4","#4d7196");m("--chart-5","#8a7a52");m("--sidebar","color-mix(in srgb, "+c.background+", "+st+" "+sr+")");m("--sidebar-foreground",f);m("--sidebar-primary",c.primary);m("--sidebar-primary-foreground",pf);m("--sidebar-accent","color-mix(in srgb, "+c.accent+", "+c.background+" 72%)");m("--sidebar-accent-foreground",f);m("--sidebar-border","color-mix(in srgb, "+f+", transparent 78%)");m("--sidebar-ring",c.primary)
}
var z={olive:["#276653","#182821"],turquoise:["#087f8c","#16363b"],gold:["#b58a28","#4b3b20"],blue:["#3f65ad","#202a42"],beige:["#806b58","#29251f"],charcoal:["#343434","#252525"]},t=localStorage.getItem("theme"),d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches),tc=p==="custom"?c.primary:z[p][d?1:0];
document.querySelectorAll('meta[name="theme-color"]').forEach(function(e){e.content=tc})
}catch(e){document.documentElement.dataset.palette="olive"}})();`

export const metadata: Metadata = {
  title: "وِردي | رفيق الحفظ والمراجعة",
  description: "تطبيق لمراجعة القرآن الكريم وحفظه.",
  applicationName: "وِرد",
  icons: {
    icon: "/icons/wird-192.png",
    apple: "/icons/wird-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "وِرد",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#276653" },
    { media: "(prefers-color-scheme: dark)", color: "#182821" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${ibmPlexArabic.variable} ${amiriQuran.variable}`}
    >
      <head>
        <script
          id="wird-palette"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: paletteInitializationScript }}
        />
        <script
          id="wird-accessibility"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem("wird-player-settings")||"{}"),v=["large","xlarge"].includes(s.appTextScale)?s.appTextScale:s.largeAppText?"large":"normal";document.documentElement.dataset.appTextScale=v}catch(e){}})();`,
          }}
        />
        <Script
          id="wird-install-prompt"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener("beforeinstallprompt",function(event){event.preventDefault();window.__wirdDeferredInstallPrompt=event});`,
          }}
        />
        <link
          rel="preload"
          href="https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="https://cdn.jsdelivr.net/npm/quran-qcf4@1.0.3/fonts-woff2/QCF4_Hafs_01_W.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="https://cdn.jsdelivr.net/npm/quran-qcf4@1.0.3/fonts-woff2/QCF4_QBSML.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <ReactErrorBoundary>
            {children}
          </ReactErrorBoundary>
          <Toaster
            position="bottom-left"
            visibleToasts={2}
            gap={4}
            duration={2400}
            offset={{ bottom: "calc(var(--wird-player-height, 72px) + 8px)", left: 10 }}
            mobileOffset={{ bottom: "calc(var(--wird-player-height, 72px) + 8px)", left: 8 }}
          />
          <ErrorReporter />
          <ConsoleReporter />
          <AppAnalytics />
          <AppInstallRegistration />
          <ServiceWorkerRegistration />
          <OfflineQuranSync />
        </ThemeProvider>
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","xxffl3r0zd");`,
          }}
        />
      </body>
    </html>
  );
}
