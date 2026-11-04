// Helper so each return is 1 line. Use it for every response below.
function reply(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

// "Jéss Rebelo, LCSW" -> "jess-rebelo-lcsw"
function toSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const siteTitle = "Unleashed Potential Therapy Group";
export { toSlug, reply, siteTitle };
