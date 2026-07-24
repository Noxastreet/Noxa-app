export const LEGAL_EFFECTIVE_DATE = 'July 15, 2026';
export const NOXA_OPERATOR = 'SERGKEI KARAKETIDIS';
export const SUPPORT_EMAIL = 'noxastreetapp@gmail.com';

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  eyebrow: string;
  summary: string;
  sections: LegalSection[];
};

export const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  eyebrow: 'YOUR DATA AT NOXA',
  summary:
    'This policy explains what information NOXA collects, why it is used, who can see it, and the choices available to you.',
  sections: [
    {
      title: '1. Who we are',
      paragraphs: [
        'NOXA is operated by SERGKEI KARAKETIDIS, an independent developer based in Greece. For data-protection purposes, SERGKEI KARAKETIDIS is the controller of personal data processed through NOXA.',
        'Questions, privacy requests, and account-deletion requests can be sent to noxastreetapp@gmail.com.',
      ],
    },
    {
      title: '2. Scope and age requirement',
      paragraphs: [
        'This policy applies to the NOXA mobile application, its backend services, and the public NOXA legal pages. NOXA is not intended for anyone under 16, and we do not knowingly collect personal data from children under 16. If you believe a child has provided data, contact us so it can be removed.',
      ],
    },
    {
      title: '3. Information we collect',
      bullets: [
        'Account and authentication data: email address, authentication credentials handled by Supabase, account identifier, session information, and security events. Passwords are not available to NOXA in readable form.',
        'Profile data: display name, username, avatar, biography, city, and other details you choose to add.',
        'Garage data: vehicle brand, model, year, specifications, tuning details, description, photos, and visibility setting.',
        'Content and social activity: posts, photos, captions, optional location labels, comments, likes, saves, follows, messages, invitations, join requests, poll votes, and other interactions.',
        'Crews and events: memberships, roles, event details, attendance responses, chats, galleries, convoy readiness, and content you submit as a host or member.',
        'Location and map data: precise coordinates and, when available, heading, speed, accuracy, timestamp, visibility audience, and session expiry. Event coordinates and route start/destination points may also be processed.',
        'Technical data: device and app information, IP address, network request data, timestamps, crash or security information, and similar logs that may be processed by our infrastructure and platform providers.',
      ],
    },
    {
      title: '4. Live Drive and background location',
      paragraphs: [
        'Live Drive is optional and starts only after you choose an audience and grant the required location permissions. During an active Live Drive session, NOXA may collect and update your precise location while the app is open, in the background, or when the screen is locked. A session lasts no longer than four hours and must be started again for continued sharing.',
        'Crew shares with authenticated users who belong to at least one crew with you. Friends shares only with authenticated users who mutually follow you. Global shares with all authenticated NOXA users. Ghost stops Live Drive and removes your active presence where the device can complete the request.',
        'You can stop sharing at any time by selecting Ghost, signing out, or disabling location access in your device settings. An expired Live Drive record cannot be viewed under NOXA database access rules, even if device or network failure delays cleanup.',
      ],
    },
    {
      title: '5. How we use information',
      bullets: [
        'Create and secure your account and keep you signed in.',
        'Display profiles, garages, posts, crews, events, messages, and social interactions according to their access settings.',
        'Operate Live Drive, enforce the selected audience, show nearby activity, and build a route to an event when you request one.',
        'Store and deliver photos and other content you upload.',
        'Maintain, troubleshoot, secure, and improve NOXA; prevent abuse, fraud, and unauthorized access; and enforce our Terms of Service.',
        'Respond to support, privacy, safety, and legal requests.',
      ],
      paragraphs: [
        'NOXA does not currently use third-party advertising, sell personal data, or use personal data for cross-app behavioral advertising or automated decisions that produce legal or similarly significant effects.',
      ],
    },
    {
      title: '6. Legal bases in the EEA',
      bullets: [
        'Contract: processing needed to create your account and provide the features you request.',
        'Consent: precise location, background location, photo access, and other permission-based features. You may withdraw consent at any time through NOXA or device settings.',
        'Legitimate interests: service security, abuse prevention, debugging, moderation, and improving reliability, balanced against your rights.',
        'Legal obligation: processing or retention required by applicable law or a valid legal request.',
      ],
    },
    {
      title: '7. When information is shared',
      bullets: [
        'Other NOXA users receive profile, content, crew, event, and Live Drive information only as allowed by the relevant visibility and membership rules. Content marked public may be broadly visible within NOXA.',
        'Supabase provides authentication, database, storage, serverless functions, and realtime infrastructure as a service provider acting on our instructions.',
        'Mapbox may process map and device data under its own terms. OpenRouteService receives route origin and destination coordinates when you request an event route.',
        'Image delivery and platform providers, including operating-system services and third-party media hosts used by the app, may receive ordinary connection data such as IP address and user agent when content loads.',
        'Information may be disclosed when reasonably necessary to comply with law, protect users, investigate abuse, or protect NOXA and others. If NOXA is reorganized or transferred, data may transfer subject to this policy and applicable law.',
      ],
      paragraphs: ['We do not sell or rent personal data.'],
    },
    {
      title: '8. Retention and deletion',
      paragraphs: [
        'Account, profile, and user content are generally retained while your account is active or as needed to provide NOXA. Content you delete is removed from active product views, subject to technical backup cycles and legal requirements.',
        'Live Drive sharing expires after no more than four hours. The active location row is designed to be deleted when you choose Ghost, sign out, or the session cleanup completes. Expired location data is not visible to other users and may remain protected until later cleanup if a device is offline.',
        'Account deletion started in Settings is designed to remove the authentication account, associated database records, and owned uploads from active systems immediately after password verification. Verified deletion requests sent to support are normally completed within 30 days. Limited records may be retained for security, fraud prevention, dispute resolution, or law, and residual copies may remain temporarily in protected backups until their normal expiry.',
      ],
    },
    {
      title: '9. Your choices and rights',
      bullets: [
        'Review and correct profile, vehicle, event, crew, and content information in the app.',
        'Choose who can see Live Drive, use Ghost to stop sharing, and manage location or photo permissions in device settings.',
        'Request access, correction, deletion, restriction, or portability of personal data, and object to processing based on legitimate interests where applicable.',
        'Withdraw consent without affecting processing that was lawful before withdrawal.',
        'Complain to the Hellenic Data Protection Authority or another competent EEA supervisory authority.',
      ],
      paragraphs: [
        'To delete your account in the app, open Settings, Privacy & Safety, then Delete Account and complete the identity check. For other privacy rights, or if in-app deletion is unavailable, send a request from the email address connected to your NOXA account to noxastreetapp@gmail.com. We may ask for limited information to verify that the request belongs to you.',
      ],
    },
    {
      title: '10. Security and international transfers',
      paragraphs: [
        'We use access controls, row-level database policies, encrypted network connections, authentication controls, and service-provider safeguards designed to protect data. No service can guarantee absolute security, so keep your credentials private and contact us if you suspect unauthorized access.',
        'Some providers may process data outside your country. Where required, transfers are protected by an adequacy decision, contractual safeguards such as Standard Contractual Clauses, or another lawful transfer mechanism.',
      ],
    },
    {
      title: '11. Changes and contact',
      paragraphs: [
        'We may update this policy as NOXA changes. Material updates will be communicated in the app or by another reasonable method, and the effective date will be updated.',
        'Privacy contact and controller email: noxastreetapp@gmail.com. Operator: SERGKEI KARAKETIDIS, Greece.',
      ],
    },
  ],
};

