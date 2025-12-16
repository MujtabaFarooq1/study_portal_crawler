import * as cheerio from 'cheerio';
import fs from 'fs/promises';

/**
 * Test the extraction logic on saved HTML
 */
async function testExtraction() {
    console.log('Testing Extraction Logic on Search Page HTML\n');

    const html = await fs.readFile('search-page-debug.html', 'utf-8');
    const $ = cheerio.load(html);

    // Find cards
    const cards = $('.SearchStudyCard');
    console.log(`Found ${cards.length} SearchStudyCard elements\n`);

    if (cards.length > 0) {
        // Test extraction on first card
        const firstCard = cards.first();

        console.log('Testing extractors on first card:\n');

        // Try to find program name
        const nameSelectors = ['h2', 'h3', 'h4', '.card-title', '[class*="title"]', '[class*="Title"]'];
        for (const selector of nameSelectors) {
            const name = firstCard.find(selector).first().text().trim();
            if (name) {
                console.log(`✓ Name with ${selector}: "${name.substring(0, 50)}"`);
                break;
            } else {
                console.log(`✗ Name with ${selector}: (not found)`);
            }
        }

        // Try to find link
        const link = firstCard.find('a').first().attr('href');
        console.log(`\nLink: ${link}`);

        // Show full text content
        const fullText = firstCard.text().trim().replace(/\s+/g, ' ').substring(0, 200);
        console.log(`\nFirst 200 chars of card text:\n"${fullText}..."`);

        // Show HTML structure (first 500 chars)
        const htmlStructure = firstCard.html()?.substring(0, 500);
        console.log(`\nFirst 500 chars of HTML:\n${htmlStructure}...`);
    }
}

testExtraction().catch(console.error);
