import MastersPortalPlaywrightCrawler from '../src/crawlers/MastersPortalPlaywrightCrawler.js';
import fs from 'fs/promises';

/**
 * Quick test with enhanced stealth mode
 */
async function quickTest() {
    console.log('🚀 Quick Test with Enhanced Anti-Detection\n');
    console.log('='.repeat(80) + '\n');

    const crawler = new MastersPortalPlaywrightCrawler({
        maxCrawlLength: 5,       // Just 5 pages for quick test
        requestDelay: 5000,      // 5 seconds between requests
        headless: true
    });

    try {
        const results = await crawler.crawl();

        console.log('\n' + '='.repeat(80));
        console.log('📊 TEST RESULTS');
        console.log('='.repeat(80) + '\n');

        // Separate search results from detailed study pages
        const searchResults = results.extractedData.filter(p => !p.courseName);
        const detailedPrograms = results.extractedData.filter(p => p.courseName);

        console.log(`Total items extracted: ${results.extractedData.length}`);
        console.log(`📋 Search result cards: ${searchResults.length}`);
        console.log(`📄 Detailed study pages: ${detailedPrograms.length}\n`);

        if (detailedPrograms.length > 0) {
            console.log('✅ SUCCESS! Detailed data extraction is working!\n');
            console.log('Sample detailed program:\n');
            const sample = detailedPrograms[0];
            console.log(`Course: ${sample.courseName}`);
            console.log(`University: ${sample.university}`);
            console.log(`Country: ${sample.country}`);
            console.log(`Tuition: ${sample.tuitionFee}`);
            console.log(`Duration: ${sample.duration}`);
            console.log(`Intakes: ${sample.intakes}`);

            if (sample.languageRequirements && Object.keys(sample.languageRequirements).length > 0) {
                console.log('\nLanguage Requirements:');
                Object.entries(sample.languageRequirements).forEach(([test, score]) => {
                    console.log(`  ${test}: ${score}`);
                });
            }

            // Check if we're still getting blocked
            const blockedPages = detailedPrograms.filter(p =>
                p.courseName && p.courseName.includes('blocked')
            );

            if (blockedPages.length > 0) {
                console.log(`\n⚠️  WARNING: ${blockedPages.length} pages still blocked by Cloudflare`);
            } else {
                console.log('\n✅ No blocked pages detected!');
            }

            // Save to file
            await fs.writeFile(
                'quick-test-results.json',
                JSON.stringify(detailedPrograms, null, 2)
            );
            console.log('\n💾 Results saved to: quick-test-results.json');
        } else {
            console.log('⚠️  No detailed pages extracted. Checking what was extracted...\n');

            // Check if we got blocked messages
            const blockedResults = results.extractedData.filter(p =>
                (p.name && p.name.includes('blocked')) ||
                (p.courseName && p.courseName.includes('blocked'))
            );

            if (blockedResults.length > 0) {
                console.log('❌ Pages are still being blocked by Cloudflare');
                console.log('Try:');
                console.log('  1. Increasing requestDelay even more (e.g., 10000ms)');
                console.log('  2. Running with headless: false to see what\'s happening');
                console.log('  3. Using a VPN or different IP address');
            }
        }

        console.log('\n' + '='.repeat(80) + '\n');

        return results;
    } catch (error) {
        console.error('❌ Error during test:', error);
        throw error;
    }
}

quickTest().catch(console.error);
