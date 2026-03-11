---
name: blog-content-generation
description: Use when creating or enhancing blog content for the DGA CBD website. Generates long-form articles with images, sources, and i18n translations.
---

# Blog Content Generation Skill

Use this skill when creating new blog posts or enhancing existing ones for the DGA (Dutch Green Alternative) CBD website.

## Context

- **Target audience**: 50+ year old Germans interested in CBD for health
- **Tone**: Soft advisory — never make medical claims, use phrasing like "may help", "studies suggest", "many users report"
- **Languages**: de (primary), en, nl — translations must all be present
- **Products**: Golden Spectrum 35%, CBD Gold 35%, RAW CBD 5.5%, RAW CBD 11%
- **Competitor reference**: https://dutchnaturalhealing.com/nl/blogs/cbd

## Blog Post Structure (Based on Competitor Analysis)

Each blog post should follow this structure:

### 1. Content (~1500-2000 words per locale)
- **Introduction** (2-3 paragraphs): Hook + context + what the reader will learn
- **6-8 H2 sections** with H3 subsections where appropriate
- **Blockquotes** for emphasis or customer testimonials
- **Bullet lists** for key takeaways, dosing info, product features
- **Internal product links** to DGA product pages using format: `<a href="/de/shop">unsere Produkte</a>`
- **Conclusion** section summarizing key points
- No author bio (user preference)

### 2. Sources (3-5 per post)
Each post must include scientific sources in the translations JSON:
```json
"sources": [
    { "text": "Author et al. (Year). Title. Journal.", "url": "https://pubmed..." },
    { "text": "Organization. Report title.", "url": "https://..." }
]
```
Use PubMed, WHO, NCBI sources where possible.

### 3. Images (2 per post)
- **Hero image** (featured_image): Wide landscape format (21:9), editorial/lifestyle
- **In-content image**: Placed mid-article via `<img>` tag in the HTML content

#### Image Generation Guidelines
- Use `generate_image` tool with product photos as reference images
- Download product photos first: `curl -s -o /tmp/product.jpg "SUPABASE_URL/storage/v1/object/public/DGA/products/FILENAME"`
- **Hero images**: Atmospheric, editorial — CBD lifestyle, nature, wellness scenes. Include the product bottle subtly in the scene.
- **In-content images**: More specific to the topic — e.g. person sleeping for sleep article, medications for interactions article
- All images feature real-looking 50+ year old people in natural settings
- Low-key, warm lighting, premium feel
- After generating, optimize: `sips -s format jpeg -s formatOptions 75 -Z 1200 INPUT --out OUTPUT`

### 4. Uploading Images
```bash
# Upload to Supabase storage
curl -X POST "SUPABASE_URL/storage/v1/object/DGA/blog/FILENAME" \
  -H "Authorization: Bearer SERVICE_ROLE_KEY" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/path/to/file.jpg
```
The public URL will be: `SUPABASE_URL/storage/v1/object/public/DGA/blog/FILENAME`

### 5. Database Schema
Blog posts live in the `blog_posts` table:
```json
{
    "slug": "cbd-for-chronic-pain",
    "featured_image": "https://...supabase.co/storage/v1/object/public/DGA/blog/hero.jpg",
    "tags": ["CBD", "Schmerzen"],
    "is_published": true,
    "published_at": "2026-03-10T00:00:00Z",
    "translations": {
        "de": { "title": "...", "excerpt": "...", "content": "<h2>...</h2><p>...</p>", "sources": [...] },
        "en": { "title": "...", "excerpt": "...", "content": "...", "sources": [...] },
        "nl": { "title": "...", "excerpt": "...", "content": "...", "sources": [...] }
    }
}
```

### 6. Inserting/Updating Posts
Use a Node.js seed script with the `SUPABASE_SERVICE_ROLE_KEY` (anon key is blocked by RLS):
```javascript
const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts`, {
    method: 'POST', // or PATCH for updates
    headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(post),
});
```

## Blog Post Topic Ideas (from competitor analysis)
- CBD for chronic pain / joint pain / arthritis
- CBD dosing guide (start low, go slow)
- RAW vs Gold CBD oil comparison
- CBD and blood pressure
- CBD for better sleep
- CBD and medication interactions
- Cannabinoids explained (CBD, CBG, THC)
- CBD customer experiences / testimonials
- CBD for stress and anxiety
- CBD for pets (dogs)
- CBD and sports / recovery
- Full spectrum vs isolate
- CBD legality and drug tests

## Workflow

1. **Research**: Check competitor blog for topic inspiration
2. **Write content**: Draft in German first (~1500-2000 words), then translate to EN and NL
3. **Generate images**: 1 hero + 1 in-content using product photos as reference
4. **Upload images**: To Supabase storage under `DGA/blog/`
5. **Insert/update post**: Use seed script with service role key
6. **Verify**: Build + push, check live deployment

## Important Rules
- NEVER make medical claims — always use advisory language
- ALWAYS include 3-5 scientific sources per post
- ALWAYS include the medical disclaimer (built into the blog detail page)
- German content should be the most detailed and polished (primary audience)
- Include in-content images via `<img src="URL" alt="description" style="width:100%;border-radius:12px;margin:1.5rem 0" />`
