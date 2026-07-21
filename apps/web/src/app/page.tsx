import { redirect } from 'next/navigation';

/**
 * The live event stream is the product. `/sdk/*` is static, unwired UI, so landing there
 * would show a visitor mock data before anything real.
 */
export default function Home() {
  redirect('/events');
}
