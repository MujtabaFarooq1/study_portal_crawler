import * as cheerio from 'cheerio';
import fs from 'fs/promises';

/**
 * Test cheerio selectors on the saved HTML
 */
async function testCheerio() {
    console.log('Testing Cheerio Selectors\n');

    const html = await fs.readFile('debug-page.html', 'utf-8');
    const $ = cheerio.load(html);

    console.log(`HTML length: ${html.length} characters\n`);

    // Test various selectors
    const selectors = [
        '.SearchStudyCard',
        '.StudyCard',
        '[class*="Card"]',
        '[class*="StudyCard"]',
        'article',
        'article[class*="Card"]',
        '[class="SearchStudyCard js-bestFitStudycard js-studyCardExperiment HoverEffect"]'
    ];

    for (const selector of selectors) {
        const elements = $(selector);
        console.log(`${selector}: ${elements.length} elements`);

        if (elements.length > 0) {
            // Show first element's structure
            const first = elements.first();
            const classes = first.attr('class');
            const html = first.html()?.substring(0, 200);
            console.log(`  First element classes: ${classes}`);
            console.log(`  First 200 chars of HTML: ${html}...\n`);
        }
    }

    // Try to extract program name from first card
    console.log('\nTrying to extract data from first card:');
    const card = $('.SearchStudyCard').first();

    if (card.length > 0) {
        // Try different name selectors
        const nameSelectors = ['h2', 'h3', 'h4', '.card-title', '[class*="title"]', '[class*="Title"]'];
        for (const sel of nameSelectors) {
            const name = card.find(sel).first().text().trim();
            if (name) {
                console.log(`  ${sel}: "${name}"`);
            }
        }
    }
}

testCheerio().catch(console.error);
