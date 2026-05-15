import { Nav } from '@/components/landing/Nav';
import { Hero } from '@/components/landing/Hero';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { ComparisonSection } from '@/components/landing/ComparisonSection';
import { FounderSection } from '@/components/landing/FounderSection';
import { WaitlistSection } from '@/components/landing/WaitlistSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProblemSection />
        <HowItWorks />
        <ComparisonSection />
        <FounderSection />
        <WaitlistSection />
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
