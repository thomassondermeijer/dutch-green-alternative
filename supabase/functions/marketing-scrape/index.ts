import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ── Citable sources ────────────────────────────────────────────────────────
// Jina returns the page as prose, which drops every hyperlink: the BudMed
// issues link one PubMed study per section, and all of them were lost. The
// `x-with-links-summary` header appends the full link list, and the research
// links are stored in their own column — the prose is truncated twice before
// it reaches the model, so anything at the end of it would not survive.
//
// Research domains only. Keep in step with ALLOWED_LINK_DOMAINS in
// src/lib/marketing/links.ts, minus our own domain (which never appears in a
// source issue) and minus the newsletter platforms, which are excluded there.
const RESEARCH_DOMAINS = [
  "nih.gov", "doi.org", "clinicaltrials.gov", "who.int", "cochranelibrary.com",
  "nature.com", "science.org", "sciencedirect.com", "elsevier.com", "thelancet.com",
  "bmj.com", "jamanetwork.com", "nejm.org", "cell.com", "pnas.org",
  "springer.com", "springeropen.com", "biomedcentral.com", "wiley.com",
  "tandfonline.com", "mdpi.com", "frontiersin.org", "plos.org", "oup.com",
  "sagepub.com", "ahajournals.org", "karger.com", "acs.org", "rsc.org",
];

type SourceLink = {
  url: string;
  pmid?: string;
  title?: string;
  journal?: string;
  year?: string;
};

function isResearchUrl(url: string): boolean {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
  return RESEARCH_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Drop the newsletter's own tracking parameters.
 *
 * beehiiv appends `?utm_source=budmedbulletin.beehiiv.com&utm_campaign=…` to
 * every outbound link, so citing one unchanged would credit the referral to a
 * competitor from inside our own email.
 */
function cleanUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|ref$|referrer$|source$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\?$/, "");
  } catch {
    return raw;
  }
}

/** Pull research links out of the markdown and the appended links summary. */
function extractResearchLinks(text: string): string[] {
  const urls = new Set<string>();
  for (const m of text.matchAll(/https?:\/\/[^\s)<>"'\]]+/g)) {
    // Trailing punctuation from prose is not part of the URL.
    const url = cleanUrl(m[0].replace(/[.,;:]+$/, ""));
    if (isResearchUrl(url)) urls.add(url);
  }
  return [...urls];
}

/**
 * Give each PubMed link its title, journal and year.
 *
 * Every anchor in the source reads "This NIH study reports:", so without this
 * the model could only match a link to a study by position. A wrong citation
 * is worse than none, and E-utilities is free and keyless.
 */
async function describeLinks(urls: string[]): Promise<SourceLink[]> {
  const links: SourceLink[] = urls.map((url) => {
    const pmid = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/.exec(url)?.[1];
    return pmid ? { url, pmid } : { url };
  });

  const pmids = links.map((l) => l.pmid).filter(Boolean);
  if (pmids.length === 0) return links;

  try {
    const res = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${pmids.join(",")}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return links;

    const result = (await res.json())?.result || {};
    for (const link of links) {
      const row = link.pmid ? result[link.pmid] : null;
      if (!row) continue;
      link.title = row.title;
      link.journal = row.fulljournalname || row.source;
      link.year = String(row.pubdate || "").slice(0, 4);
    }
  } catch {
    // A citation without its title is still a usable link.
  }

  return links;
}

async function scrapeIssue(url: string) {
  const postRes = await fetch(`https://r.jina.ai/${url}`, {
    headers: {
      "Accept": "text/plain",
      // Without this the hyperlinks are flattened away entirely.
      "x-with-links-summary": "all",
    },
  });
  if (!postRes.ok) return null;
  const postText = await postRes.text();

  const titleMatch = postText.match(/^#\s+(.+)$/m) || postText.match(/Title:\s*(.+)/);
  const title = titleMatch ? titleMatch[1].trim() : "BudMed Bulletin";

  const sourceLinks = await describeLinks(extractResearchLinks(postText));

  const content = postText.slice(0, 12000);
  const lowerContent = content.toLowerCase();
  const cancerKeywords = [
    "cancer", "tumor", "tumour", "oncology", "carcinoma",
    "chemotherapy", "malignant", "metastasis", "leukemia",
    "lymphoma", "melanoma", "glioblastoma", "anti-tumor",
    "antitumor", "krebs", "kanker",
  ];

  return {
    url,
    title,
    content,
    source_links: sourceLinks,
    has_cancer_content: cancerKeywords.some((kw) => lowerContent.includes(kw)),
    scraped_at: new Date().toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  try {
    // `{ refreshLinks: true }` re-reads issues already stored, to fill in
    // source_links for the ones scraped before they were captured.
    const body = await req.json().catch(() => ({}));
    const refreshLinks = body?.refreshLinks === true;

    // Step 1: Fetch BudMed archive via Jina Reader
    const archiveRes = await fetch("https://r.jina.ai/https://budmedbulletin.beehiiv.com/archive", {
      headers: { "Accept": "text/plain" },
    });
    if (!archiveRes.ok) throw new Error(`Jina archive error: ${archiveRes.status}`);
    const archiveText = await archiveRes.text();

    const issueUrls = [...new Set(
      [...archiveText.matchAll(/https:\/\/budmedbulletin\.beehiiv\.com\/p\/(issue-\d+[^)\s]*)/g)]
        .map(m => `https://budmedbulletin.beehiiv.com/p/${m[1]}`)
    )].slice(0, 10);

    if (issueUrls.length === 0) throw new Error("No BudMed issues found");

    // Step 2: Check which are already scraped
    const { data: existing } = await supabaseAdmin
      .from("budmed_articles")
      .select("url, source_links")
      .in("url", issueUrls);

    const existingUrls = new Set((existing || []).map(e => e.url));
    // A refresh re-reads every stored issue in the archive, so a change to how
    // links are captured can be applied to what is already there.
    const staleUrls = refreshLinks ? (existing || []).map((e: { url: string }) => e.url) : [];
    const targetUrls = [...issueUrls.filter(u => !existingUrls.has(u)), ...staleUrls];

    // Step 3: Fetch and store
    const results: { url: string; title: string; has_cancer: boolean; source_links: number }[] = [];

    for (const url of targetUrls) {
      try {
        const article = await scrapeIssue(url);
        if (!article) continue;

        const { error } = await supabaseAdmin
          .from("budmed_articles")
          .upsert(article, { onConflict: "url" });

        if (!error) {
          results.push({
            url,
            title: article.title,
            has_cancer: article.has_cancer_content,
            source_links: article.source_links.length,
          });
        }
      } catch {
        // Skip failed individual articles
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_found: issueUrls.length,
      already_scraped: existingUrls.size,
      refreshed: staleUrls.length,
      newly_scraped: results.length - staleUrls.length,
      articles: results,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[marketing-scrape]", err);
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Scrape failed",
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
