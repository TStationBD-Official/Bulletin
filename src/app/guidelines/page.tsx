import PolicyPage from "@/components/PolicyPage";

const CONTENT = `Community Guidelines

Welcome to The Net Chronicle — a space for learners and educators to share knowledge respectfully.

1. Be Respectful
Treat every member with kindness and respect. Personal attacks, insults, or harassment of any kind will not be tolerated.

2. Stay On Topic
Keep posts relevant to education, learning, and academic discussion. Off-topic or promotional content will be removed.

3. No Spam
Do not post repetitive, commercial, or irrelevant content. Each post should add value to the community.

4. Accurate Information
Share information you believe to be true and accurate. Do not spread misinformation or unverified claims.

5. Original Content
Share your own work or properly credit original sources. Plagiarism is not permitted.

6. No Hate Speech
Content that discriminates based on race, gender, religion, nationality, disability, or any other characteristic is strictly prohibited.

7. Protect Privacy
Do not share personal information about yourself or others (phone numbers, addresses, private details).

8. Report Issues
If you see content that violates these guidelines, use the Report button on the post. Our moderation team will review it promptly.

9. Consequences
Violations of these guidelines may result in content removal, a warning notification, or account suspension depending on severity.

Thank you for helping keep The Net Chronicle a safe and positive learning environment.
`;

export default function GuidelinesPage() {
  return <PolicyPage content={CONTENT} title="Community Guidelines" icon="🤝" />;
}
