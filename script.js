// --- GLOBALS & CONSTANTS ---
let lastDebateText = ""; // Store the last debate as plain text

// --- NETLIFY FUNCTION API CALL ---
async function callGroqAPI(model, prompt, systemMessage = "আপনি একজন সহায়ক সহকারী যিনি বিতর্কে অংশ নিচ্ছেন।") {
    try {
        const response = await fetch('/.netlify/functions/call-groq', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                systemMessage: systemMessage
            })
        });

        const data = await response.json();

        if (!response.ok) {
            // The Netlify function should return a JSON with an 'error' field.
            let errorMessage = data.error || `API Error: ${response.status}`;
            if (data.details && typeof data.details === 'string' && (data.details.includes("Service Unavailable") || data.details.includes("503"))) {
                 errorMessage = "এই মুহূর্তে নির্বাচিত মডেলটি উপলব্ধ নেই। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন অথবা অন্য মডেল নির্বাচন করুন।";
            } else if (response.status === 401) {
                errorMessage = "API key সমস্যা অথবা কোটা শেষ।";
            } else if (response.status === 429) {
                errorMessage = "রেট লিমিট অতিক্রম করেছে অথবা মডেলটির দৈনিক কোটা শেষ।";
            } else if (response.status === 400) {
                errorMessage = "মডেল নাম বা প্যারামিটারে সমস্যা।";
            }
            console.error("Error calling Netlify function:", errorMessage, data.details || '');
            throw new Error(errorMessage);
        }

        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content.trim();
        } else {
            // Handle cases where the response is OK but doesn't have the expected structure
            console.error("Unexpected response structure from API:", data);
            throw new Error("API থেকে অপ্রত্যাশিত উত্তর এসেছে।");
        }
    } catch (error) {
        console.error("Fetch error calling Netlify function:", error);
        // Re-throw the error so it can be caught by the startDebate function's catch block
        throw error;
    }
}

