const db = require('../config/dbconnection');
const config = require('../config/config');
const axios = require('axios');
const { deductCredits } = require('./credits');
const { getUserApiKey, markKeysInvalid } = require('./byok');

// OpenAI API call helper
const callOpenAI = async (userUuid, messages, model = 'gpt-4o-mini') => {
    const { key, isUserKey } = await getUserApiKey(userUuid, 'openai');

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model,
                messages,
                temperature: 0.7,
                max_tokens: 2000
            },
            {
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return {
            success: true,
            content: response.data.choices[0].message.content,
            usage: response.data.usage
        };

    } catch (error) {
        console.error('OpenAI API error:', error.response?.data || error.message);

        // If user's key failed, mark it invalid
        if (isUserKey && error.response?.status === 401) {
            await markKeysInvalid(userUuid);
        }

        throw new Error(error.response?.data?.error?.message || 'AI service unavailable');
    }
};

// Generate business proposal
const generateProposal = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const {
            leadUuid,
            businessName,
            businessType,
            address,
            website,
            customPrompt,
            templateName,
            senderName,
            senderCompany,
            services
        } = req.body;

        if (!businessName) {
            return res.status(400).json({
                success: false,
                message: 'Business name is required'
            });
        }

        // Deduct credits (unless using own keys)
        const creditResult = await deductCredits(userUuid, 'ai_proposal');
        if (!creditResult.success) {
            return res.status(403).json({
                success: false,
                message: creditResult.error,
                creditsRequired: creditResult.creditsRequired,
                currentBalance: creditResult.currentBalance
            });
        }

        // Build the prompt
        const systemPrompt = `You are a professional business proposal writer. Create compelling, personalized business proposals that help close deals. Focus on value proposition and benefits for the client.`;

        const userPrompt = customPrompt || `Create a professional business proposal for the following business:

Business Name: ${businessName}
Business Type: ${businessType || 'Not specified'}
Location: ${address || 'Not specified'}
Website: ${website || 'Not specified'}

${senderName ? `Proposal from: ${senderName}` : ''}
${senderCompany ? `Company: ${senderCompany}` : ''}
${services ? `Services to offer: ${services}` : ''}

Please create a professional proposal with the following sections:
1. Executive Summary
2. Understanding of Their Business
3. Proposed Solutions
4. Benefits & Value Proposition
5. Pricing Options (leave placeholders)
6. Next Steps
7. Call to Action

Make it personalized and compelling.`;

        const aiResponse = await callOpenAI(userUuid, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]);

        // Save the document
        const docResult = await db.query(`
            INSERT INTO ai_documents (
                user_uuid, lead_uuid, document_type, title, content,
                prompt_used, lead_context, template_name
            )
            VALUES ($1, $2, 'proposal', $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            userUuid,
            leadUuid || null,
            `Business Proposal - ${businessName}`,
            aiResponse.content,
            userPrompt,
            JSON.stringify({ businessName, businessType, address, website, services }),
            templateName || null
        ]);

        res.json({
            success: true,
            message: 'Proposal generated successfully',
            data: {
                document: docResult.rows[0],
                creditsUsed: creditResult.creditsDeducted,
                newBalance: creditResult.newBalance
            }
        });

    } catch (error) {
        console.error('Generate proposal error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate proposal'
        });
    }
};

// Generate email
const generateEmail = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const {
            leadUuid,
            businessName,
            contactName,
            emailType, // 'introduction', 'follow_up', 'meeting_request', 'custom'
            customPrompt,
            previousContext,
            senderName,
            senderCompany,
            subject
        } = req.body;

        if (!businessName) {
            return res.status(400).json({
                success: false,
                message: 'Business name is required'
            });
        }

        // Deduct credits
        const actionType = emailType === 'follow_up' ? 'ai_follow_up' : 'ai_email';
        const creditResult = await deductCredits(userUuid, actionType);
        if (!creditResult.success) {
            return res.status(403).json({
                success: false,
                message: creditResult.error,
                creditsRequired: creditResult.creditsRequired,
                currentBalance: creditResult.currentBalance
            });
        }

        // Build email prompt based on type
        let emailPrompt = '';
        switch (emailType) {
            case 'introduction':
                emailPrompt = `Write a professional introduction email to ${businessName}${contactName ? ` (Contact: ${contactName})` : ''}.
The email should:
- Introduce ${senderName || 'myself'} and ${senderCompany || 'our company'}
- Express interest in potential collaboration
- Be concise and professional
- Include a clear call to action`;
                break;

            case 'follow_up':
                emailPrompt = `Write a professional follow-up email to ${businessName}${contactName ? ` (Contact: ${contactName})` : ''}.
${previousContext ? `Previous context: ${previousContext}` : ''}
The email should:
- Reference previous communication
- Gently remind of pending items
- Be polite and professional
- Include a call to action`;
                break;

            case 'meeting_request':
                emailPrompt = `Write a professional meeting request email to ${businessName}${contactName ? ` (Contact: ${contactName})` : ''}.
The email should:
- Clearly state the purpose of the meeting
- Suggest a few time options
- Be respectful of their time
- Include a clear call to action`;
                break;

            default:
                emailPrompt = customPrompt || `Write a professional email to ${businessName}`;
        }

        const systemPrompt = `You are an expert email copywriter. Write professional, engaging emails that get responses. Keep emails concise and actionable. Always include a clear subject line at the start.`;

        const aiResponse = await callOpenAI(userUuid, [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: emailPrompt }
        ]);

        // Parse subject from response if not provided
        let finalSubject = subject;
        let emailContent = aiResponse.content;

        if (!finalSubject) {
            const subjectMatch = aiResponse.content.match(/Subject:\s*(.+?)(?:\n|$)/i);
            if (subjectMatch) {
                finalSubject = subjectMatch[1].trim();
                emailContent = aiResponse.content.replace(/Subject:\s*.+?\n/i, '').trim();
            } else {
                finalSubject = `Email to ${businessName}`;
            }
        }

        // Save the document
        const docResult = await db.query(`
            INSERT INTO ai_documents (
                user_uuid, lead_uuid, document_type, title, content,
                prompt_used, lead_context, metadata
            )
            VALUES ($1, $2, 'email', $3, $4, $5, $6, $7)
            RETURNING *
        `, [
            userUuid,
            leadUuid || null,
            finalSubject,
            emailContent,
            emailPrompt,
            JSON.stringify({ businessName, contactName, emailType }),
            JSON.stringify({ subject: finalSubject, emailType })
        ]);

        res.json({
            success: true,
            message: 'Email generated successfully',
            data: {
                document: docResult.rows[0],
                subject: finalSubject,
                creditsUsed: creditResult.creditsDeducted,
                newBalance: creditResult.newBalance
            }
        });

    } catch (error) {
        console.error('Generate email error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate email'
        });
    }
};

// Generate content with custom prompt
const generateCustomContent = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { leadUuid, prompt, contentType, title } = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                message: 'Prompt is required'
            });
        }

        // Deduct credits (use email rate for custom)
        const creditResult = await deductCredits(userUuid, 'ai_email');
        if (!creditResult.success) {
            return res.status(403).json({
                success: false,
                message: creditResult.error
            });
        }

        const aiResponse = await callOpenAI(userUuid, [
            { role: 'system', content: 'You are a helpful AI assistant specialized in business communication and content creation.' },
            { role: 'user', content: prompt }
        ]);

        // Save the document
        const docResult = await db.query(`
            INSERT INTO ai_documents (
                user_uuid, lead_uuid, document_type, title, content, prompt_used
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            userUuid,
            leadUuid || null,
            contentType || 'custom',
            title || 'AI Generated Content',
            aiResponse.content,
            prompt
        ]);

        res.json({
            success: true,
            data: {
                document: docResult.rows[0],
                creditsUsed: creditResult.creditsDeducted,
                newBalance: creditResult.newBalance
            }
        });

    } catch (error) {
        console.error('Generate custom content error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate content'
        });
    }
};

