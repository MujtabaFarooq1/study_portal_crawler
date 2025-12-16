import * as cheerio from 'cheerio';
import fs from 'fs/promises';

/**
 * Find where the actual program link is in the card
 */
async function findLink() {
    console.log('Finding Program Link in Card\n');

    const html = await fs.readFile('search-page-debug.html', 'utf-8');
    const $ = cheerio.load(html);

    const firstCard = $('.SearchStudyCard').first();

    // Find all links in the card
    const links = [];
    firstCard.find('a').each((i, elem) => {
        const href = $(elem).attr('href');
        const text = $(elem).text().trim();
        links.push({ index: i, href, text: text.substring(0, 50) });
    });

    console.log(`Found ${links.length} links in first card:\n`);
    links.forEach(link => {
        console.log(`${link.index}. href="${link.href}"`);
        console.log(`   text="${link.text}"`);
        console.log();
    });

    // Find link to study page
    const studyLink = links.find(l => l.href && l.href.includes('/studies/'));
    if (studyLink) {
        console.log(`✓ Study page link found at index ${studyLink.index}:`);
        console.log(`  ${studyLink.href}`);
    }
}

findLink().catch(console.error);
