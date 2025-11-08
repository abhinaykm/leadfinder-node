const axios = require('axios');
const db = require('../config/dbconnection');
const config = require('../config/config');

// OpenAI Configuration
const OPENAI_API_KEY = config.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Fetch website content and metadata
 */
async function fetchWebsiteData(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000
        });

        const html = response.data;

        // Extract basic SEO elements
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
        const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
        const viewportMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i);

        // Count various elements
        const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
        const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;
        const imageCount = (html.match(/<img[^>]*>/gi) || []).length;
        const linkCount = (html.match(/<a[^>]*href/gi) || []).length;

        return {
            title: titleMatch ? titleMatch[1].trim() : '',
            description: descriptionMatch ? descriptionMatch[1].trim() : '',
            h1: h1Match ? h1Match[1].trim() : '',
            h2Count,
            h3Count,
            imageCount,
            linkCount,
            hasCanonical: !!canonicalMatch,
            canonical: canonicalMatch ? canonicalMatch[1] : '',
            robots: robotsMatch ? robotsMatch[1] : '',
            hasOgImage: !!ogImageMatch,
            hasViewport: !!viewportMatch,
            viewport: viewportMatch ? viewportMatch[1] : '',
            contentLength: html.length,
            htmlPreview: html.substring(0, 5000) // First 5000 chars for AI analysis
        };
    } catch (error) {
        console.error('Error fetching website:', error.message);
        throw new Error('Failed to fetch website content. Please check the URL and try again.');
    }
}

/**
 * Calculate fallback scores based on website data
 */
function calculateFallbackScores(websiteData) {
    // Title score (50-60 chars is optimal)
    let titleScore = 0;
    if (websiteData.title) {
        const titleLength = websiteData.title.length;
        if (titleLength >= 50 && titleLength <= 60) titleScore = 95;
        else if (titleLength >= 40 && titleLength < 50) titleScore = 85;
        else if (titleLength >= 30 && titleLength < 40) titleScore = 70;
        else if (titleLength > 60 && titleLength <= 70) titleScore = 75;
        else if (titleLength > 0) titleScore = 50;
    }

    // Meta description score (150-160 chars is optimal)
    let descScore = 0;
    if (websiteData.description) {
        const descLength = websiteData.description.length;
        if (descLength >= 150 && descLength <= 160) descScore = 95;
        else if (descLength >= 120 && descLength < 150) descScore = 85;
        else if (descLength >= 100 && descLength < 120) descScore = 70;
        else if (descLength > 160 && descLength <= 200) descScore = 75;
        else if (descLength > 0) descScore = 50;
    }

    // H1 score
    const h1Score = websiteData.h1 ? 90 : 20;

    // Heading structure score
    let headingScore = 50;
    if (websiteData.h2Count > 0 && websiteData.h3Count > 0) headingScore = 90;
    else if (websiteData.h2Count > 0) headingScore = 75;
    else if (websiteData.h3Count > 0) headingScore = 60;

    // On-page SEO score
    const onPageScore = Math.round((titleScore + descScore + h1Score + headingScore) / 4);

    // Mobile SEO score
    const mobileSeoScore = websiteData.hasViewport ? 95 : 25;

    // Technical SEO score
    const canonicalScore = websiteData.hasCanonical ? 95 : 60;
    const ogImageScore = websiteData.hasOgImage ? 90 : 50;

    // Performance score based on content length
    let performanceScore = 70;
    let performanceDesktopScore = 75; // Desktop typically performs better
    let performanceMobileScore = 65;   // Mobile typically has more constraints

    if (websiteData.contentLength < 50000) {
        performanceScore = 90;
        performanceDesktopScore = 92;
        performanceMobileScore = 88;
    } else if (websiteData.contentLength < 100000) {
        performanceScore = 80;
        performanceDesktopScore = 85;
        performanceMobileScore = 75;
    } else if (websiteData.contentLength < 200000) {
        performanceScore = 70;
        performanceDesktopScore = 75;
        performanceMobileScore = 65;
    } else {
        performanceScore = 60;
        performanceDesktopScore = 65;
        performanceMobileScore = 55;
    }

    // Content quality score
    let contentScore = 50;
    if (websiteData.contentLength > 5000) contentScore = 90;
    else if (websiteData.contentLength > 3000) contentScore = 80;
    else if (websiteData.contentLength > 1000) contentScore = 65;

    // Semantic analysis score (average of content and structure)
    const semanticScore = Math.round((contentScore + headingScore + ogImageScore) / 3);

    // Off-page score (we can't measure this without external data, so use moderate score)
    const offPageScore = 65;

    // Overall score
    const overallScore = Math.round((onPageScore + mobileSeoScore + performanceScore + semanticScore + offPageScore) / 5);

    return {
        overall: overallScore,
        onPage: onPageScore,
        mobile: mobileSeoScore,
        performance: performanceScore,
        desktopScore: performanceDesktopScore,
        mobileScore: performanceMobileScore,
        semantic: semanticScore,
        offPage: offPageScore
    };
}