// Get user's AI documents
const getDocuments = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const { documentType, leadUuid, status } = req.query;

        let query = `
            SELECT
                d.*,
                l.business_name as lead_business_name
            FROM ai_documents d
            LEFT JOIN saved_leads l ON d.lead_uuid = l.uuid
            WHERE d.user_uuid = $1
        `;
        const params = [userUuid];

        if (documentType) {
            params.push(documentType);
            query += ` AND d.document_type = $${params.length}`;
        }

        if (leadUuid) {
            params.push(leadUuid);
            query += ` AND d.lead_uuid = $${params.length}`;
        }

        if (status) {
            params.push(status);
            query += ` AND d.status = $${params.length}`;
        }

        query += ` ORDER BY d.created_at DESC`;
        query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        const countResult = await db.query(
            'SELECT COUNT(*) FROM ai_documents WHERE user_uuid = $1',
            [userUuid]
        );

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                total: parseInt(countResult.rows[0].count),
                totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
            }
        });

    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch documents'
        });
    }
};

// Get single document
const getDocument = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { documentUuid } = req.params;

        const result = await db.query(`
            SELECT
                d.*,
                l.business_name as lead_business_name,
                l.address as lead_address,
                l.phone as lead_phone,
                l.email as lead_email
            FROM ai_documents d
            LEFT JOIN saved_leads l ON d.lead_uuid = l.uuid
            WHERE d.uuid = $1 AND d.user_uuid = $2
        `, [documentUuid, userUuid]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Get document error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch document'
        });
    }
};

