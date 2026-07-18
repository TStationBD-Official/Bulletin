const ROBOTS_TXT = `User-agent: *
Allow: /

Sitemap: https://bulletinbd.vercel.app/sitemap.xml
`;

export function GET() {
  return new Response(ROBOTS_TXT, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
