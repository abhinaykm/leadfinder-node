const puppeteer = require('puppeteer');

/**
 * Capture website screenshot
 */
async function captureScreenshot(req, res) {
    try {
        const { url, width = 1280, height = 720, device = 'desktop' } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL parameter is required'
            });
        }

        // Decode URL
        const websiteUrl = decodeURIComponent(url);

        console.log(`Capturing screenshot for: ${websiteUrl} (${device} - ${width}x${height})`);

        // Launch browser
        const browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        // Set viewport
        await page.setViewport({
            width: parseInt(width),
            height: parseInt(height),
            deviceScaleFactor: device === 'mobile' ? 2 : 1
        });

        // Set user agent
        if (device === 'mobile') {
            await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');
        }

        // Navigate to URL with timeout
        await page.goto(websiteUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait a bit for dynamic content
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Take screenshot
        const screenshot = await page.screenshot({
            type: 'jpeg',
            quality: 80,
            fullPage: false
        });

        await browser.close();

        // Set response headers
        res.set({
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'Access-Control-Allow-Origin': '*'
        });

        // Send screenshot
        res.send(screenshot);

    } catch (error) {
        console.error('Screenshot error:', error.message);

        // Send placeholder/error image
        res.status(500).json({
            success: false,
            message: 'Failed to capture screenshot: ' + error.message
        });
    }
}

module.exports = {
    captureScreenshot
};
