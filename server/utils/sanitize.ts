/**
 * HTML sanitization utilities for safe content rendering
 * Prevents XSS attacks in exported HTML reports and other user-generated content
 */

/**
 * Escape HTML special characters to prevent XSS
 * Use this for user content that should be rendered as plain text
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize text content - removes all HTML tags and escapes special characters
 * Use for content that should only contain plain text
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  // First strip any HTML tags
  const stripped = text.replace(/<[^>]*>/g, '');
  // Then escape any special characters
  return escapeHtml(stripped);
}

/**
 * Sanitize for CSV export - removes line breaks, quotes, and prevents formula injection
 * Formula injection occurs when cell content starts with =, +, -, @ which Excel interprets as formulas
 */
export function sanitizeForCsv(text: string | null | undefined): string {
  if (!text) return '';
  let sanitized = text
    .replace(/[\n\r]/g, ' ')  // Replace newlines with spaces
    .replace(/"/g, '""')       // Escape double quotes
    .trim();

  // Prevent CSV formula injection by prefixing with apostrophe
  // This tells Excel to treat the content as text, not a formula
  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = "'" + sanitized;
  }

  return sanitized;
}

/**
 * Allowed HTML tags for basic formatting in notes and summaries
 * Only permits safe structural tags, no scripts or event handlers
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
]);

/**
 * Allowed attributes for safe HTML elements
 */
const ALLOWED_ATTRS = new Set(['class']);

/**
 * Sanitize HTML to allow only safe tags and remove dangerous attributes
 * Use for content that may contain markdown-converted HTML
 */
export function sanitizeBasicHtml(html: string | null | undefined): string {
  if (!html) return '';

  // Replace script tags and event handlers completely
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, 'data-removed=');

  // Process HTML tags - keep allowed ones, escape others
  sanitized = sanitized.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\s*([^>]*)>/g, (match, tagName, attrs) => {
    const lowerTag = tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(lowerTag)) {
      // Escape the entire tag
      return escapeHtml(match);
    }

    // For allowed tags, filter attributes
    const safeAttrs = attrs
      .split(/\s+/)
      .filter((attr: string) => {
        const attrName = attr.split('=')[0]?.toLowerCase();
        return attrName && ALLOWED_ATTRS.has(attrName);
      })
      .join(' ');

    const isClosing = match.startsWith('</');
    if (isClosing) {
      return `</${lowerTag}>`;
    }

    return safeAttrs ? `<${lowerTag} ${safeAttrs}>` : `<${lowerTag}>`;
  });

  return sanitized;
}

/**
 * Convert newlines to HTML breaks, with escaping
 * Safe for use in HTML contexts
 */
export function textToHtml(text: string | null | undefined): string {
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Sanitize filename to prevent path traversal and special characters
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\?%*:|"<>]/g, '_')  // Replace unsafe chars
    .replace(/\.{2,}/g, '.')          // Prevent ..
    .replace(/^\./, '_')              // No leading dots
    .substring(0, 200);               // Limit length
}
