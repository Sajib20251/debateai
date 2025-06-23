// --- GLOBALS & CONSTANTS ---
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Hardcoded API keys list (replace with your real keys)
const OPENROUTER_API_KEYS = [
    "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",
    "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",
    "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"
];
let OPENROUTER_API_KEY_INDEX = 0;
let lastDebateText = ""; // Store the last debate as plain text

// --- UI RENDERING ---
function renderApiKeyList() {
    // Optionally, you can show which key is being used for debugging
    // Or just leave this function empty if you don't want to show keys
}

// --- MULTI-KEY API CALLS ---
async function callOpenRouterAPI(model, prompt, systemMessage = "আপনি একজন সহায়ক সহকারী যিনি বিতর্কে অংশ নিচ্ছেন।") {
    let lastError = null;
    for (let i = 0; i < OPENROUTER_API_KEYS.length; i++) {
        OPENROUTER_API_KEY_INDEX = i;
        try {
            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEYS[i]}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: systemMessage },
                        { role: "user", content: prompt }
                    ],
                    model: model,
                    temperature: 0.7,
                    max_tokens: 1024,
                    top_p: 1,
                    stream: false
                })
            });
            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices[0]?.message?.content) {
                    return data.choices[0].message.content.trim();
                }
            } else if (response.status === 401 || response.status === 429) {
                lastError = new Error("Key failed: " + response.status);
                continue;
            } else {
                lastError = new Error(await response.text());
                break;
            }
        } catch (e) {
            lastError = e;
            continue;
        }
    }
    throw lastError || new Error("No valid OpenRouter API key.");
}

