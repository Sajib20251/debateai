// Netlify function to proxy Groq API calls
// This helps to keep the API key secure on the server-side.

const fetch = require('node-fetch'); // node-fetch is available in Netlify functions environment

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    const { model, prompt, systemMessage } = JSON.parse(event.body);
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        console.error('GROQ_API_KEY environment variable not set.');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API key not configured.' }),
        };
    }

    if (!model || !prompt) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing model or prompt in request body.' }),
        };
    }

    try {
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: systemMessage || "আপনি একজন সহায়ক সহকারী যিনি বিতর্কে অংশ নিচ্ছেন।" },
                    { role: "user", content: prompt }
                ],
                model: model,
                temperature: 0.7,
                max_tokens: 1024,
                top_p: 1,
                stream: false
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Groq API error: ${response.status} ${errorBody}`);
            
            let clientErrorMessage = `Error calling LLM: ${response.status}`;
            if (response.status === 401) clientErrorMessage = "API key invalid or quota exceeded.";
            if (response.status === 429) clientErrorMessage = "Rate limit exceeded or quota finished.";
            if (response.status === 400) clientErrorMessage = "Bad request - check model name or parameters.";
            if (response.status === 503) {
                 clientErrorMessage = "এই মুহূর্তে নির্বাচিত মডেলটি উপলব্ধ নেই। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন অথবা অন্য মডেল নির্বাচন করুন।";
            }

            return {
                statusCode: response.status,
                body: JSON.stringify({ error: clientErrorMessage, details: errorBody }),
            };
        }

        const data = await response.json();
        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error('Error in Netlify function calling Groq:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to fetch from Groq via proxy.', details: error.message }),
        };
    }
};
