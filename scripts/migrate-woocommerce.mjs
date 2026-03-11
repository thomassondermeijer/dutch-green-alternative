/**
 * WooCommerce → Supabase Migration Script
 * 
 * Run: node scripts/migrate-woocommerce.mjs
 * 
 * Prerequisites:
 *   1. Run the SQL in scripts/add-sku-column.sql in Supabase SQL Editor first
 *   2. Set env vars in .env.local
 */
import { readFileSync } from 'fs';
import { parse } from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE env vars. Run: source .env.local');
    process.exit(1);
}

// ─── CSV Parser (simple, handles quoted fields with commas) ───
function parseCSV(text) {
    const lines = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === '"') {
            if (inQuotes && text[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            lines.push(current);
            current = '';
        } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (current || lines.length > 0) {
                lines.push(current);
                current = '';
            }
            if (lines.length > 0) {
                yield lines.splice(0);
            }
            if (ch === '\r' && text[i + 1] === '\n') i++;
        } else {
            current += ch;
        }
    }
    if (current || lines.length > 0) {
        lines.push(current);
        yield lines.splice(0);
    }
}

function readCSV(filePath) {
    const text = readFileSync(filePath, 'utf-8');
    const rows = [...parseCSV(text)];
    const headers = rows[0];
    return rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
            obj[h.trim()] = (row[i] || '').trim();
        });
        return obj;
    });
}

async function supabaseFetch(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
            ...options.headers,
        },
    });
    return res;
}

// ─── Product SKU + Price Update ───
async function updateProducts() {
    console.log('\n═══ UPDATING PRODUCT PRICES & SKUs ═══\n');

    const skuMap = {
        'cbd-raw-5-5': { sku: '5764374', price: 23.95 },
        'cbd-raw-11': { sku: '80678362', price: 41.95 },
        'cbd-gold-35': { sku: '5001', price: 84.95 },
        'golden-spectrum-35': { sku: '5002', price: 89.95 },
        'cbg-raw-12': { sku: '3001', price: 49.95 },
        'mind-comfort-8': { sku: '4006', price: 28.95 },
        'good-night-8': { sku: '4003-2022', price: 28.95 },
        'body-harmony-8': { sku: '4002-NF', price: 28.95 },
    };

    for (const [slug, data] of Object.entries(skuMap)) {
        const res = await supabaseFetch(`products?slug=eq.${slug}`, {
            method: 'PATCH',
            body: JSON.stringify({
                sku: data.sku,
                price: data.price,
                updated_at: new Date().toISOString(),
            }),
        });

        if (res.ok) {
            const result = await res.json();
            if (result.length > 0) {
                console.log(`  ✅ ${slug} → SKU: ${data.sku}, Price: €${data.price}`);
            } else {
                console.log(`  ⚠️  ${slug} → not found in database`);
            }
        } else {
            const err = await res.text();
            console.log(`  ❌ ${slug} → ERROR: ${err}`);
        }
    }
}

// ─── Customer Import ───
async function importCustomers() {
    console.log('\n═══ IMPORTING CUSTOMERS ═══\n');

    const customers = readCSV('customers.csv');
    console.log(`  Found ${customers.length} customers in CSV`);

    // Filter out zero-spend customers
    const paying = customers.filter(c => {
        const spent = parseFloat(c['Total Spent'] || '0');
        return spent > 0;
    });
    console.log(`  ${paying.length} customers with orders (filtered ${customers.length - paying.length} zero-spend)\n`);

    // Infer language from billing country
    function inferLang(country) {
        if (country === 'NL') return 'nl';
        if (country === 'BE') return 'nl';
        return 'de';
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches of 20
    const batchSize = 20;
    for (let i = 0; i < paying.length; i += batchSize) {
        const batch = paying.slice(i, i + batchSize);

        const records = batch.map(c => {
            const billingAddress = {
                type: 'billing',
                first_name: c['Billing Address First Name'] || c['First Name'] || '',
                last_name: c['Billing Address Last Name'] || c['Last Name'] || '',
                company: c['Billing Address Company'] || '',
                address_1: c['Billing Address Address 1'] || '',
                address_2: c['Billing Address Address 2'] || '',
                city: c['Billing Address City'] || '',
                state: c['Billing Address State'] || '',
                postcode: c['Billing Address Postcode'] || '',
                country: c['Billing Address Country'] || '',
            };

            const shippingAddress = {
                type: 'shipping',
                first_name: c['Shipping Address First Name'] || c['First Name'] || '',
                last_name: c['Shipping Address Last Name'] || c['Last Name'] || '',
                company: c['Shipping Address Company'] || '',
                address_1: c['Shipping Address Address 1'] || '',
                address_2: c['Shipping Address Address 2'] || '',
                city: c['Shipping Address City'] || '',
                state: c['Shipping Address State'] || '',
                postcode: c['Shipping Address Postcode'] || '',
                country: c['Shipping Address Country'] || '',
            };

            const addresses = [billingAddress];
            // Only add shipping if different from billing
            if (shippingAddress.address_1 && shippingAddress.address_1 !== billingAddress.address_1) {
                addresses.push(shippingAddress);
            }

            return {
                email: (c['Email'] || c['Billing Address Email'] || '').toLowerCase().trim(),
                first_name: c['First Name'] || '',
                last_name: c['Last Name'] || '',
                phone: c['Billing Address Phone'] || null,
                language_pref: inferLang(c['Billing Address Country'] || 'DE'),
                addresses: JSON.stringify(addresses),
            };
        }).filter(r => r.email); // Skip records without email

        // Use upsert to avoid duplicates (on email conflict)
        const res = await supabaseFetch('customers', {
            method: 'POST',
            headers: {
                Prefer: 'resolution=merge-duplicates,return=representation',
            },
            body: JSON.stringify(records),
        });

        if (res.ok) {
            const result = await res.json();
            imported += result.length;
        } else {
            const err = await res.text();
            // If bulk fails, try one-by-one
            for (const record of records) {
                const singleRes = await supabaseFetch('customers', {
                    method: 'POST',
                    headers: {
                        Prefer: 'resolution=merge-duplicates,return=representation',
                    },
                    body: JSON.stringify(record),
                });
                if (singleRes.ok) {
                    imported++;
                } else {
                    errors++;
                    if (errors <= 3) {
                        const singleErr = await singleRes.text();
                        console.log(`  ❌ ${record.email}: ${singleErr.substring(0, 100)}`);
                    }
                }
            }
        }

        // Progress
        if ((i + batchSize) % 100 === 0 || i + batchSize >= paying.length) {
            process.stdout.write(`  Progress: ${Math.min(i + batchSize, paying.length)}/${paying.length}\r`);
        }
    }

    console.log(`\n  ✅ Imported: ${imported}`);
    if (skipped > 0) console.log(`  ⏭️  Skipped (duplicates): ${skipped}`);
    if (errors > 0) console.log(`  ❌ Errors: ${errors}`);
}

// ─── Main ───
async function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   DGA WooCommerce → Supabase Migration   ║');
    console.log('╚══════════════════════════════════════════╝');

    await updateProducts();
    await importCustomers();

    console.log('\n✅ Migration complete!\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
