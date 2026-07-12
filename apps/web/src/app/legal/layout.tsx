import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';

/** Shell de las páginas legales (públicas): mismo header/footer de la landing. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <article className="prose-legal space-y-6 text-sm leading-relaxed text-foreground/90 [&_h1]:font-display [&_h1]:text-3xl [&_h1]:text-foreground [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-foreground [&_p]:text-muted [&_li]:text-muted [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
