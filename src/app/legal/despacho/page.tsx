import type { Metadata } from 'next';
import LegalShell from '../LegalShell';
import { getPolicy } from '../policies';

const policy = getPolicy('despacho');

export const metadata: Metadata = {
  title: policy.metaTitle,
  description: policy.metaDescription,
};

export default function DespachoPage() {
  return <LegalShell active="despacho" />;
}
