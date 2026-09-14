import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];

function requirePattern(label, text, pattern) {
  if (!pattern.test(text)) failures.push(label);
}

const appJson = JSON.parse(read('app.json'));
const redirects = read('src/lib/authRedirects.ts');
const signUp = read('app/sign-up.tsx');
const signIn = read('app/sign-in.tsx');
const forgotPassword = read('app/forgot-password.tsx');
const resetPassword = read('app/reset-password.tsx');
const authCallback = read('app/auth/callback.tsx');
const authLinks = read('src/lib/authLinks.ts');
const recoveryLinks = read('src/lib/passwordRecoveryLink.ts');
const socialAuth = read('src/lib/socialAuth.ts');
const confirmationTemplate = read('supabase/templates/confirmation.html');
const recoveryTemplate = read('supabase/templates/recovery.html');
const authRunbook = read('supabase/templates/README.md');

if (appJson?.expo?.scheme !== 'noxa') {
  failures.push('Expo custom URL scheme must remain `noxa`.');
}

requirePattern(
  'Auth callback redirect constant must be exact.',
  redirects,
  /AUTH_CALLBACK_REDIRECT_URI\s*=\s*['"]noxa:\/\/auth\/callback['"]/,
);
requirePattern(
  'Password recovery redirect constant must be exact.',
  redirects,
  /PASSWORD_RECOVERY_REDIRECT_URI\s*=\s*['"]noxa:\/\/reset-password['"]/,
);
requirePattern(
  'Auth email resend cooldown must remain 60 seconds.',
  redirects,
  /AUTH_EMAIL_RESEND_COOLDOWN_SECONDS\s*=\s*60/,
);

requirePattern('Signup must call Supabase signUp.', signUp, /supabase\.auth\.signUp\(/);
requirePattern(
  'Signup must pass the canonical auth callback.',
  signUp,
  /emailRedirectTo:\s*AUTH_CALLBACK_REDIRECT_URI/,
);
requirePattern(
  'Signup pending state must support confirmation resend.',
  signUp,
  /supabase\.auth\.resend\([\s\S]*type:\s*['"]signup['"][\s\S]*emailRedirectTo:\s*AUTH_CALLBACK_REDIRECT_URI/,
);

requirePattern('Sign in must use password auth.', signIn, /supabase\.auth\.signInWithPassword\(/);
requirePattern(
  'Sign in must recognize unconfirmed-email errors.',
  signIn,
  /email_not_confirmed|Email not confirmed/,
);
requirePattern(
  'Sign in must support confirmation resend with the canonical callback.',
  signIn,
  /supabase\.auth\.resend\([\s\S]*type:\s*['"]signup['"][\s\S]*emailRedirectTo:\s*AUTH_CALLBACK_REDIRECT_URI/,
);

requirePattern(
  'Forgot password must request a Supabase recovery email.',
  forgotPassword,
  /supabase\.auth\.resetPasswordForEmail\(/,
);
requirePattern(
  'Forgot password must pass the canonical recovery redirect.',
  forgotPassword,
  /redirectTo:\s*PASSWORD_RECOVERY_REDIRECT_URI/,
);
requirePattern(
  'Forgot password copy must preserve account-enumeration-safe delivery semantics.',
  forgotPassword,
  /If a NOXA account exists/,
);

requirePattern(
  'Recovery link handler must support implicit-flow sessions.',
  recoveryLinks,
  /supabase\.auth\.setSession\(/,
);
requirePattern(
  'Recovery link handler must support PKCE codes.',
  recoveryLinks,
  /supabase\.auth\.exchangeCodeForSession\(/,
);
requirePattern(
  'Recovery link handler must support recovery token hashes.',
  recoveryLinks,
  /supabase\.auth\.verifyOtp\([\s\S]*type:\s*['"]recovery['"]/
);
requirePattern(
  'Recovery link handler must deduplicate the same one-time link.',
  recoveryLinks,
  /activeRecoveryPromise[\s\S]*lastRecoveryResult/,
);

requirePattern(
  'Reset password screen must consume the recovery link.',
  resetPassword,
  /acceptPasswordRecoveryUrl\(/,
);
requirePattern(
  'Reset password screen must update the authenticated recovery user password.',
  resetPassword,
  /supabase\.auth\.updateUser\(\{\s*password\s*\}\)/,
);
requirePattern(
  'Reset password screen must sign out after password update.',
  resetPassword,
  /supabase\.auth\.signOut\(/,
);

requirePattern(
  'Auth callback must consume Supabase auth links.',
  authCallback,
  /createSessionFromAuthLink\(/,
);
requirePattern(
  'Auth callback must enter the authenticated app only after a valid session.',
  authCallback,
  /resetToAuthenticatedApp\(/,
);
requirePattern(
  'Auth link parser must support access-token callbacks.',
  authLinks,
  /supabase\.auth\.setSession\(/,
);
requirePattern(
  'Auth link parser must support PKCE callbacks.',
  authLinks,
  /supabase\.auth\.exchangeCodeForSession\(/,
);

requirePattern(
  'Social auth redirect alias must use the shared callback constant.',
  socialAuth,
  /SOCIAL_AUTH_REDIRECT_URI\s*=\s*AUTH_CALLBACK_REDIRECT_URI/,
);
requirePattern(
  'Google OAuth must use the social auth redirect alias.',
  socialAuth,
  /redirectTo:\s*SOCIAL_AUTH_REDIRECT_URI/,
);

requirePattern(
  'Confirm-signup template must use Supabase ConfirmationURL.',
  confirmationTemplate,
  /\{\{\s*\.ConfirmationURL\s*\}\}/,
);
requirePattern(
  'Reset-password template must use Supabase ConfirmationURL.',
  recoveryTemplate,
  /\{\{\s*\.ConfirmationURL\s*\}\}/,
);
requirePattern(
  'Hosted Auth runbook must keep the production website as Site URL.',
  authRunbook,
  /Site URL:\s*`https:\/\/noxastreetapp\.com`/,
);
requirePattern(
  'Hosted Auth runbook must require Confirm email.',
  authRunbook,
  /Confirm email:\s*enabled/,
);
requirePattern(
  'Hosted Auth runbook must document the app callback allow-list entry.',
  authRunbook,
  /`noxa:\/\/auth\/callback`/,
);
requirePattern(
  'Hosted Auth runbook must document the password recovery allow-list entry.',
  authRunbook,
  /`noxa:\/\/reset-password`/,
);

if (failures.length) {
  console.error('NOXA Auth flow contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('NOXA Auth flow contract passed.');