// --- DOM READY & MAIN LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const debateTopicInput = document.getElementById('debate-topic');
    const agreeModelSelect = document.getElementById('agree-model');
    const disagreeModelSelect = document.getElementById('disagree-model');
    const judgeModelSelect = document.getElementById('judge-model');
    const startDebateBtn = document.getElementById('start-debate-btn');
    const transcriptArea = document.getElementById('transcript-area');
    const verdictArea = document.getElementById('verdict-area');

    // Groq Model mapping - these are the actual model IDs used by Groq
    const MODEL_MAP = {
        'llama-4-maverick': 'llama-4-maverick-17b-128e-instruct',
        'llama-3.1-8b': 'llama-3.1-8b-instant',
        'llama-3-70b': 'llama3-70b-8192',
        'llama-3-8b': 'llama3-8b-8192',
        'mixtral-8x7b': 'mixtral-8x7b-32768',
        'gemma-7b': 'gemma-7b-it',
        'gemma2-9b': 'gemma2-9b-it'
    };

    if (startDebateBtn) {
        startDebateBtn.onclick = () => {
            startDebate();
        };
    }

    // Transcript and verdict helpers
    function appendToTranscript(phaseTitle, speaker, text) {
        const phaseDiv = document.createElement('div');
        phaseDiv.classList.add('phase');
        phaseDiv.innerHTML = `<h3 class="phase-title">${phaseTitle} - ${speaker}</h3><p class="speaker-argument">${text}</p>`;
        transcriptArea.appendChild(phaseDiv);
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    }
    function displayVerdict(judgeName, verdictText) {
        verdictArea.innerHTML = `<h3 class="phase-title">বিচারকের রায় (${judgeName})</h3><p class="judge-verdict">${verdictText}</p>`;
        verdictArea.scrollTop = verdictArea.scrollHeight;
    }
    function clearDebateArea() {
        transcriptArea.innerHTML = '';
        verdictArea.innerHTML = '';
    }

    // Main debate logic
    async function startDebate() {
        clearDebateArea();
        const topic = debateTopicInput.value;
        const agreeModel = agreeModelSelect.value;
        const disagreeModel = disagreeModelSelect.value;
        const judgeModel = judgeModelSelect.value;

        if (!topic.trim()) {
            alert("অনুগ্রহ করে বিতর্কের বিষয় লিখুন।");
            return;
        }

        startDebateBtn.disabled = true;
        startDebateBtn.textContent = "বিতর্ক চলছে...";

        let debateTranscript = `বিতর্কের বিষয়: ${topic}\n\n`;

        try {
            // Phase 1: Initial Arguments
            appendToTranscript("সূচনা", "সিস্টেম", "প্রথম পর্ব শুরু হচ্ছে...");
            const agreePromptP1 = `তুমি একজন দক্ষ বক্তা। "${topic}" এই বিষয়ের পক্ষে জোরালো যুক্তি দাও। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const agreeArgP1 = await callGroqAPI(MODEL_MAP[agreeModel] || agreeModel, agreePromptP1, "আপনি একজন বিতার্কিক যিনি বিষয়ের পক্ষে যুক্তি দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("প্রথম পর্ব", `পক্ষে (${agreeModel})`, agreeArgP1);
            debateTranscript += `প্রথম পর্ব - পক্ষে (${agreeModel}):\n${agreeArgP1}\n\n`;

            const disagreePromptP1 = `তুমি একজন দক্ষ বক্তা। "${topic}" এই বিষয়ের বিপক্ষে জোরালো যুক্তি দাও। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const disagreeArgP1 = await callGroqAPI(MODEL_MAP[disagreeModel] || disagreeModel, disagreePromptP1, "আপনি একজন বিতার্কিক যিনি বিষয়ের বিপক্ষে যুক্তি দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("প্রথম পর্ব", `বিপক্ষে (${disagreeModel})`, disagreeArgP1);
            debateTranscript += `প্রথম পর্ব - বিপক্ষে (${disagreeModel}):\n${disagreeArgP1}\n\n`;

            // Phase 2: Rebuttals
            appendToTranscript("সূচনা", "সিস্টেম", "দ্বিতীয় পর্ব (পরস্পর খণ্ডন) শুরু হচ্ছে...");
            const agreeRebuttalPrompt = `"${disagreeArgP1}" - প্রতিপক্ষের এই যুক্তির জবাবে "${topic}" বিষয়ের পক্ষে তোমার যুক্তি খণ্ডন কর এবং নিজের অবস্থান আরও দৃঢ় কর। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const agreeRebuttalP2 = await callGroqAPI(MODEL_MAP[agreeModel] || agreeModel, agreeRebuttalPrompt, "আপনি একজন  বিতার্কিক যিনি প্রতিপক্ষের যুক্তি খণ্ডন করছেন এবং নিজের যুক্তিকে আরও শক্তিশালী করছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("দ্বিতীয় পর্ব", `পক্ষে (${agreeModel})`, agreeRebuttalP2);
            debateTranscript += `দ্বিতীয় পর্ব - পক্ষে (${agreeModel}):\n${agreeRebuttalP2}\n\n`;

            const disagreeRebuttalPrompt = `"${agreeArgP1}" - প্রতিপক্ষের এই যুক্তির জবাবে "${topic}" বিষয়ের বিপক্ষে তোমার যুক্তি খণ্ডন কর এবং নিজের অবস্থান আরও দৃঢ় কর। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const disagreeRebuttalP2 = await callGroqAPI(MODEL_MAP[disagreeModel] || disagreeModel, disagreeRebuttalPrompt, "আপনি একজন বিতার্কিক যিনি প্রতিপক্ষের যুক্তি খণ্ডন করছেন এবং নিজের যুক্তিকে আরও শক্তিশালী করছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("দ্বিতীয় পর্ব", `বিপক্ষে (${disagreeModel})`, disagreeRebuttalP2);
            debateTranscript += `দ্বিতীয় পর্ব - বিপক্ষে (${disagreeModel}):\n${disagreeRebuttalP2}\n\n`;

            // Phase 3: Responses to Rebuttals
            appendToTranscript("সূচনা", "সিস্টেম", "তৃতীয় পর্ব (খণ্ডনের জবাব) শুরু হচ্ছে...");
            const agreeResponsePromptP3 = `"${disagreeRebuttalP2}" - প্রতিপক্ষের এই খণ্ডনের জবাবে "${topic}" বিষয়ের পক্ষে তোমার চূড়ান্ত বক্তব্য দাও। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const agreeResponseP3 = await callGroqAPI(MODEL_MAP[agreeModel] || agreeModel, agreeResponsePromptP3, "আপনি একজন বিতার্কিক যিনি প্রতিপক্ষের খণ্ডনের চূড়ান্ত জবাব দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("তৃতীয় পর্ব", `পক্ষে (${agreeModel})`, agreeResponseP3);
            debateTranscript += `তৃতীয় পর্ব - পক্ষে (${agreeModel}):\n${agreeResponseP3}\n\n`;

            const disagreeResponsePromptP3 = `"${agreeRebuttalP2}" - প্রতিপক্ষের এই খণ্ডনের জবাবে "${topic}" বিষয়ের বিপক্ষে তোমার চূড়ান্ত বক্তব্য দাও। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const disagreeResponseP3 = await callGroqAPI(MODEL_MAP[disagreeModel] || disagreeModel, disagreeResponsePromptP3, "আপনি একজন বিতার্কিক যিনি প্রতিপক্ষের খণ্ডনের চূড়ান্ত জবাব দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("তৃতীয় পর্ব", `বিপক্ষে (${disagreeModel})`, disagreeResponseP3);
            debateTranscript += `তৃতীয় পর্ব - বিপক্ষে (${disagreeModel}):\n${disagreeResponseP3}\n\n`;

            // Judgment Phase
            appendToTranscript("সূচনা", "সিস্টেম", "বিচার প্রক্রিয়া শুরু হচ্ছে...");
            const judgePrompt = `নিম্নে একটি বিতর্কের সম্পূর্ণ প্রতিলিপি দেওয়া হলো। বিতর্কের বিষয়: "${topic}"।\n\n${debateTranscript}\n\nএকজন নিরপেক্ষ বিচারক হিসেবে, উভয় পক্ষের যুক্তি বিশ্লেষণ করে বিজয়ী নির্ধারণ কর এবং তোমার রায়ের পেছনের কারণ ব্যাখ্যা কর। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const verdict = await callGroqAPI(MODEL_MAP[judgeModel] || judgeModel, judgePrompt, "আপনি একজন নিরপেক্ষ বিচারক যিনি একটি বিতর্ক মূল্যায়ন করছেন। বিজয়ী নির্ধারণ করুন এবং আপনার রায়ের কারণ বাংলায় ব্যাখ্যা করুন।");
            displayVerdict(judgeModel, verdict);
            lastDebateText = `${debateTranscript}\n\nবিচারকের রায়:\n${verdict}`; // Store the last debate text

        } catch (error) {
            console.error("Debate flow error:", error);
            displayVerdict("সিস্টেম", `একটি ত্রুটি ঘটেছে: ${error.message}`);
        } finally {
            startDebateBtn.disabled = false;
            startDebateBtn.textContent = "বিতর্ক শুরু করুন";
        }
    }

    // Download button logic
    const downloadBtn = document.getElementById('download-history-btn');
    if (downloadBtn) {
        downloadBtn.onclick = function() {
            if (!lastDebateText.trim()) {
                alert("কোনো বিতর্ক ইতিহাস নেই ডাউনলোড করার জন্য!");
                return;
            }
            const blob = new Blob([lastDebateText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'debate_history.txt';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        };
    }

    // Start debate button event
    if (startDebateBtn) {
        startDebateBtn.addEventListener('click', startDebate);
    }
});
