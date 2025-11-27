/**
 * Markdown Rendering Utilities
 * Parses markdown to HTML and sanitizes for safe rendering
 */

import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Configure marked with GitHub Flavored Markdown options
 */
marked.setOptions({
  gfm: true,              // GitHub Flavored Markdown
  breaks: true,           // Convert \n to <br>
  headerIds: false,       // Don't add IDs to headings
  mangle: false,          // Don't mangle email addresses
});

/**
 * Custom renderer to make links open in new tab
 */
const renderer = new marked.Renderer();
const originalLinkRenderer = renderer.link.bind(renderer);

renderer.link = function(href, title, text) {
  const html = originalLinkRenderer(href, title, text);
  return html.replace(/^<a /, '<a target="_blank" rel="noopener noreferrer" ');
};

marked.use({ renderer });

/**
 * Configure DOMPurify to allow necessary HTML elements and attributes
 */
const purifyConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'del', 'strike',
    'code', 'pre', 'blockquote', 'a', 'img',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'div', 'span'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel',
    'src', 'alt', 'width', 'height',
    'class', 'id'
  ]
};

/**
 * Render markdown to sanitized HTML
 * @param {string} markdownText - Raw markdown text
 * @returns {string} Sanitized HTML string
 */
export function renderMarkdown(markdownText) {
  if (!markdownText) return '';

  try {
    // Parse markdown to HTML
    const rawHtml = marked.parse(markdownText);

    // Sanitize HTML to prevent XSS
    const cleanHtml = DOMPurify.sanitize(rawHtml, purifyConfig);

    return cleanHtml;
  } catch (error) {
    console.error('Failed to render markdown:', error);
    // Fallback to plain text if parsing fails
    return markdownText;
  }
}

/**
 * Check if text contains markdown syntax
 * Useful for optimizing rendering (skip parsing if no markdown)
 * @param {string} text - Text to check
 * @returns {boolean} True if text appears to contain markdown
 */
export function hasMarkdown(text) {
  if (!text) return false;

  // Check for common markdown patterns
  const markdownPatterns = [
    /\*\*.*\*\*/,       // Bold
    /__.*__/,           // Bold (alternative)
    /\*.*\*/,           // Italic
    /_.*_/,             // Italic (alternative)
    /`.*`/,             // Inline code
    /```[\s\S]*```/,    // Code blocks
    /\[.*\]\(.*\)/,     // Links
    /^#{1,6}\s/m,       // Headings
    /^>\s/m,            // Blockquotes
    /^[-*+]\s/m,        // Unordered lists
    /^\d+\.\s/m,        // Ordered lists
    /^\|.*\|$/m,        // Tables
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
}

export default {
  renderMarkdown,
  hasMarkdown
};
