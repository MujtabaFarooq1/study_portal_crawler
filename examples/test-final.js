import MastersPortalPlaywrightCrawler from '../src/crawlers/MastersPortalPlaywrightCrawler.js';
import fs from 'fs/promises';

/**
 * Final test with updated selectors and longer delays
 */
async function finalTest() {
    console.log('🎯 Final Test - Updated Selectors + Anti-Block Measures\n');
    console.log('='.repeat(80) + '\n');

    const crawler = new MastersPortalPlaywrightCrawler({
        maxCrawlLength: 4,       // Just 4 pages: 1 search + 3 study pages
        requestDelay: 8000,      // 8 seconds between requests to avoid blocks
        headless: true
    });

    try {
        const results = await crawler.crawl();

        console.log('\n' + '='.repeat(80));
        console.log('📊 FINAL TEST RESULTS');
        console.log('='.repeat(80) + '\n');

        const detailedPrograms = results.extractedData.filter(p => p.courseName);

        console.log(`✓ Total pages crawled: ${results.crawledCount}`);
        console.log(`✓ Programs extracted: ${detailedPrograms.length}\n`);

        if (detailedPrograms.length > 0) {
            console.log('📚 EXTRACTED PROGRAM DATA:\n');

            detailedPrograms.forEach((program, index) => {
                console.log(`${index + 1}. ${program.courseName || 'N/A'}`);
                console.log(`   🏫 University: ${program.university || 'N/A'}`);
                console.log(`   🌍 Country: ${program.country || 'N/A'}`);
                console.log(`   💰 Tuition: ${program.tuitionFee || 'N/A'}`);
                console.log(`   ⏱️  Duration: ${program.duration || 'N/A'}`);
                console.log(`   📅 Intakes: ${program.intakes || 'N/A'}`);

                if (program.languageRequirements && Object.keys(program.languageRequirements).length > 0) {
                    console.log(`   📝 Language Tests:`);
                    Object.entries(program.languageRequirements).forEach(([test, score]) => {
                        console.log(`      - ${test}: ${score}`);
                    });
                }

                if (program.generalRequirements && program.generalRequirements.length > 0) {
                    console.log(`   📋 Requirements: ${program.generalRequirements.length} item(s)`);
                }

                if (program.officialUniversityLink) {
                    console.log(`   🔗 University Link: ${program.officialUniversityLink}`);
                }

                console.log();
            });

            // Save to file
            await fs.writeFile(
                'final-test-results.json',
                JSON.stringify(detailedPrograms, null, 2)
            );
            console.log('💾 Results saved to: final-test-results.json\n');

            // Check for blocks
            const blockedPages = detailedPrograms.filter(p =>
                p.courseName && (p.courseName.includes('blocked') || p.courseName.includes('Sorry'))
            );

            if (blockedPages.length > 0) {
                console.log(`⚠️  WARNING: ${blockedPages.length} page(s) were blocked by Cloudflare`);
                console.log('   → Try increasing requestDelay further\n');
            } else {
                console.log('✅ SUCCESS! No blocked pages detected!\n');
            }
        } else {
            console.log('⚠️  No programs extracted. Check if pages are loading correctly.\n');
        }

        console.log('='.repeat(80) + '\n');

        return results;
    } catch (error) {
        console.error('❌ Error during test:', error);
        throw error;
    }
}

finalTest().catch(console.error);
