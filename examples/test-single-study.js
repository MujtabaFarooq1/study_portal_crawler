import MastersPortalPlaywrightCrawler from '../src/crawlers/MastersPortalPlaywrightCrawler.js';
import fs from 'fs/promises';

/**
 * Test extraction of just 1-2 study pages to verify selectors
 */
async function testSingleStudy() {
    console.log('🔬 Testing Single Study Page Extraction\n');
    console.log('='.repeat(80) + '\n');

    const crawler = new MastersPortalPlaywrightCrawler({
        maxCrawlLength: 2,       // Just 2 pages: 1 search + 1 study
        requestDelay: 20000,     // 20 seconds delay between pages
        headless: true
    });

    try {
        const results = await crawler.crawl();

        console.log('\n' + '='.repeat(80));
        console.log('📊 TEST RESULTS');
        console.log('='.repeat(80) + '\n');

        const detailedPrograms = results.extractedData;

        console.log(`Pages crawled: ${results.crawledCount}`);
        console.log(`Programs extracted: ${detailedPrograms.length}\n`);

        if (detailedPrograms.length > 0) {
            console.log('📚 EXTRACTED DATA:\n');

            detailedPrograms.forEach((program, index) => {
                console.log(`Program ${index + 1}:`);
                console.log('─'.repeat(80));
                console.log(`Course Name: ${program.courseName || 'N/A'}`);
                console.log(`University: ${program.university || 'N/A'}`);
                console.log(`Country: ${program.country || 'N/A'}`);
                console.log(`Tuition Fee: ${program.tuitionFee || 'N/A'}`);
                console.log(`Duration: ${program.duration || 'N/A'}`);
                console.log(`Intakes: ${program.intakes || 'N/A'}`);

                if (program.languageRequirements && Object.keys(program.languageRequirements).length > 0) {
                    console.log('\nLanguage Requirements:');
                    Object.entries(program.languageRequirements).forEach(([test, score]) => {
                        console.log(`  • ${test}: ${score}`);
                    });
                } else {
                    console.log('\nLanguage Requirements: None found');
                }

                if (program.generalRequirements && program.generalRequirements.length > 0) {
                    console.log(`\nGeneral Requirements (${program.generalRequirements.length} items):`);
                    program.generalRequirements.slice(0, 3).forEach(req => {
                        console.log(`  • ${req.substring(0, 80)}${req.length > 80 ? '...' : ''}`);
                    });
                    if (program.generalRequirements.length > 3) {
                        console.log(`  ... and ${program.generalRequirements.length - 3} more`);
                    }
                } else {
                    console.log('\nGeneral Requirements: None found');
                }

                if (program.officialUniversityLink) {
                    console.log(`\n🔗 Official Link: ${program.officialUniversityLink}`);
                }

                console.log(`\n📍 Source: ${program.sourceUrl}`);
                console.log(`⏰ Extracted: ${program.extractedAt}`);
                console.log();
            });

            // Save to file
            await fs.writeFile(
                'single-study-test.json',
                JSON.stringify(detailedPrograms, null, 2)
            );
            console.log('💾 Full data saved to: single-study-test.json\n');

            // Check if blocked
            const blocked = detailedPrograms.some(p =>
                p.courseName && (p.courseName.includes('blocked') || p.courseName.includes('Sorry'))
            );

            if (blocked) {
                console.log('❌ Page was BLOCKED by Cloudflare');
                console.log('   → Need to increase delays or add more anti-detection measures\n');
            } else if (!detailedPrograms[0].courseName || detailedPrograms[0].courseName === '') {
                console.log('⚠️  Selectors may need adjustment - no course name found\n');
            } else {
                console.log('✅ SUCCESS! Data extracted correctly!\n');
            }
        } else {
            console.log('❌ No data extracted\n');
        }

        console.log('='.repeat(80) + '\n');

        return results;
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

testSingleStudy().catch(console.error);
