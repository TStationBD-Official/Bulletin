import PolicyPage from "@/components/PolicyPage";

const CONTENT = `Terms of Service

Effective Date: June 30, 2026

1. Acceptance of Terms
By accessing or using The Net Chronicle, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.

2. Use of the Platform
The Net Chronicle is an educational social platform. You may use it to share posts, engage with content, and connect with other learners and educators. You must not use The Net Chronicle for any unlawful, harmful, or abusive purpose.

3. Account Responsibility
You are responsible for maintaining the confidentiality of your Google account and for all activity that occurs through your sign-in. Notify the administrator immediately if you suspect unauthorized access.

4. Content Ownership
You retain ownership of the content you post. By posting on The Net Chronicle, you grant The Net Chronicle a non-exclusive licence to display and distribute your content on the platform.

5. Prohibited Content
You may not post content that is:
- Offensive, abusive, or harassing
- Spam or misleading information
- Violating any applicable laws or regulations
- Unrelated to the educational purpose of the platform

6. Moderation
All posts may be reviewed by administrators before publication. We reserve the right to reject, hide, or remove content that violates these terms.

7. Termination
We reserve the right to suspend or permanently remove any account that violates these terms, without prior notice.

8. Changes to Terms
We may update these Terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.

9. Contact
For any questions regarding these Terms, please contact the platform administrator.
`;

export default function TermsPage() {
  return <PolicyPage content={CONTENT} title="Terms of Service" icon="📋" />;
}