// --- DOM READY & MAIN LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    // Remove all API key input UI and related event listeners from here

    // UI Elements
    const debateTopicInput = document.getElementById('debate-topic');
    const agreeModelSelect = document.getElementById('agree-model');
    const disagreeModelSelect = document.getElementById('disagree-model');
    const judgeModelSelect = document.getElementById('judge-model');
    const startDebateBtn = document.getElementById('start-debate-btn');
    const transcriptArea = document.getElementById('transcript-area');
    const verdictArea = document.getElementById('verdict-area');

    // Model mapping
    const MODEL_MAP = {
        'llama-4-maverick': 'meta-llama/llama-4-maverick:free',
        'deepseek-r1-0528': 'deepseek/deepseek-r1-0528:free',
        'llama3-70b-8192': 'meta-llama/llama-3-70b-instruct',
        'llama3-8b-4096': 'meta-llama/llama-3-8b-instruct:free',
        
    };

    // API Key UI events
    renderApiKeyList();

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
            const agreeArgP1 = await callOpenRouterAPI(MODEL_MAP[agreeModel] || agreeModel, agreePromptP1, "আপনি একজন বিতাড়্কিক যিনি বিষয়ের পক্ষে যুক্তি দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("প্রথম পর্ব", `পক্ষে (${agreeModel})`, agreeArgP1);
            debateTranscript += `প্রথম পর্ব - পক্ষে (${agreeModel}):\n${agreeArgP1}\n\n`;

            const disagreePromptP1 = `তুমি একজন দক্ষ বক্তা। "${topic}" এই বিষয়ের বিপক্ষে জোরালো যুক্তি দাও। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const disagreeArgP1 = await callOpenRouterAPI(MODEL_MAP[disagreeModel] || disagreeModel, disagreePromptP1, "আপনি একজন বিতাড়্কিক যিনি বিষয়ের বিপক্ষে যুক্তি দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("প্রথম পর্ব", `বিপক্ষে (${disagreeModel})`, disagreeArgP1);
            debateTranscript += `প্রথম পর্ব - বিপক্ষে (${disagreeModel}):\n${disagreeArgP1}\n\n`;

            // Phase 2: Rebuttals
            appendToTranscript("সূচনা", "সিস্টেম", "দ্বিতীয় পর্ব (পরস্পর খণ্ডন) শুরু হচ্ছে...");
            const agreeRebuttalPrompt = `"${disagreeArgP1}" - প্রতিপক্ষের এই যুক্তির জবাবে "${topic}" বিষয়ের পক্ষে তোমার যুক্তি খণ্ডন কর এবং নিজের অবস্থান আরও দৃঢ় কর। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const agreeRebuttalP2 = await callOpenRouterAPI(MODEL_MAP[agreeModel] || agreeModel, agreeRebuttalPrompt, "আপনি একজন  বিতার্কিক যিনি প্রতিপক্ষের যুক্তি খণ্ডন করছেন এবং নিজের যুক্তিকে আরও শক্তিশালী করছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("দ্বিতীয় পর্ব", `পক্ষে (${agreeModel})`, agreeRebuttalP2);
            debateTranscript += `দ্বিতীয় পর্ব - পক্ষে (${agreeModel}):\n${agreeRebuttalP2}\n\n`;

            const disagreeRebuttalPrompt = `"${agreeArgP1}" - প্রতিপক্ষের এই যুক্তির জবাবে "${topic}" বিষয়ের বিপক্ষে তোমার যুক্তি খণ্ডন কর এবং নিজের অবস্থান আরও দৃঢ় কর। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const disagreeRebuttalP2 = await callOpenRouterAPI(MODEL_MAP[disagreeModel] || disagreeModel, disagreeRebuttalPrompt, "আপনি একজন বিতার্কিক যিনি প্রতিপক্ষের যুক্তি খণ্ডন করছেন এবং নিজের যুক্তিকে আরও শক্তিশালী করছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("দ্বিতীয় পর্ব", `বিপক্ষে (${disagreeModel})`, disagreeRebuttalP2);
            debateTranscript += `দ্বিতীয় পর্ব - বিপক্ষে (${disagreeModel}):\n${disagreeRebuttalP2}\n\n`;

            // Phase 3: Responses to Rebuttals
            appendToTranscript("সূচনা", "সিস্টেম", "তৃতীয় পর্ব (খণ্ডনের জবাব) শুরু হচ্ছে...");
            const agreeResponsePromptP3 = `"${disagreeRebuttalP2}" - প্রতিপক্ষের এই খণ্ডনের জবাবে "${topic}" বিষয়ের পক্ষে তোমার চূড়ান্ত বক্তব্য দাও। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const agreeResponseP3 = await callOpenRouterAPI(MODEL_MAP[agreeModel] || agreeModel, agreeResponsePromptP3, "আপনি একজন বিতার্কিক যিনি প্রতিপক্ষের খণ্ডনের চূড়ান্ত জবাব দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("তৃতীয় পর্ব", `পক্ষে (${agreeModel})`, agreeResponseP3);
            debateTranscript += `তৃতীয় পর্ব - পক্ষে (${agreeModel}):\n${agreeResponseP3}\n\n`;

            const disagreeResponsePromptP3 = `"${agreeRebuttalP2}" - প্রতিপক্ষের এই খণ্ডনের জবাবে "${topic}" বিষয়ের বিপক্ষে তোমার চূড়ান্ত বক্তব্য দাও। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const disagreeResponseP3 = await callOpenRouterAPI(MODEL_MAP[disagreeModel] || disagreeModel, disagreeResponsePromptP3, "আপনি একজন বিতার্কিক যিনি প্রতিপক্ষের খণ্ডনের চূড়ান্ত জবাব দিচ্ছেন। উত্তরে অবশ্যই বাংলা ব্যবহার করুন।");
            appendToTranscript("তৃতীয় পর্ব", `বিপক্ষে (${disagreeModel})`, disagreeResponseP3);
            debateTranscript += `তৃতীয় পর্ব - বিপক্ষে (${disagreeModel}):\n${disagreeResponseP3}\n\n`;

            // Judgment Phase
            appendToTranscript("সূচনা", "সিস্টেম", "বিচার প্রক্রিয়া শুরু হচ্ছে...");
            const judgePrompt = `নিম্নে একটি বিতর্কের সম্পূর্ণ প্রতিলিপি দেওয়া হলো। বিতর্কের বিষয়: "${topic}"।\n\n${debateTranscript}\n\nএকজন নিরপেক্ষ বিচারক হিসেবে, উভয় পক্ষের যুক্তি বিশ্লেষণ করে বিজয়ী নির্ধারণ কর এবং তোমার রায়ের পেছনের কারণ ব্যাখ্যা কর। তোমার উত্তর অবশ্যই বাংলায় হতে হবে।`;
            const verdict = await callOpenRouterAPI(MODEL_MAP[judgeModel] || judgeModel, judgePrompt, "আপনি একজন নিরপেক্ষ বিচারক যিনি একটি বিতর্ক মূল্যায়ন করছেন। বিজয়ী নির্ধারণ করুন এবং আপনার রায়ের কারণ বাংলায় ব্যাখ্যা করুন।");
            displayVerdict(judgeModel, verdict);
            lastDebateText = `${debateTranscript}\n\nবিচারকের রায়:\n${verdict}`; // Store the last debate text

        } catch (error) {
            let msg = error.message;
            if (msg.includes("No instances available")) {
                msg = "এই মুহূর্তে নির্বাচিত মডেলটি উপলব্ধ নেই। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন অথবা অন্য মডেল নির্বাচন করুন।";
            }
            console.error("Debate flow error:", error);
            displayVerdict("সিস্টেম", `একটি ত্রুটি ঘটেছে: ${msg}`);
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
