import type { Metadata } from 'next';
import LegalShell from '../LegalShell';
import { getPolicy } from '../policies';

const policy = getPolicy('privacidad');

export const metadata: Metadata = {
  title: policy.metaTitle,
  description: policy.metaDescription,
};

export default function PrivacidadPage() {
  return <LegalShell active="privacidad" />;
}
