import PolicyPage from "@/components/PolicyPage";

const CONTENT = `Privacy Policy

Effective Date: June 30, 2026

1. Information We Collect
When you sign in with Google, we collect your name, email address, and profile photo from your Google account. We also collect content you create (posts, comments) and usage data (views, likes).

2. How We Use Your Information
We use your information to:
- Display your profile and authored content
- Send you notifications about activity on your posts
- Enforce community standards and platform safety
- Improve platform performance and features

3. Data Storage
Your data is stored securely using Google Firebase (Firestore and Authentication). Images you upload are stored in your personal Google Drive.

4. Sharing of Information
We do not sell or share your personal information with third parties. Your name and profile photo are visible to other signed-in users on the platform.

5. Google Drive
When you upload images, they are stored in your connected Google Drive account. You have full control over those files directly from your Google Drive.

6. Cookies and Sessions
We use browser localStorage to maintain your session and Google Drive connection. No advertising cookies are used.

7. Your Rights
You may request deletion of your account and data by contacting the platform administrator. Upon deletion, your posts will be removed and your personal data erased.

8. Data Retention
We retain your data for as long as your account is active. Deleted accounts are removed within 30 days.

9. Contact
For privacy concerns, contact the platform administrator.
`;

export default function PrivacyPage() {
  return <PolicyPage content={CONTENT} title="Privacy Policy" icon="🔒" />;
}
