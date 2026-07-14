import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { searchJobs, type JobCard } from '@/lib/jobs';
import { SwipeDeck } from '@/components/swipe-deck';

export const metadata: Metadata = { title: 'Descubrir' };

/**
 * Feed swipe (Fase 4). Trae vacantes recomendadas ("Para ti") y, si el perfil
 * aún no da match, cae en las vacantes más recientes del catálogo.
 */
export default async function FeedPage() {
  const access = await getAccessToken();
  let jobs: JobCard[] = [];
  let forYouFailed = false;
  let searchFailed = false;
  try {
    const res = await apiFetch<{ data: JobCard[] }>('/jobs/for-you', {
      accessToken: access ?? undefined,
    });
    jobs = res.data;
  } catch {
    forYouFailed = true;
  }
  if (jobs.length === 0) {
    try {
      jobs = (await searchJobs({ limit: 20 })).data;
    } catch {
      searchFailed = true;
    }
  }

  // "Sin vacantes" y "no pudimos conectar con el servidor" son estados muy
  // distintos para el usuario — solo el segundo (ambas llamadas fallaron) es
  // un error real que vale la pena distinguir del vacío legítimo.
  const loadError = forYouFailed && searchFailed;

  return <SwipeDeck jobs={jobs} loadError={loadError} />;
}
