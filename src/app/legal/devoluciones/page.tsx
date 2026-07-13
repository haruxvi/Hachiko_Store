import type { Metadata } from 'next';
import LegalShell from '../LegalShell';
import { getPolicy } from '../policies';

const policy = getPolicy('devoluciones');

export const metadata: Metadata = {
  title: policy.metaTitle,
  description: policy.metaDescription,
};

export default function DevolucionesPage() {
  return <LegalShell active="devoluciones" />;
}
