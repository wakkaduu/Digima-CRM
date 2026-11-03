import { Link } from 'react-router';
import { BulletList, LegalDocument, type LegalPoint, type LegalSectionData } from '../components/shell/LegalLayout';
import { APP_NAME, COMPANY_LEGAL_NAME, CONTACT_EMAIL } from '../lib/legal';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const POINTS: LegalPoint[] = [
  { term: 'By invitation only', text: `${APP_NAME} is for our team. You may use it for our company’s business while you are an invited user.` },
  { term: 'You answer for your account', text: 'Keep your sign-in and invite link private, and only submit receipts and amounts that are genuine.' },
  {
    term: 'QuickBooks entries are real',
    text: 'Approved payments are written to our live books, so check them before you approve. You can disconnect QuickBooks at any time.',
  },
];

/** The end-user license agreement Intuit links to from the app listing. */
const SECTIONS: LegalSectionData[] = [
  {
    id: 'what-the-tool-is',
    title: 'What the tool is',
    body: (
      <p>
        {APP_NAME} is a private business tool for our team. It lets Sales submit customer payments with proof, lets Admins review and
        approve them, and records approved payments in our QuickBooks Online company. It is available by invitation only. By signing
        in or connecting QuickBooks you accept these terms; if you do not accept them, do not use the tool.
      </p>
    ),
  },
  {
    id: 'license',
    title: 'License',
    body: (
      <p>
        We grant you a limited, non-exclusive, non-transferable, revocable right to use the tool for our company’s business while you
        are an invited user. You may not copy, resell, reverse-engineer or provide it to anyone else, or use it to build a competing
        product.
      </p>
    ),
  },
  {
    id: 'your-account',
    title: 'Your account',
    body: (
      <BulletList>
        <li>Keep your sign-in details and invite link private. You are responsible for what is done under your account.</li>
        <li>Tell us promptly if you think someone else has used your account.</li>
        <li>Give accurate information. Only submit receipts and amounts that are genuine.</li>
        <li>We may suspend or remove an account at any time, for example when someone leaves the company or misuses the tool.</li>
      </BulletList>
    ),
  },
  {
    id: 'quickbooks',
    title: 'QuickBooks',
    body: (
      <>
        <p>
          The tool reads from and writes to QuickBooks Online using the access you grant through Intuit. What you can do there follows
          your own QuickBooks permissions. Approved payments are written to QuickBooks as real accounting entries, so check them before
          you approve. You can disconnect QuickBooks at any time from <strong>Settings → QuickBooks</strong> or from your Intuit
          account; the tool will then stop working with QuickBooks until you connect again.
        </p>
        <p>
          QuickBooks and Intuit are trademarks of Intuit Inc. {APP_NAME} is not sponsored or endorsed by Intuit. Your use of QuickBooks
          is governed by Intuit’s own terms.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <BulletList>
        <li>Do not attempt to bypass access controls, probe for weaknesses, or access data you are not permitted to see.</li>
        <li>Do not upload malicious files or anything unlawful.</li>
        <li>Do not use the tool to collect or share customer information for any purpose other than our business.</li>
      </BulletList>
    ),
  },
  {
    id: 'your-information',
    title: 'Your information',
    body: (
      <p>
        How we handle personal and customer information is described in our <Link to="/privacy">privacy policy</Link>. Payment records
        and receipts you submit belong to our business.
      </p>
    ),
  },
  {
    id: 'no-warranty-and-limits',
    title: 'No warranty and limits',
    body: (
      <p>
        The tool is provided “as is”. We work to keep it accurate and available, but we do not promise that it will be uninterrupted
        or error-free, and the books of record remain in QuickBooks. To the fullest extent the law allows, we are not liable for
        indirect or consequential loss arising from using the tool, and our total liability for any claim is limited to the amount you
        paid us to use it (which, for an internal tool, is nothing). Nothing here limits liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: 'ending-these-terms',
    title: 'Ending these terms',
    body: (
      <p>
        You can stop using the tool at any time. We may end your access at any time. Sections that by their nature should continue
        (such as ownership, acceptable use and limits on liability) survive.
      </p>
    ),
  },
  {
    id: 'changes-law-and-contact',
    title: 'Changes, law and contact',
    body: (
      <p>
        We may update these terms; the date at the top shows the latest version, and continuing to use the tool means you accept the
        change. These terms are governed by the laws of the Republic of the Philippines. Questions:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    ),
  },
];

export function TermsPage() {
  useDocumentTitle('Terms of use');
  return (
    <LegalDocument
      title="Terms of use"
      lead={`The rules for using ${APP_NAME}: who it is for, what you may do with it, and what ${COMPANY_LEGAL_NAME} promises in return.`}
      points={POINTS}
      sections={SECTIONS}
    />
  );
}

export default TermsPage;
