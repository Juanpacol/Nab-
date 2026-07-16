import { apiFetch } from './api';

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getCompany(companyId: string, accessToken: string): Promise<Company> {
  return apiFetch<Company>(`/companies/${companyId}`, { accessToken });
}
