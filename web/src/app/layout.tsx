import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "STAMP - Similarity, Tree-building, & Alignment of Motifs and Profiles",
  description:
    "A web tool for characterizing similarities between transcription factor binding motifs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-gray-200 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <img src="/stamp-logo.jpg" alt="STAMP" className="h-14" />
              </a>
              <nav className="flex gap-6 text-sm text-gray-600">
                <a href="/" className="hover:text-gray-900">
                  Submit Job
                </a>
                <a
                  href="https://github.com/seqcode/stamp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gray-900"
                >
                  GitHub
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-gray-200 bg-gray-50 py-6 text-center text-sm text-gray-500">
            <p>
              STAMP v2.0 &mdash; Similarity, Tree-building, &amp; Alignment of
              Motifs and Profiles
            </p>
            <p className="mt-2 text-xs text-gray-400">
              <a
                href="https://academic.oup.com/nar/article/35/suppl_2/W253/2920802"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-500 underline underline-offset-2"
              >
                Mahony S, Benos PV. STAMP: a web tool for exploring DNA-binding
                motif similarities. <em>Nucleic Acids Res.</em> 2007
                Jul;35(Web Server issue):W253-8.
              </a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
