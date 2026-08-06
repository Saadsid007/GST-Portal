/**
 * Calculates estimated reading time based on text word count.
 */
export function calculateReadTime(text: string): string {
  const words = text
    .replace(/<[^>]*>/g, " ")
    .trim()
    .split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return `${minutes} min read`;
}

/**
 * Generates a clean URL slug from title string.
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
