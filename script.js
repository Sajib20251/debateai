// Global variable to store GROQ_API_KEY
// IMPORTANT: This is not secure for a production client-side application.
// For Netlify deployment, this should be handled via Netlify Functions and environment variables.
        // The GROQ_API_KEY would be stored as an environment variable in Netlify,
        // and a Netlify Function would make the call to the Groq API,
        // preventing the key from being exposed client-side.
let GROQ_API_KEY = ''; // Temporary for local testing.

document.addEventListener('DOMContentLoaded', () => {
    console.log("AI Debate Engine script loaded.");

    // Get DOM elements
    const debateTopicInput = document.getElementById('debate-topic');
    const agreeModelSelect = document.getElementById('agree-model');
    const disagreeModelSelect = document.getElementById('disagree-model');
    const judgeModelSelect = document.getElementById('judge-model');
    const startDebateBtn = document.getElementById('start-debate-btn');
    const transcriptArea = document.getElementById('transcript-area');
    const verdictArea = document.getElementById('verdict-area');

    // Event listener for the start debate button
    startDebateBtn.addEventListener('click', startDebate);

    // Function to display content in the transcript area
    function appendToTranscript(phaseTitle, speaker, text) {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');
        phaseDiv.innerHTML = `<h3 class="phase-title">${phaseTitle} - ${speaker}</h3><p class="speaker-argument">${text}</p>`;
        transcriptArea.appendChild(phaseDiv);
        transcriptArea.scrollTop = transcriptArea.scrollHeight; // Scroll to bottom
    }

    // Function to display content in the verdict area
    function displayVerdict(judgeName, verdictText) {
        verdictArea.innerHTML = `<h3 class="phase-title">বিচারকের রায় (${judgeName})</h3><p class="judge-verdict">${verdictText}</p>`;
        verdictArea.scrollTop = verdictArea.scrollHeight; // Scroll to bottom
    }
    
    // Function to clear previous debate content
    function clearDebateArea() {
        transcriptArea.innerHTML = '';
        verdictArea.innerHTML = '';
    }

    // Groq API call function
    async function callGroqAPI(model, prompt, systemMessage = "আপনি একজন সহায়ক সহকারী যিনি বিতর্কে অংশ নিচ্ছেন।") { // Default system message in Bengali
        if (!GROQ_API_KEY) {
            // Attempt to get API key from a more persistent local storage or prompt if not found
            let storedApiKey = localStorage.getItem('GROQ_API_KEY_DEBATE_APP');
            if (storedApiKey) {
                GROQ_API_KEY = storedApiKey;
                console.log("Retrieved Groq API Key from localStorage.");
            } else {
                const apiKeyInput = prompt("অনুগ্রহ করে আপনার Groq API কী প্রবেশ করান (এটি আপনার ব্রাউজারে লোকাল স্টোরেজে সেভ করা হবে):", "");
                if (apiKeyInput && apiKeyInput.trim() !== '') {
                    GROQ_API_KEY = apiKeyInput.trim();
                    try {
                        localStorage.setItem('GROQ_API_KEY_DEBATE_APP', GROQ_API_KEY);
                        console.log("Saved Groq API Key to localStorage.");
                    } catch (e) {
                        console.warn("Could not save API key to local storage.", e);
                        alert("API কী লোকাল স্টোরেজে সেভ করা যায়নি। আপনাকে প্রতিবার এটি প্রবেশ করাতে হতে পারে।");
                    }
                } else {
                    alert("Groq API কী ছাড়া ডিবেট চালানো সম্ভব নয়।");
                    startDebateBtn.disabled = false; // Re-enable button
                    startDebateBtn.textContent = "বিতর্ক শুরু করুন";
                    throw new Error("Groq API key is missing.");
                }
            }
        }

        const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
        
        console.log(`Calling Groq API. Model: ${model}. Prompt length: ${prompt.length}.`);
        // Avoid logging potentially very long prompts (like full transcripts for the judge)
        // console.log(`Prompt starts with: ${prompt.substring(0, 200)}...`);


        // !! IMPORTANT FOR NETLIFY DEPLOYMENT !!
        // In a production Netlify setup, this direct fetch call should ideally be replaced
        // by a call to a Netlify Function. This is crucial for security.
        // Example client-side call:
        //
        // const response = await fetch('/.netlify/functions/groq-proxy', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ model, promptMessages: [{role: "system", content: systemMessage}, {role: "user", content: prompt}] })
        // });
        //
        // The Netlify Function (e.g., /netlify/functions/groq-proxy.js) would then:
        // 1. Retrieve the GROQ_API_KEY from Netlify's environment variables.
        // 2. Make the actual 'fetch' call to the Groq API (API_URL defined above)
        //    using the API key and the payload received from the client.
        // 3. Return the Groq API's response (or an error) to the client.
        // This architecture prevents exposing the GROQ_API_KEY in the client-side code.

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: "system",
                            content: systemMessage
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    model: model,
                    temperature: 0.7, // Adjust as needed
                    max_tokens: 1024,  // Adjust as needed
                    top_p: 1,
                    stream: false
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Groq API Error:', errorData);
                throw new Error(`API request failed with status ${response.status}: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            console.log('Groq API Response:', data);
            if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                return data.choices[0].message.content.trim();
            } else {
                throw new Error("Unexpected API response structure from Groq.");
            }
        } catch (error) {
            console.error('Error calling Groq API:', error);
            appendToTranscript("ত্রুটি", "সিস্টেম", `API কল করতে সমস্যা হয়েছে: ${error.message}`);
            throw error; // Re-throw the error to stop the debate flow if critical
        }
    }


    // Main function to start and manage the debate
    async function startDebate() {
        clearDebateArea(); // Clear previous debate content

        const topic = debateTopicInput.value;
        const agreeModel = agreeModelSelect.value;
        const disagreeModel = disagreeModelSelect.value;
        const judgeModel = judgeModelSelect.value;

        if (!topic.trim()) {
            alert("অনুগ্রহ করে বিতর্কের বিষয় লিখুন।");
            return;
        }
        
        // Disable button to prevent multiple clicks
        startDebateBtn.disabled = true;
        startDebateBtn.textContent = "বিতর্ক চলছে...";

        let debateTranscript = `বিতর্কের বিষয়: ${topic}\n\n`;

        try {
            // Phase 1: Initial Arguments
            appendToTranscript("সূচনা", "সিস্টেম", "প্রথম পর্ব শুরু হচ্ছে...");
            const agreePromptP1 = `তুমি একজন দক্ষ বক্তা। "${topic}" এই বিষয়ের পক্ষে জোরালো যুক্তি দাও। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const agreeArgP1 = await callGroqAPI(agreeModel, agreePromptP1, "আপনি একজন বিতাড়্কিক যিনি বিষয়ের পক্ষে যুক্তি দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("প্রথম পর্ব", `পক্ষে (${agreeModel})`, agreeArgP1);
            debateTranscript += `প্রথম পর্ব - পক্ষে (${agreeModel}):\n${agreeArgP1}\n\n`;

            const disagreePromptP1 = `তুমি একজন দক্ষ বক্তা। "${topic}" এই বিষয়ের বিপক্ষে জোরালো যুক্তি দাও। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const disagreeArgP1 = await callGroqAPI(disagreeModel, disagreePromptP1, "আপনি একজন বিতাড়্কিক যিনি বিষয়ের বিপক্ষে যুক্তি দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("প্রথম পর্ব", `বিপক্ষে (${disagreeModel})`, disagreeArgP1);
            debateTranscript += `প্রথম পর্ব - বিপক্ষে (${disagreeModel}):\n${disagreeArgP1}\n\n`;

            // Phase 2: Rebuttals
            appendToTranscript("সূচনা", "সিস্টেম", "দ্বিতীয় পর্ব (পরস্পর খণ্ডন) শুরু হচ্ছে...");
            const agreeRebuttalPrompt = `"${disagreeArgP1}" - প্রতিপক্ষের এই যুক্তির জবাবে "${topic}" বিষয়ের পক্ষে তোমার যুক্তি খণ্ডন কর এবং নিজের অবস্থান আরও দৃঢ় কর। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const agreeRebuttalP2 = await callGroqAPI(agreeModel, agreeRebuttalPrompt, "আপনি একজন বিতাড়্কিক যিনি প্রতিপক্ষের যুক্তি খণ্ডন করছেন এবং নিজের যুক্তিকে আরও শক্তিশালী করছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("দ্বিতীয় পর্ব", `পক্ষে (${agreeModel})`, agreeRebuttalP2);
            debateTranscript += `দ্বিতীয় পর্ব - পক্ষে (${agreeModel}):\n${agreeRebuttalP2}\n\n`;

            const disagreeRebuttalPrompt = `"${agreeArgP1}" - প্রতিপক্ষের এই যুক্তির জবাবে "${topic}" বিষয়ের বিপক্ষে তোমার যুক্তি খণ্ডন কর এবং নিজের অবস্থান আরও দৃঢ় কর। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const disagreeRebuttalP2 = await callGroqAPI(disagreeModel, disagreeRebuttalPrompt, "আপনি একজন বিতাড়্কিক যিনি প্রতিপক্ষের যুক্তি খণ্ডন করছেন এবং নিজের যুক্তিকে আরও শক্তিশালী করছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("দ্বিতীয় পর্ব", `বিপক্ষে (${disagreeModel})`, disagreeRebuttalP2);
            debateTranscript += `দ্বিতীয় পর্ব - বিপক্ষে (${disagreeModel}):\n${disagreeRebuttalP2}\n\n`;

            // Phase 3: Responses to Rebuttals
            appendToTranscript("সূচনা", "সিস্টেম", "তৃতীয় পর্ব (খণ্ডনের জবাব) শুরু হচ্ছে...");
            const agreeResponsePromptP3 = `"${disagreeRebuttalP2}" - প্রতিপক্ষের এই খণ্ডনের জবাবে "${topic}" বিষয়ের পক্ষে তোমার চূড়ান্ত বক্তব্য দাও। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const agreeResponseP3 = await callGroqAPI(agreeModel, agreeResponsePromptP3, "আপনি একজন বিতার্কিক যিনি প্রতিপক্ষের খণ্ডনের চূড়ান্ত জবাব দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("তৃতীয় পর্ব", `পক্ষে (${agreeModel})`, agreeResponseP3);
            debateTranscript += `তৃতীয় পর্ব - পক্ষে (${agreeModel}):\n${agreeResponseP3}\n\n`;

            const disagreeResponsePromptP3 = `"${agreeRebuttalP2}" - প্রতিপক্ষের এই খণ্ডনের জবাবে "${topic}" বিষয়ের বিপক্ষে তোমার চূড়ান্ত বক্তব্য দাও। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const disagreeResponseP3 = await callGroqAPI(disagreeModel, disagreeResponsePromptP3, "আপনি একজন বিতাড়্কিক যিনি প্রতিপক্ষের খণ্ডনের চূড়ান্ত জবাব দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("তৃতীয় পর্ব", `বিপক্ষে (${disagreeModel})`, disagreeResponseP3);
            debateTranscript += `তৃতীয় পর্ব - বিপক্ষে (${disagreeModel}):\n${disagreeResponseP3}\n\n`;

            // Judgment Phase
            appendToTranscript("সূচনা", "সিস্টেম", "বিচার প্রক্রিয়া শুরু হচ্ছে...");
            const judgePrompt = `নিম্নে একটি বিতর্কের সম্পূর্ণ প্রতিলিপি দেওয়া হলো। বিতর্কের বিষয়: "${topic}"।\n\n${debateTranscript}\n\nএকজন নিরপেক্ষ বিচারক হিসেবে, উভয় পক্ষের যুক্তি বিশ্লেষণ করে বিজয়ী নির্ধারণ কর এবং তোমার রায়ের পেছনের কারণ ব্যাখ্যা কর। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const verdict = await callGroqAPI(judgeModel, judgePrompt, "আপনি একজন নিরপেক্ষ বিচারক যিনি একটি বিতর্ক মূল্যায়ন করছেন। বিজয়ী নির্ধারণ করুন এবং আপনার রায়ের কারণ বাংলায় ব্যাখ্যা করুন।");
            displayVerdict(judgeModel, verdict);

        } catch (error) {
            console.error("Debate flow error:", error);
            displayVerdict("সিস্টেম", `একটি ত্রুটি ঘটেছে: ${error.message}. অনুগ্রহ করে আবার চেষ্টা করুন।`);
        } finally {
            // Re-enable button
            startDebateBtn.disabled = false;
            startDebateBtn.textContent = "বিতর্ক শুরু করুন";
        }
    }
});