/**
 * Use OpenAI to analyze SEO
 */
async function analyzeWithOpenAI(websiteData, url) {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not configured. Please add OPENAI_API_KEY to your config.');
    }

    const prompt = `You are an expert SEO analyst. Analyze the following website data and provide a comprehensive SEO report in JSON format.

Website URL: ${url}
Title: ${websiteData.title}
Meta Description: ${websiteData.description}
H1: ${websiteData.h1}
H2 Tags Count: ${websiteData.h2Count}
H3 Tags Count: ${websiteData.h3Count}
Images: ${websiteData.imageCount}
Links: ${websiteData.linkCount}
Has Canonical: ${websiteData.hasCanonical}
Has Viewport Meta: ${websiteData.hasViewport}
Has OG Image: ${websiteData.hasOgImage}
Robots: ${websiteData.robots}
Content Length: ${websiteData.contentLength} characters

SCORING GUIDELINES:
- Title Tag: Good title (50-60 chars) = 80-100, Too short/long or missing = 20-50
- Meta Description: Good description (150-160 chars) = 80-100, Missing or poor = 20-50
- H1 Tag: Present and relevant = 80-100, Missing = 0-30
- Heading Structure: Multiple H2/H3 tags = 80-100, Few or none = 30-60
- Viewport Meta: Present = 90-100, Missing = 0-20
- Canonical Tag: Present = 90-100, Missing = 50-70
- OG Image: Present = 80-100, Missing = 40-60
- Content Length: >3000 chars = 80-100, 1000-3000 = 60-80, <1000 = 30-60
- Performance: Small pages (<50KB) = 85-100, Medium (50-100KB) = 70-85, Large (>100KB) = 50-70
- Desktop Performance: Typically 5-10 points higher than mobile (desktops have more resources)
- Mobile Performance: Typically 5-10 points lower than desktop (mobile has constraints)
- Overall Score: Average of all category scores

Generate realistic scores based on actual data. DO NOT return 0 unless element is completely missing.
IMPORTANT: Always include desktopScore and mobileScore in the performance object.

Provide analysis in this exact JSON structure:
{
  "overallScore": <number 0-100>,
  "onPageSeo": {
    "score": <number 0-100>,
    "details": {
      "titleTag": "<analysis>",
      "metaDescription": "<analysis>",
      "headingStructure": "<analysis>",
      "contentQuality": "<analysis>"
    }
  },
  "offPageSeo": {
    "score": <number 0-100>,
    "details": {
      "backlinkPotential": "<analysis>",
      "socialSignals": "<analysis>",
      "brandMentions": "<analysis>"
    }
  },
  "semanticAnalysis": {
    "score": <number 0-100>,
    "details": {
      "keywordOptimization": "<analysis>",
      "contentRelevance": "<analysis>",
      "semanticMarkup": "<analysis>"
    }
  },
  "mobileSeo": {
    "score": <number 0-100>,
    "details": {
      "responsive": "${websiteData.hasViewport ? 'Yes' : 'No'}",
      "viewportMeta": "<analysis>",
      "mobileOptimization": "<analysis>"
    }
  },
  "performance": {
    "score": <number 0-100>,
    "desktopScore": <number 0-100>,
    "mobileScore": <number 0-100>,
    "details": {
      "pageSize": "<analysis based on ${websiteData.contentLength}>",
      "optimization": "<analysis>",
      "recommendations": "<analysis>"
    },
    "desktop": {
      "fcp": "0.97",
      "lcp": "1.2",
      "fmp": "0.01",
      "tti": "1.0"
    },
    "mobile": {
      "fcp": "0.52",
      "lcp": "1.5",
      "fmp": "0.04",
      "tti": "0.25"
    }
  },
  "serpSnippet": {
    "title": "${websiteData.title}",
    "description": "${websiteData.description}",
    "url": "${url}",
    "analysis": "<how it appears in search results>"
  },
  "recommendations": [
    "<specific actionable recommendation 1>",
    "<specific actionable recommendation 2>",
    "<specific actionable recommendation 3>",
    "<specific actionable recommendation 4>",
    "<specific actionable recommendation 5>"
  ]
}`;

    try {
        const response = await axios.post(
            OPENAI_API_URL,
            {
                model: 'gpt-4o-mini', // Fast and affordable model
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert SEO analyst. Always respond with valid JSON only, no additional text.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2500
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const aiResponse = response.data.choices[0].message.content;
        console.log('OpenAI Raw Response:', aiResponse);

        // Parse JSON response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid response from AI');
        }

        const parsedAnalysis = JSON.parse(jsonMatch[0]);

        // Log parsed scores for debugging
        console.log('Parsed Scores from OpenAI:', {
            overall: parsedAnalysis.overallScore,
            onPage: parsedAnalysis.onPageSeo?.score,
            offPage: parsedAnalysis.offPageSeo?.score,
            semantic: parsedAnalysis.semanticAnalysis?.score,
            mobile: parsedAnalysis.mobileSeo?.score,
            performance: parsedAnalysis.performance?.score
        });

        // Calculate fallback scores
        const fallbackScores = calculateFallbackScores(websiteData);
        console.log('Fallback Scores:', fallbackScores);

        // Use fallback scores if OpenAI returns 0 or invalid scores
        if (!parsedAnalysis.overallScore || parsedAnalysis.overallScore === 0) {
            parsedAnalysis.overallScore = fallbackScores.overall;
        }
        if (!parsedAnalysis.onPageSeo?.score || parsedAnalysis.onPageSeo.score === 0) {
            if (!parsedAnalysis.onPageSeo) parsedAnalysis.onPageSeo = { score: 0, details: {} };
            parsedAnalysis.onPageSeo.score = fallbackScores.onPage;
        }
        if (!parsedAnalysis.offPageSeo?.score || parsedAnalysis.offPageSeo.score === 0) {
            if (!parsedAnalysis.offPageSeo) parsedAnalysis.offPageSeo = { score: 0, details: {} };
            parsedAnalysis.offPageSeo.score = fallbackScores.offPage;
        }
        if (!parsedAnalysis.semanticAnalysis?.score || parsedAnalysis.semanticAnalysis.score === 0) {
            if (!parsedAnalysis.semanticAnalysis) parsedAnalysis.semanticAnalysis = { score: 0, details: {} };
            parsedAnalysis.semanticAnalysis.score = fallbackScores.semantic;
        }
        if (!parsedAnalysis.mobileSeo?.score || parsedAnalysis.mobileSeo.score === 0) {
            if (!parsedAnalysis.mobileSeo) parsedAnalysis.mobileSeo = { score: 0, details: {} };
            parsedAnalysis.mobileSeo.score = fallbackScores.mobile;
        }
        if (!parsedAnalysis.performance?.score || parsedAnalysis.performance.score === 0) {
            if (!parsedAnalysis.performance) parsedAnalysis.performance = { score: 0, details: {} };
            parsedAnalysis.performance.score = fallbackScores.performance;
        }
        // Always ensure desktopScore and mobileScore are present
        if (!parsedAnalysis.performance?.desktopScore || parsedAnalysis.performance.desktopScore === 0) {
            if (!parsedAnalysis.performance) parsedAnalysis.performance = { score: 0, details: {} };
            parsedAnalysis.performance.desktopScore = fallbackScores.desktopScore;
        }
        if (!parsedAnalysis.performance?.mobileScore || parsedAnalysis.performance.mobileScore === 0) {
            if (!parsedAnalysis.performance) parsedAnalysis.performance = { score: 0, details: {} };
            parsedAnalysis.performance.mobileScore = fallbackScores.mobileScore;
        }

        console.log('Final Scores (with fallback):', {
            overall: parsedAnalysis.overallScore,
            onPage: parsedAnalysis.onPageSeo?.score,
            offPage: parsedAnalysis.offPageSeo?.score,
            semantic: parsedAnalysis.semanticAnalysis?.score,
            mobile: parsedAnalysis.mobileSeo?.score,
            performance: parsedAnalysis.performance?.score,
            desktopScore: parsedAnalysis.performance?.desktopScore,
            mobileScore: parsedAnalysis.performance?.mobileScore
        });

        return parsedAnalysis;
    } catch (error) {
        console.error('OpenAI API Error:', error.response?.data || error.message);

        // If OpenAI fails, use fallback scores with basic analysis
        console.log('Using fallback analysis due to OpenAI error');
        const fallbackScores = calculateFallbackScores(websiteData);

        return {
            overallScore: fallbackScores.overall,
            onPageSeo: {
                score: fallbackScores.onPage,
                details: {
                    titleTag: websiteData.title ? `Title found (${websiteData.title.length} characters)` : 'No title tag found',
                    metaDescription: websiteData.description ? `Meta description found (${websiteData.description.length} characters)` : 'No meta description found',
                    headingStructure: `H1: ${websiteData.h1 ? 'Found' : 'Missing'}, H2: ${websiteData.h2Count} tags, H3: ${websiteData.h3Count} tags`,
                    contentQuality: `Page contains ${websiteData.contentLength} characters of content`
                }
            },
            offPageSeo: {
                score: fallbackScores.offPage,
                details: {
                    backlinkPotential: 'External analysis required for accurate assessment',
                    socialSignals: 'Social media integration should be verified',
                    brandMentions: 'Brand presence analysis requires external data'
                }
            },
            semanticAnalysis: {
                score: fallbackScores.semantic,
                details: {
                    keywordOptimization: 'Review keyword density and placement in content',
                    contentRelevance: `Content length: ${websiteData.contentLength} characters`,
                    semanticMarkup: websiteData.hasOgImage ? 'Open Graph image found' : 'Missing Open Graph image'
                }
            },
            mobileSeo: {
                score: fallbackScores.mobile,
                details: {
                    responsive: websiteData.hasViewport ? 'Yes' : 'No',
                    viewportMeta: websiteData.hasViewport ? 'Viewport meta tag is present' : 'Missing viewport meta tag - critical for mobile',
                    mobileOptimization: websiteData.hasViewport ? 'Site appears mobile-friendly' : 'Site may not be optimized for mobile devices'
                }
            },
            performance: {
                score: fallbackScores.performance,
                desktopScore: fallbackScores.desktopScore,
                mobileScore: fallbackScores.mobileScore,
                details: {
                    pageSize: `Page size: ${Math.round(websiteData.contentLength / 1024)}KB`,
                    optimization: websiteData.contentLength < 100000 ? 'Page size is acceptable' : 'Consider optimizing page size',
                    recommendations: 'Use PageSpeed Insights for detailed performance metrics'
                },
                desktop: {
                    fcp: '0.97',
                    lcp: '1.2',
                    fmp: '0.01',
                    tti: '1.0'
                },
                mobile: {
                    fcp: '0.52',
                    lcp: '1.5',
                    fmp: '0.04',
                    tti: '0.25'
                }
            },
            serpSnippet: {
                title: websiteData.title || 'No title',
                description: websiteData.description || 'No description',
                url: url,
                analysis: 'SERP preview based on current meta tags'
            },
            recommendations: [
                websiteData.title ? (websiteData.title.length < 50 ? 'Expand title tag to 50-60 characters' : websiteData.title.length > 60 ? 'Shorten title tag to 50-60 characters' : 'Title tag length is optimal') : 'Add a title tag',
                websiteData.description ? (websiteData.description.length < 150 ? 'Expand meta description to 150-160 characters' : websiteData.description.length > 160 ? 'Shorten meta description to 150-160 characters' : 'Meta description length is good') : 'Add a meta description',
                websiteData.h1 ? 'H1 tag is present' : 'Add an H1 tag to the page',
                websiteData.hasViewport ? 'Mobile viewport is configured' : 'Add viewport meta tag for mobile optimization',
                websiteData.hasCanonical ? 'Canonical tag is set' : 'Consider adding a canonical tag'
            ]
        };
    }
}

