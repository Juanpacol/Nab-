import type { Metadata } from 'next';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { OnboardingWizard } from './onboarding-wizard';

export const metadata: Metadata = { title: 'Completa tu perfil' };

interface ProfileResponse {
  headline: string | null;
  summary: string | null;
  skills: string[];
  locations: string[];
  desiredRoles: string[];
  remotePreference: string;
}

export default async function OnboardingPage() {
  const access = await getAccessToken();
  let profile: ProfileResponse | null = null;
  if (access) {
    try {
      profile = await apiFetch<ProfileResponse | null>('/users/me/profile', {
        accessToken: access,
      });
    } catch {
      profile = null;
    }
  }

  return (
    <OnboardingWizard
      initial={{
        headline: profile?.headline ?? '',
        summary: profile?.summary ?? '',
        skills: (profile?.skills ?? []).join(', '),
        locations: (profile?.locations ?? []).join(', '),
        desiredRoles: (profile?.desiredRoles ?? []).join(', '),
        remotePreference: profile?.remotePreference ?? 'ANY',
      }}
    />
  );
}
