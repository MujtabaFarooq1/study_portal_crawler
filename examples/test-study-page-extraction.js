/**
 * Test study page extraction with provided selectors
 */
import { chromium } from 'playwright';
import fs from 'fs';

async function extractStudyPageData(page) {
    // Wait for the main hero section to be loaded
    await page.waitForSelector('#Hero', { timeout: 10000 });
    await page.waitForSelector('#QuickFacts', { timeout: 10000 });

    // Give extra time for dynamic content
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
        const result = {};

        // Main Hero Section
        const mainHeroSection = document.querySelector('#Hero');
        if (mainHeroSection) {
            const studyTitleWrapper = mainHeroSection.querySelector('.StudyTitleWrapper');

            if (studyTitleWrapper) {
                // University Name
                const universityNameEl = studyTitleWrapper.querySelector('.OrganisationName');
                result.universityName = universityNameEl ? universityNameEl.textContent.trim() : null;

                // Course Name
                const courseNameEl = studyTitleWrapper.querySelector('.StudyTitle');
                result.courseName = courseNameEl ? courseNameEl.innerText.trim() : null;

                // University Website Link
                const websiteLinkEl = studyTitleWrapper.querySelector('.StudyTitle .ProgrammeWebsiteLink');
                result.universityWebsiteLink = websiteLinkEl ? websiteLinkEl.href.trim() : null;
            }
        }

        // Degree Type and Study Mode
        const tags = document.querySelectorAll('.DegreeTags .Tag');

        let degreeType = null;
        let studyMode = null;

        tags.forEach(tag => {
            const text = tag.textContent.trim();

            // Detect degree type (e.g. M.Sc., M.A., MBA, etc.)
            if (/\.|Bachelor|Master|PhD/i.test(text)) {
                degreeType = text;
            }

            // Detect study mode
            if (/campus|online|distance|blended/i.test(text)) {
                studyMode = text;
            }
        });

        result.degreeType = degreeType;
        result.studyMode = studyMode;

        // Quick Facts Section - Tuition Fee
        const tuitionFeeEl = document.querySelector(
            '.TuitionFeeContainer[data-target="international"] .Title'
        );
        const tuitionCurrencyEl = document.querySelector(
            '.TuitionFeeContainer[data-target="international"] .CurrencyType'
        );
        const tuitionUnitEl = document.querySelector(
            '.TuitionFeeContainer[data-target="international"] .Unit'
        );

        result.tuitionFee = tuitionFeeEl && tuitionCurrencyEl && tuitionUnitEl
            ? `${tuitionFeeEl.textContent.trim()} ${tuitionCurrencyEl.textContent.trim()} ${tuitionUnitEl.textContent.trim()}`
            : null;

        // Duration
        const durationEl = document.querySelector('.js-duration');
        result.duration = durationEl ? durationEl.textContent.trim() : null;

        // Start dates (can be multiple)
        const startDateEls = document.querySelectorAll(
            '.QuickFactComponent .Label i.lnr-calendar-full'
        )[0]?.closest('.QuickFactComponent')
            ?.querySelectorAll('time');

        result.startDates = startDateEls
            ? Array.from(startDateEls).map(t => t.textContent.trim())
            : [];

        // English Tests - use Set to avoid duplicates
        const testsMap = new Map();
        const testCards = document.querySelectorAll(
            '#EnglishRequirements .CardContents.EnglishCardContents'
        );

        testCards.forEach(card => {
            const nameEl = card.querySelector('.Heading');
            const scoreEl = card.querySelector('.Score span');

            if (!nameEl) return;

            const name = nameEl.textContent.replace(/\s+/g, ' ').trim();

            let score = null;
            if (scoreEl) {
                score = scoreEl.textContent
                    .replace(/\s+/g, ' ')
                    .trim()
                    .replace(/[^0-9.]/g, '') || null;
            }

            // Only add if we haven't seen this test name yet
            if (!testsMap.has(name)) {
                testsMap.set(name, { name, score });
            }
        });

        result.englishTests = Array.from(testsMap.values());

        // General Requirements
        const generalReqContainer = document.querySelector(
            '#OtherRequirements h3 + ul'
        );

        let generalRequirements = '';

        if (generalReqContainer) {
            generalRequirements = Array.from(
                generalReqContainer.querySelectorAll('li')
            )
                .map(li => li.textContent.trim())
                .join(' ');
        }

        result.generalRequirements = generalRequirements || null;

        return result;
    });

    return data;
}

async function testStudyPage() {
    console.log('Starting browser...');
    const browser = await chromium.launch({
        headless: false  // Show browser for debugging
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    try {
        // Navigate to study page
        const studyUrl = 'https://www.mastersportal.com/studies/466158/business-analytics.html';
        console.log(`Loading page: ${studyUrl}`);

        await page.goto(studyUrl, {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        console.log('Page loaded, extracting data...');

        // Extract data using the provided selectors
        const extractedData = await extractStudyPageData(page);

        console.log('\n========================================');
        console.log('EXTRACTED DATA:');
        console.log('========================================');
        console.log(JSON.stringify(extractedData, null, 2));

        // Save to JSON file
        const outputFile = 'study-page-extracted-data.json';
        fs.writeFileSync(outputFile, JSON.stringify(extractedData, null, 2));
        console.log(`\nData saved to: ${outputFile}`);

        // Also take a screenshot for reference
        await page.screenshot({
            path: 'study-page-extraction-screenshot.png',
            fullPage: true
        });
        console.log('Screenshot saved to: study-page-extraction-screenshot.png');

    } catch (error) {
        console.error('Error extracting data:', error);
        console.error(error.stack);
    } finally {
        await browser.close();
    }
}

testStudyPage();