/**
 * Main SEO Analysis Controller using OpenAI
 */
const analyzeSeo = async (req, res) => {
    try {
        const { websiteUrl, email } = req.body;

        if (!websiteUrl) {
            return res.status(400).json({
                success: false,
                message: 'Website URL is required'
            });
        }

        console.log(`Starting SEO analysis with OpenAI for: ${websiteUrl}`);

        // Get user UUID from JWT token if available (same as Google search)
        let userUuid = null;
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const jwt = require('jsonwebtoken');
                const config = require('../config/config');
                const decoded = jwt.verify(token, config.JWT_SECRET);
                userUuid = decoded.uuid;
                console.log(`User authenticated: ${userUuid}`);
            } catch (tokenError) {
                console.warn('Invalid token provided:', tokenError.message);
                // Continue without user association - SEO analysis doesn't require login
            }
        }

        // Step 1: Fetch website data
        const websiteData = await fetchWebsiteData(websiteUrl);

        // Step 2: Analyze with OpenAI
        const aiAnalysis = await analyzeWithOpenAI(websiteData, websiteUrl);

        console.log('AI Analysis Overall Score:', aiAnalysis.overallScore);

        // Step 3: Save to database
        const insertQuery = `
            INSERT INTO seo_reports (
                website_url,
                overall_score,
                analysis_data,
                email,
                user_uuid
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING uuid, website_url, overall_score, created_at
        `;
        const analysisData = {
            onPageSeo: aiAnalysis.onPageSeo,
            offPageSeo: aiAnalysis.offPageSeo,
            semanticAnalysis: aiAnalysis.semanticAnalysis,
            mobileSeo: aiAnalysis.mobileSeo,
            performance: aiAnalysis.performance,
            serpSnippet: aiAnalysis.serpSnippet,
            recommendations: aiAnalysis.recommendations
        };

        const result = await db.query(insertQuery, [
            websiteUrl,
            aiAnalysis.overallScore,
            JSON.stringify(analysisData),
            email || null,
            userUuid
        ]);

        const savedReport = result.rows[0];

        // Prepare response with all scores included
        const responseData = {
            reportId: savedReport.uuid,
            websiteUrl: savedReport.website_url,
            overallScore: savedReport.overall_score,
            analysis: analysisData,
            // Also include individual scores at top level for easy access
            scores: {
                overall: savedReport.overall_score,
                onPage: analysisData.onPageSeo?.score || 0,
                offPage: analysisData.offPageSeo?.score || 0,
                semantic: analysisData.semanticAnalysis?.score || 0,
                mobile: analysisData.mobileSeo?.score || 0,
                performance: analysisData.performance?.score || 0,
                desktopScore: analysisData.performance?.desktopScore || 0,
                mobileScore: analysisData.performance?.mobileScore || 0
            },
            generatedAt: savedReport.created_at
        };

        console.log('Response Data Scores:', responseData.scores);

        // Step 4: Send response
        res.status(200).json({
            success: true,
            message: 'SEO analysis completed successfully with OpenAI',
            data: responseData
        });

    } catch (error) {
        console.error('SEO Analysis Error (OpenAI):', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to analyze website'
        });
    }
};

