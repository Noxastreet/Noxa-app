import { LegalDocumentScreen } from '@/src/components/legal/LegalDocumentScreen';
import { privacyPolicy } from '@/src/legal/legalDocuments';

export default function PrivacyPolicyScreen() {
  return <LegalDocumentScreen document={privacyPolicy} />;
}
