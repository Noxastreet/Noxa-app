import { LegalDocumentScreen } from '@/src/components/legal/LegalDocumentScreen';
import { termsOfService } from '@/src/legal/legalDocuments';

export default function TermsOfServiceScreen() {
  return <LegalDocumentScreen document={termsOfService} />;
}
