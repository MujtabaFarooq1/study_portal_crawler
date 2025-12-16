/**
 * Capture screenshot of a study page for debugging
 */
import { chromium } from 'playwright';

async function captureStudyPage() {
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

        // Wait a bit for dynamic content
        console.log('Waiting for content to load...');
        await page.waitForTimeout(3000);

        // Take screenshot
        const screenshotPath = 'study-page-debug-screenshot.png';
        await page.screenshot({
            path: screenshotPath,
            fullPage: true
        });
        console.log(`Screenshot saved to: ${screenshotPath}`);

        // Also save HTML for reference
        const htmlPath = 'study-page-debug-html.html';
        const html = await page.content();
        const fs = await import('fs');
        fs.writeFileSync(htmlPath, html);
        console.log(`HTML saved to: ${htmlPath}`);

    } catch (error) {
        console.error('Error capturing page:', error);
    } finally {
        await browser.close();
    }
}

captureStudyPage();