// Update document
const updateDocument = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { documentUuid } = req.params;
        const { title, content, status } = req.body;

        const result = await db.query(`
            UPDATE ai_documents
            SET
                title = COALESCE($3, title),
                content = COALESCE($4, content),
                status = COALESCE($5, status),
                updated_at = NOW()
            WHERE uuid = $1 AND user_uuid = $2
            RETURNING *
        `, [documentUuid, userUuid, title, content, status]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        res.json({
            success: true,
            message: 'Document updated successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Update document error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update document'
        });
    }
};

// Delete document
const deleteDocument = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { documentUuid } = req.params;

        const result = await db.query(`
            DELETE FROM ai_documents
            WHERE uuid = $1 AND user_uuid = $2
            RETURNING *
        `, [documentUuid, userUuid]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        res.json({
            success: true,
            message: 'Document deleted successfully'
        });

    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete document'
        });
    }
};

// Get templates
const getTemplates = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { templateType } = req.query;

        let query = `
            SELECT * FROM templates
            WHERE (user_uuid = $1 OR is_system = true) AND is_active = true
        `;
        const params = [userUuid];

        if (templateType) {
            params.push(templateType);
            query += ` AND template_type = $${params.length}`;
        }

        query += ` ORDER BY is_system DESC, usage_count DESC`;

        const result = await db.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch templates'
        });
    }
};

// Create custom template
const createTemplate = async (req, res) => {
    try {
        const userUuid = req.user.uuid;
        const { templateType, name, subject, content, variables } = req.body;

        if (!name || !content || !templateType) {
            return res.status(400).json({
                success: false,
                message: 'Template type, name, and content are required'
            });
        }

        const result = await db.query(`
            INSERT INTO templates (user_uuid, template_type, name, subject, content, variables)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [userUuid, templateType, name, subject, content, variables ? JSON.stringify(variables) : null]);

        res.status(201).json({
            success: true,
            message: 'Template created successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create template'
        });
    }
};

module.exports = {
    generateProposal,
    generateEmail,
    generateCustomContent,
    getDocuments,
    getDocument,
    updateDocument,
    deleteDocument,
    getTemplates,
    createTemplate
};
