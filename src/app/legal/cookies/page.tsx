import type { Metadata } from 'next';
import LegalShell from '../LegalShell';
import { getPolicy } from '../policies';

const policy = getPolicy('cookies');

export const metadata: Metadata = {
  title: policy.metaTitle,
  description: policy.metaDescription,
};

export default function CookiesPage() {
  return <LegalShell active="cookies" />;
}
