import { Link } from 'react-router';
import { BulletList, LegalDocument, type LegalPoint, type LegalSectionData } from '../components/shell/LegalLayout';
import { APP_NAME, COMPANY_LEGAL_NAME, CONTACT_EMAIL } from '../lib/legal';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const mail = (
  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
);

const POINTS: LegalPoint[] = [
  {
    term: 'Only what the tool needs',
    text: 'Your name, work email and role, and the QuickBooks data you connect: customers, estimates and the payments you record.',
  },
  {
    term: 'Never sold, never for ads',
    text: 'Only our host (UpCloud) and Intuit (QuickBooks) handle it, and only to run the tool.',
  },
  {
    term: 'Yours to disconnect',
    text: 'Settings → QuickBooks → Disconnect, any time. We revoke access at Intuit and delete the stored connection.',
  },
];

/** The privacy policy Intuit links to from the app listing. Every statement here describes what the code actually does. */
const SECTIONS: LegalSectionData[] = [
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <>
        <p>About the people who use the tool:</p>
        <BulletList>
          <li>Your name, work email address and role (Sales, Admin or SuperAdmin), entered by the SuperAdmin who invites you.</li>
          <li>
            If you sign in with QuickBooks, your Intuit account ID (a random identifier). We do not receive or store your Intuit
            email, profile or phone number.
          </li>
          <li>
            Older accounts may still hold a salted one-way hash of a password set before sign-in moved to QuickBooks. It cannot be used
            to sign in.
          </li>
          <li>A session cookie that keeps you signed in for up to 8 hours. We use no advertising or analytics cookies.</li>
        </BulletList>
        <p>From QuickBooks, only when you connect it, and only what the tool needs:</p>
        <BulletList>
          <li>Customers: name, company, email, phone and balance.</li>
          <li>Estimates: number, dates, amounts, status, line items and memo.</li>
          <li>Your QuickBooks company name.</li>
        </BulletList>
        <p>
          Customers and estimates are read live and held in server memory for about a minute so pages load quickly. We do not keep a
          copy of them in our database.
        </p>
        <p>What we create:</p>
        <BulletList>
          <li>
            Payment records: customer name, estimate reference, amount, the bank account it was deposited to, reference number,
            dates, who submitted, received and approved it, and any rejection or void reason.
          </li>
          <li>The receipt or proof-of-payment image a salesperson uploads.</li>
          <li>
            Payments and deposits that we write to QuickBooks when an Admin approves a payment, and the reversal if an Admin later
            voids it.
          </li>
        </BulletList>
      </>
    ),
  },
  {
    id: 'quickbooks-access',
    title: 'QuickBooks access',
    body: (
      <>
        <p>
          When you connect QuickBooks, Intuit asks you to authorise {APP_NAME}. We request two permissions: <strong>OpenID</strong>, to
          confirm who you are, and <strong>Accounting</strong>, to read customers and estimates and to record payments. Only one
          QuickBooks company, ours, can be connected; any other company is refused.
        </p>
        <p>
          What you can see and post follows your own QuickBooks permissions. Intuit gives us tokens that act on your behalf. We store
          them encrypted (AES-256-GCM) and use them only to do what you ask in the tool. We do not log them or show them in the
          browser.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use-it',
    title: 'How we use it',
    body: (
      <>
        <BulletList>
          <li>To sign you in and decide what you may do.</li>
          <li>To show customers and estimates, and to submit, review and record payments.</li>
          <li>To keep an audit trail of who did what, which our accounting and your colleagues rely on.</li>
          <li>To keep the service secure and fix faults.</li>
        </BulletList>
        <p>We do not sell your information, use it for advertising, or use QuickBooks data for anything other than running this tool.</p>
      </>
    ),
  },
  {
    id: 'who-else-handles-it',
    title: 'Who else handles it',
    body: (
      <>
        <BulletList>
          <li>
            <strong>UpCloud</strong> hosts our servers, database and the private storage that holds receipt images.
          </li>
          <li>
            <strong>Intuit</strong> provides QuickBooks Online and sign-in. Its own privacy statement governs data held in QuickBooks.
          </li>
        </BulletList>
        <p>
          We share information with others only where the law requires it. Access inside our company is limited by role, and the
          people who run the system can reach the database only as needed to operate it.
        </p>
      </>
    ),
  },
  {
    id: 'how-long-we-keep-it',
    title: 'How long we keep it',
    body: (
      <BulletList>
        <li>QuickBooks connection tokens: until you disconnect, your account is deactivated, or Intuit revokes them.</li>
        <li>Payment records and receipts: as long as we need them for accounting, audit and tax purposes.</li>        <li>Account details: while your account is active. After you leave, we deactivate the account and keep only what the audit trail needs.</li>
      </BulletList>
    ),
  },
  {
    id: 'disconnecting-quickbooks',
    title: 'Disconnecting QuickBooks',
    body: (
      <>
        <p>You can disconnect at any time, in either of two ways:</p>
        <BulletList>
          <li>
            In {APP_NAME}: open <strong>Settings → QuickBooks</strong> and choose <strong>Disconnect QuickBooks</strong>. We ask Intuit
            to revoke the connection and delete the stored tokens immediately.
          </li>
          <li>
            In QuickBooks: remove {APP_NAME} from the apps connected to your Intuit account. Intuit ends the connection and we discard
            the tokens the next time they stop working.
          </li>
        </BulletList>
        <p>
          Disconnecting stops all further access to QuickBooks. It does not delete payment records we already created; ask us if you
          want those handled (see “Your rights”).
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Connections use HTTPS. QuickBooks tokens are encrypted at rest. Receipts are kept in a private bucket and are shown only to
        signed-in users who are allowed to see them. Access is by invitation and by role, sign-in attempts are rate-limited, and errors
        shown in the browser do not reveal internal details. No system is perfectly secure, but we work to protect your information
        and will tell you promptly if a breach affects it.
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <p>
        Under the Philippine Data Privacy Act of 2012 (RA 10173), and the data protection law where you live, you may ask us to give you
        a copy of your personal information, correct it, restrict or object to its use, or delete it where we are not required to keep
        it. You may also complain to the National Privacy Commission. Write to {mail} and we will reply within a reasonable time.
      </p>
    ),
  },
  {
    id: 'changes-and-contact',
    title: 'Changes and contact',
    body: (
      <p>
        If we change this policy we will update the date at the top, and tell users in the tool if the change is significant.
        Questions: {mail}. See also our <Link to="/terms">terms of use</Link>.
      </p>
    ),
  },
];

export function PrivacyPage() {
  useDocumentTitle('Privacy policy');
  return (
    <LegalDocument
      title="Privacy policy"
      lead={`${APP_NAME} is a private tool run by ${COMPANY_LEGAL_NAME} for its own team. This page says what it handles, why, and how to disconnect or ask us to delete your information.`}
      points={POINTS}
      sections={SECTIONS}
    />
  );
}

export default PrivacyPage;
