import MastersPortalPlaywrightCrawler from '../src/crawlers/MastersPortalPlaywrightCrawler.js';
import fs from 'fs/promises';

/**
 * Test detailed data extraction from individual study pages
 */
async function testDetailedExtraction() {
    console.log('🔍 Testing Detailed Data Extraction from Study Pages\n');
    console.log('=' .repeat(80) + '\n');

    const crawler = new MastersPortalPlaywrightCrawler({
        maxCrawlLength: 10,      // Crawl 10 pages
        requestDelay: 5000,      // 5 seconds between requests (increased to avoid blocks)
        headless: true
    });

    try {
        const results = await crawler.crawl();

        console.log('\n' + '='.repeat(80));
        console.log('📊 EXTRACTION RESULTS');
        console.log('='.repeat(80) + '\n');

        console.log(`Total programs extracted: ${results.extractedData.length}\n`);

        // Separate search results from detailed study pages
        const searchResults = results.extractedData.filter(p => !p.courseName);
        const detailedPrograms = results.extractedData.filter(p => p.courseName);

        console.log(`📋 Search result cards: ${searchResults.length}`);
        console.log(`📄 Detailed study pages: ${detailedPrograms.length}\n`);

        if (detailedPrograms.length > 0) {
            console.log('=' .repeat(80));
            console.log('📚 DETAILED PROGRAM DATA (Sample)');
            console.log('='.repeat(80) + '\n');

            detailedPrograms.slice(0, 3).forEach((program, index) => {
                console.log(`\n${index + 1}. ${program.courseName || 'N/A'}`);
                console.log('─'.repeat(80));
                console.log(`   🏫 University: ${program.university || 'N/A'}`);
                console.log(`   🌍 Country: ${program.country || 'N/A'}`);
                console.log(`   💰 Tuition Fee: ${program.tuitionFee || 'N/A'}`);
                console.log(`   ⏱️  Duration: ${program.duration || 'N/A'}`);
                console.log(`   📅 Intakes: ${program.intakes || 'N/A'}`);
                console.log(`   📝 Apply Date: ${program.applyDate || 'N/A'}`);

                if (program.languageRequirements && Object.keys(program.languageRequirements).length > 0) {
                    console.log(`   🗣️  Language Requirements:`);
                    Object.entries(program.languageRequirements).forEach(([test, score]) => {
                        console.log(`      - ${test}: ${score}`);
                    });
                }

                if (program.entryRequirements && program.entryRequirements.length > 0) {
                    console.log(`   📋 Entry Requirements (${program.entryRequirements.length}):`);
                    program.entryRequirements.slice(0, 3).forEach((req, i) => {
                        console.log(`      ${i + 1}. ${req.substring(0, 70)}${req.length > 70 ? '...' : ''}`);
                    });
                    if (program.entryRequirements.length > 3) {
                        console.log(`      ... and ${program.entryRequirements.length - 3} more`);
                    }
                }

                console.log(`   🔗 Official Link: ${program.officialUniversityLink || 'N/A'}`);
                console.log(`   📍 Source: ${program.sourceUrl.substring(0, 60)}...`);
            });

            if (detailedPrograms.length > 3) {
                console.log(`\n   ... and ${detailedPrograms.length - 3} more detailed programs\n`);
            }

            // Save detailed programs to JSON
            await fs.writeFile(
                'detailed-programs.json',
                JSON.stringify(detailedPrograms, null, 2)
            );
            console.log('\n✅ Detailed programs saved to: detailed-programs.json');
        } else {
            console.log('⚠️  No detailed study pages were crawled. Try increasing maxCrawlLength.');
        }

        // Save all results
        await fs.writeFile(
            'all-results.json',
            JSON.stringify(results.extractedData, null, 2)
        );
        console.log('✅ All results saved to: all-results.json\n');

        console.log('='.repeat(80));
        console.log('📈 DATA QUALITY CHECK');
        console.log('='.repeat(80) + '\n');

        if (detailedPrograms.length > 0) {
            const sample = detailedPrograms[0];
            const fields = [
                'courseName', 'university', 'country', 'tuitionFee',
                'duration', 'intakes', 'languageRequirements',
                'entryRequirements', 'officialUniversityLink'
            ];

            console.log('Fields extracted from first detailed program:\n');
            fields.forEach(field => {
                const value = sample[field];
                const hasValue = value && (
                    typeof value === 'string' ? value.trim().length > 0 :
                    typeof value === 'object' ? Object.keys(value).length > 0 || value.length > 0 :
                    true
                );
                const status = hasValue ? '✅' : '❌';
                console.log(`   ${status} ${field}`);
            });
        }

        console.log('\n' + '='.repeat(80) + '\n');

        return results;
    } catch (error) {
        console.error('❌ Error during test:', error);
        throw error;
    }
}

testDetailedExtraction().catch(console.error);