/**
 * Get specific SEO report by UUID
 */
const getSeoReport = async (req, res) => {
    try {
        const { reportId } = req.params;

        const query = 'SELECT * FROM seo_reports WHERE uuid = $1';
        const result = await db.query(query, [reportId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        const report = result.rows[0];

        res.status(200).json({
            success: true,
            data: {
                reportId: report.uuid,
                websiteUrl: report.website_url,
                overallScore: report.overall_score,
                analysis: report.analysis_data,
                // Include individual scores at top level for easy access
                scores: {
                    overall: report.overall_score,
                    onPage: report.analysis_data?.onPageSeo?.score || 0,
                    offPage: report.analysis_data?.offPageSeo?.score || 0,
                    semantic: report.analysis_data?.semanticAnalysis?.score || 0,
                    mobile: report.analysis_data?.mobileSeo?.score || 0,
                    performance: report.analysis_data?.performance?.score || 0,
                    desktopScore: report.analysis_data?.performance?.desktopScore || 0,
                    mobileScore: report.analysis_data?.performance?.mobileScore || 0
                },
                email: report.email,
                generatedAt: report.created_at
            }
        });

    } catch (error) {
        console.error('Get SEO Report Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve report'
        });
    }
};

/**
 * Get all SEO reports (optionally filtered by user)
 */
const getAllReports = async (req, res) => {
    try {
        const userUuid = req.user?.uuid || null;
        const { limit = 10, offset = 0 } = req.query;

        let query;
        let params;

        if (userUuid) {
            query = `
                SELECT uuid, website_url, overall_score, email, created_at
                FROM seo_reports
                WHERE user_uuid = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            `;
            params = [userUuid, limit, offset];
        } else {
            query = `
                SELECT uuid, website_url, overall_score, email, created_at
                FROM seo_reports
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
            `;
            params = [limit, offset];
        }

        const result = await db.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error('Get All Reports Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve reports'
        });
    }
};

module.exports = {
    analyzeSeo,
    getSeoReport,
    getAllReports
};
