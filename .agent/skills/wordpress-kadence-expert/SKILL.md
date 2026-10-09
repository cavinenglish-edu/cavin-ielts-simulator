---
name: wordpress-kadence-expert
description: >-
  Use this skill when developing, customizing, styling, or automating WordPress sites using the Kadence Theme, Kadence Blocks, Kadence Hooks, and WordPress REST API.
---

# WordPress & Kadence Theme / Blocks Development Guide

This skill provides expert knowledge for building, customizing, and automating WordPress websites powered by the **Kadence Theme** and **Kadence Blocks** (Gutenberg).

---

## 1. Kadence Theme Architecture & Hooks

Kadence is a high-performance, lightweight WordPress theme built around native Gutenberg and modern CSS custom properties.

### Common Kadence Action Hooks (for `functions.php` or Snippets)
Instead of editing core files, always hook into Kadence's action hierarchy:

* **Header Area:**
  * `kadence_before_header`
  * `kadence_header`
  * `kadence_after_header` (Ideal for notification bars, hero banners)
* **Content & Layout Area:**
  * `kadence_before_content`
  * `kadence_entry_header`
  * `kadence_single_before_entry_content`
  * `kadence_single_after_entry_content` (Ideal for author boxes, related posts, CTA boxes)
  * `kadence_after_content`
* **Footer Area:**
  * `kadence_before_footer`
  * `kadence_footer`
  * `kadence_after_footer`

```php
// Example: Add a custom call-to-action banner right after single post content
add_action('kadence_single_after_entry_content', function() {
    if (is_single()) {
        echo '<div class="custom-kadence-cta">...</div>';
    }
}, 15);
```

### Kadence Global CSS Variables
Always use Kadence's CSS custom properties to maintain theme harmony:
* Colors: `var(--global-palette1)` to `var(--global-palette9)`
* Backgrounds: `var(--global-content-bg)`, `var(--global-body-bg)`
* Typography: `var(--global-kb-font-size-sm)`, `var(--global-kb-font-size-md)`, `var(--global-kb-font-size-lg)`

---

## 2. Kadence Blocks Syntax (Gutenberg Content Injection)

When generating WordPress post content or building blocks programmatically, use Kadence's native block markup:

### A. Kadence Row Layout (2 Columns)
```html
<!-- wp:kadence/rowlayout {"uniqueID":"_kad_row_1","columns":2,"colLayout":"equal"} -->
<!-- wp:kadence/column {"uniqueID":"_kad_col_1"} -->
<!-- wp:kadence/advancedheading {"uniqueID":"_kad_head_1","content":"Cột bên trái"} -->
<h2 class="kt-adv-heading_kad_head_1">Cột bên trái</h2>
<!-- /wp:kadence/advancedheading -->
<!-- /wp:kadence/column -->

<!-- wp:kadence/column {"uniqueID":"_kad_col_2"} -->
<!-- wp:paragraph -->
<p>Nội dung cột bên phải...</p>
<!-- /wp:paragraph -->
<!-- /wp:kadence/column -->
<!-- /wp:kadence/rowlayout -->
```

### B. Kadence Info Box & Advanced Buttons
* Block names: `wp:kadence/infobox`, `wp:kadence/advancedbtn`, `wp:kadence/accordion`.
* Each Kadence block requires a unique ID attribute `{"uniqueID": "_kad_..."}` to prevent style collisions in the editor.

---

## 3. WordPress REST API Automation

To automate creating or updating posts, categories, or media on a self-hosted Kadence site:

### Authentication: Application Passwords
WordPress native REST API supports **Application Passwords** (created in `Users -> Profile -> Application Passwords`):

```typescript
const wpUrl = 'https://your-wordpress-site.com/wp-json/wp/v2/posts';
const username = 'admin';
const appPassword = 'xxxx xxxx xxxx xxxx'; // Generated Application Password

const response = await fetch(wpUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + Buffer.from(`${username}:${appPassword}`).toString('base64'),
  },
  body: JSON.stringify({
    title: 'Tiêu đề bài viết mới',
    content: '<!-- wp:paragraph --><p>Nội dung bài viết...</p><!-- /wp:paragraph -->',
    status: 'draft', // or 'publish'
    categories: [1],
    featured_media: 123,
  }),
});
```

---

## 4. Performance & Core Web Vitals Checklist for Kadence
1. **Asset Loading:** Use Kadence's built-in feature to load Google Fonts locally and enable CSS preload.
2. **Featured Images:** Ensure images have `width` and `height` attributes to avoid Cumulative Layout Shift (CLS).
3. **Kadence Elements (Pro):** Use Hooked Elements with conditional display rules instead of heavy third-party page builders for maximum performance.