export const termsOfService: LegalDocument = {
  title: 'Terms of Service',
  eyebrow: 'THE RULES OF NOXA',
  summary:
    'These terms govern your use of NOXA. They are designed to keep the car community useful, lawful, and safe.',
  sections: [
    {
      title: '1. Acceptance',
      paragraphs: [
        'By creating an account or using NOXA, you agree to these Terms of Service and the Privacy Policy. If you do not agree, do not use NOXA. NOXA is operated by SERGKEI KARAKETIDIS, an independent developer based in Greece.',
      ],
    },
    {
      title: '2. Eligibility',
      paragraphs: [
        'You must be at least 16 to use NOXA. If you are under the age of legal majority where you live, you confirm that a parent or legal guardian permits your use. You may not use NOXA if applicable law prohibits you from receiving the service.',
      ],
    },
    {
      title: '3. Accounts',
      bullets: [
        'Provide accurate information and keep it reasonably current.',
        'Keep your password and device secure and do not share or transfer your account.',
        'You are responsible for activity performed through your account until you notify us of unauthorized access.',
        'Use one person’s identity per personal account and do not impersonate another person, crew, business, or organization.',
      ],
    },
    {
      title: '4. Driving and safety',
      paragraphs: [
        'NOXA is a social platform, not an emergency service, law-enforcement tool, certified navigation system, or guarantee of road conditions. Map, event, route, speed, heading, and location information may be delayed, incomplete, or inaccurate.',
        'Do not interact with NOXA while operating a vehicle. Use it only when legally parked or let a passenger operate it. Always follow traffic laws, signs, road closures, private-property rules, insurance requirements, and instructions from authorities.',
      ],
      bullets: [
        'Do not use NOXA to organize or encourage street racing, speed contests on public roads, reckless driving, evasion, stalking, or any illegal activity.',
        'Do not rely on Live Drive to locate someone in an emergency. Contact local emergency services instead.',
      ],
    },
    {
      title: '5. Live Drive and location visibility',
      paragraphs: [
        'Live Drive is opt-in and shares precise location only with the audience you select. Crew means shared-crew members, Friends means mutual followers, Global means all authenticated NOXA users, and Ghost stops sharing. Each active session expires after no more than four hours.',
        'Visibility controls reduce who can access a location but cannot prevent an authorized viewer from remembering, recording, or sharing what they see. Never use another person’s location to harass, track, threaten, or endanger them.',
      ],
    },
    {
      title: '6. Your content',
      paragraphs: [
        'You retain ownership of content you create. You grant NOXA a worldwide, non-exclusive, royalty-free license to host, store, reproduce, display, transmit, format, and make technical copies of that content only as needed to operate, secure, and improve the NOXA service. This license ends when the content is deleted, except for protected backups, legal retention, and copies legitimately shared by other users.',
        'You confirm that you have the rights and permissions needed for anything you upload, including images of people, vehicles, logos, music, locations, and private property. Do not publish precise private locations or personal information without permission.',
      ],
    },
    {
      title: '7. Prohibited conduct and content',
      bullets: [
        'Illegal, fraudulent, deceptive, threatening, hateful, sexually exploitative, or seriously harmful content or activity.',
        'Harassment, bullying, stalking, doxxing, discrimination, encouragement of self-harm, or credible threats of violence.',
        'Content that infringes copyright, trademark, privacy, publicity, confidentiality, or other rights.',
        'Dangerous-driving challenges, illegal races, speed-camera or police-evasion tools, prohibited goods, or instructions that facilitate wrongdoing.',
        'Spam, fake engagement, scraping, unauthorized automation, malware, security testing without written permission, or attempts to bypass access controls.',
        'Impersonation, misleading events, unauthorized commercial solicitation, or collecting another user’s data for an unrelated purpose.',
      ],
    },
    {
      title: '8. Crews, events, convoys, and meetups',
      paragraphs: [
        'Users, not NOXA, create and manage crews, events, convoys, and meetups. Hosts are responsible for lawful venues, permissions, participant communications, capacity, safety plans, and cancellation notices. Participation is voluntary and at your own risk.',
        'NOXA does not inspect vehicles, verify licenses or insurance, supervise events, or guarantee the identity, conduct, skill, or safety of users. Leave any situation that feels unsafe and contact the appropriate authorities when necessary.',
      ],
    },
    {
      title: '9. Moderation and reports',
      paragraphs: [
        'We may review, restrict, remove, or preserve content and may warn, suspend, or terminate accounts when reasonably necessary to enforce these terms, protect users, investigate reports, or comply with law. We are not required to monitor every interaction.',
        'Use the safety actions on a driver profile, post, or comment to submit a private report or block another user. You can review blocked users in Settings under Privacy & Safety. For urgent safety concerns or intellectual-property issues, contact noxastreetapp@gmail.com with enough detail to identify the relevant account or content.',
      ],
    },
    {
      title: '10. Third-party services',
      paragraphs: [
        'NOXA relies on third-party services such as Supabase, Mapbox, OpenRouteService, operating-system services, and media delivery providers. Their availability and data practices are governed by their own terms and policies. NOXA is not responsible for third-party services outside our control.',
      ],
    },
    {
      title: '11. Service changes and availability',
      paragraphs: [
        'We may add, change, limit, suspend, or discontinue features. We aim to keep NOXA available, but do not promise uninterrupted, error-free, or permanent operation. Features may differ by device, operating system, country, permissions, or network conditions.',
      ],
    },
    {
      title: '12. NOXA intellectual property',
      paragraphs: [
        'NOXA’s software, design, name, logos, graphics, and other service materials are owned by or licensed to the operator and are protected by applicable law. These terms allow personal, non-exclusive, revocable use of the service; they do not transfer ownership or permit copying, reverse engineering, resale, or unauthorized commercial use.',
      ],
    },
    {
      title: '13. Suspension, termination, and deletion',
      paragraphs: [
        'You may stop using NOXA at any time and delete your account from Settings under Privacy & Safety, or request deletion from support if the in-app flow is unavailable. We may suspend or terminate access for serious or repeated violations, security risk, legal requirement, or conduct that puts people or the service at risk. Where appropriate, we will provide notice or a way to ask for review.',
        'Account deletion removes the account and associated personal data from active systems as described in the Privacy Policy, subject to verification, backup cycles, and lawful retention.',
      ],
    },
    {
      title: '14. Disclaimers and liability',
      paragraphs: [
        'To the maximum extent permitted by law, NOXA is provided “as is” and “as available,” without warranties that the service, users, content, locations, routes, events, or vehicles are accurate, safe, suitable, or continuously available.',
        'To the maximum extent permitted by law, the operator is not liable for indirect, incidental, special, consequential, or punitive loss, loss of data or opportunity, vehicle damage, personal injury caused by another user, or conduct at an event. Nothing in these terms excludes liability that cannot legally be excluded, including mandatory consumer rights or liability for fraud, intent, gross negligence, death, or personal injury where applicable.',
      ],
    },
    {
      title: '15. Your responsibility',
      paragraphs: [
        'You are responsible for your conduct, content, events, and compliance with law. To the extent permitted by law, you agree to reimburse reasonable losses or costs caused by your intentional or unlawful violation of these terms or another person’s rights.',
      ],
    },
    {
      title: '16. Governing law and disputes',
      paragraphs: [
        'These terms are governed by the laws of Greece, without removing mandatory rights you have under the law of your country of residence. Courts in Greece will have jurisdiction unless applicable consumer law gives you the right to bring a claim elsewhere. Before filing a claim, contact us so we can try to resolve the issue informally.',
      ],
    },
    {
      title: '17. Changes and contact',
      paragraphs: [
        'We may update these terms to reflect service or legal changes. Material changes will be communicated by a reasonable method. Continued use after the new effective date means you accept the updated terms where permitted by law.',
        'Questions about these terms: noxastreetapp@gmail.com. Operator: SERGKEI KARAKETIDIS, Greece.',
      ],
    },
  ],
};
