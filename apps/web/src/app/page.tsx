import { SiteNav } from '@/components/site-nav';
import { SiteFooter } from '@/components/site-footer';
import { Hero } from '@/components/sections/hero';
import { Logos } from '@/components/sections/logos';
import { Features } from '@/components/sections/features';
import { Comparison } from '@/components/sections/comparison';
import { Testimonials } from '@/components/sections/testimonials';
import { Pricing } from '@/components/sections/pricing';
import { Faq } from '@/components/sections/faq';
import { Cta } from '@/components/sections/cta';

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Logos />
        <Features />
        <Comparison />
        <Testimonials />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
