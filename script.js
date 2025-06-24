// --- GLOBALS & CONSTANTS ---
let lastDebateText = ""; // Store the last debate as plain text

// --- CALL GROQ THROUGH NETLIFY FUNCTION ---
async function callGroqAPI(model, prompt, systemMessage = "আপনি একজন সহায়ক সহকারী যিনি বিতর্কে অংশ নিচ্ছেন। আপনার উত্তর সংক্ষিপ্ত, সুনির্দিষ্ট এবং তথ্যপূর্ণ হওয়া উচিত।") {
    console.log("API Call - Model:", model);
    console.log("API Call - System Message:", systemMessage);
    console.log("API Call - Prompt Length:", prompt.length);
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
                 errorMessage = "এই মুহূর্তে নির্বাচিত মডেলটি উপলব্ধ নেই। অনুগ্রহ করে কিছুক্ষণ পরে চেষ্টা করুন।";
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
    const startDebateBtn = document.getElementById('start-debate-btn');
    const transcriptArea = document.getElementById('transcript-area');
    const verdictArea = document.getElementById('verdict-area');

    // Single model for all roles
    const MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct';
    const MODEL_DISPLAY_NAME = 'Llama-4 Maverick';

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

    async function startDebate() {
        clearDebateArea();
        const topic = debateTopicInput.value;
        
        console.log("Debate Started - Topic:", topic);
        console.log("Using Model:", MODEL_DISPLAY_NAME);

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

            const agreePromptP1 = `তুমি একজন দক্ষ বক্তা। "${topic}" এই বিষয়ের পক্ষে জোরালো যুক্তি দাও। তোমার উত্তর 250-300 শব্দের মধ্যে সীমাবদ্ধ রাখো, সুনির্দিষ্ট যুক্তি দাও এবং অপ্রাসঙ্গিক বিষয় এড়িয়ে চলো।`;
            const agreeArgP1 = await callGroqAPI(MODEL, agreePromptP1, "আপনি একজন দক্ষ বিতার্কিক যিনি বিষয়ের পক্ষে যুক্তি দিচ্ছেন। আপনার উত্তর 250-300 শব্দের মধ্যে সীমাবদ্ধ রাখুন, সুনির্দিষ্ট যুক্তি দিন এবং অপ্রাসঙ্গিক বিষয় এড়িয়ে চলুন।");
            appendToTranscript("প্রথম পর্ব", `পক্ষে (${MODEL_DISPLAY_NAME})`, agreeArgP1);
            debateTranscript += `প্রথম পর্ব - পক্ষে (${MODEL_DISPLAY_NAME}):\n${agreeArgP1}\n\n`;

            const disagreePromptP1 = `তুমি একজন দক্ষ বক্তা। "${topic}" এই বিষয়ের বিপক্ষে জোরালো যুক্তি দাও। তোমার উত্তর 250-300 শব্দের মধ্যে সীমাবদ্ধ রাখো, সুনির্দিষ্ট যুক্তি দাও এবং অপ্রাসঙ্গিক বিষয় এড়িয়ে চলো।`;
            const disagreeArgP1 = await callGroqAPI(MODEL, disagreePromptP1, "আপনি একজন দক্ষ বিতার্কিক যিনি বিষয়ের বিপক্ষে যুক্তি দিচ্ছেন। আপনার উত্তর 250-300 শব্দের মধ্যে সীমাবদ্ধ রাখুন, সুনির্দিষ্ট যুক্তি দিন এবং অপ্রাসঙ্গিক বিষয় এড়িয়ে চলুন।");
            appendToTranscript("প্রথম পর্ব", `বিপক্ষে (${MODEL_DISPLAY_NAME})`, disagreeArgP1);
            debateTranscript += `প্রথম পর্ব - বিপক্ষে (${MODEL_DISPLAY_NAME}):\n${disagreeArgP1}\n\n`;

            // Phase 2: Rebuttals
            appendToTranscript("সূচনা", "সিস্টেম", "দ্বিতীয় পর্ব (পরস্পর খণ্ডন) শুরু হচ্ছে...");
            const agreeRebuttalPrompt = `"${disagreeArgP1}" - প্রতিপক্ষের এই যুক্তির জবাবে "${topic}" বিষয়ের পক্ষে তোমার খণ্ডন দাও। তোমার উত্তর 250-300 শব্দের মধ্যে সীমাবদ্ধ রাখো, প্রতিপক্ষের মূল যুক্তিগুলি সরাসরি খণ্ডন করো এবং নতুন প্রমাণ বা দৃষ্টিকোণ উপস্থাপন করো।`;
            const agreeRebuttalP2 = await callGroqAPI(MODEL, agreeRebuttalPrompt, "আপনি একজন দক্ষ বিতার্কিক যিনি প্রতিপক্ষের যুক্তির খণ্ডন করছেন। আপনার উত্তর 250-300 শব্দের মধ্যে সীমাবদ্ধ রাখুন, প্রতিপক্ষের মূল যুক্তিগুলি সরাসরি খণ্ডন করুন এবং নতুন প্রমাণ বা দৃষ্টিকোণ উপস্থাপন করুন।");
            appendToTranscript("দ্বিতীয় পর্ব", `পক্ষে (${MODEL_DISPLAY_NAME})`, agreeRebuttalP2);
            debateTranscript += `দ্বিতীয় পর্ব - পক্ষে (${MODEL_DISPLAY_NAME}):\n${agreeRebuttalP2}\n\n`;

            const disagreeRebuttalPrompt = `"${agreeArgP1}" - প্রতিপক্ষের এই যুক্তির জবাবে "${topic}" বিষয়ের বিপক্ষে তোমার খণ্ডন দাও। তোমার উত্তর 250-300 শব্দের মধ্যে সীমাবদ্ধ রাখো, প্রতিপক্ষের মূল যুক্তিগুলি সরাসরি খণ্ডন করো এবং নতুন প্রমাণ বা দৃষ্টিকোণ উপস্থাপন করো।`;
            const disagreeRebuttalP2 = await callGroqAPI(MODEL, disagreeRebuttalPrompt, "আপনি একজন দক্ষ বিতার্কিক যিনি প্রতিপক্ষের যুক্তির খণ্ডন করছেন। আপনার উত্তর 250-300 শব্দের মধ্যে সীমাবদ্ধ রাখুন, প্রতিপক্ষের মূল যুক্তিগুলি সরাসরি খণ্ডন করুন এবং নতুন প্রমাণ বা দৃষ্টিকোণ উপস্থাপন করুন।");
            appendToTranscript("দ্বিতীয় পর্ব", `বিপক্ষে (${MODEL_DISPLAY_NAME})`, disagreeRebuttalP2);
            debateTranscript += `দ্বিতীয় পর্ব - বিপক্ষে (${MODEL_DISPLAY_NAME}):\n${disagreeRebuttalP2}\n\n`;

            // Judgment Phase
            appendToTranscript("সূচনা", "সিস্টেম", "বিচার প্রক্রিয়া শুরু হচ্ছে...");
            const judgePrompt = `নিম্নে একটি বিতর্কের সম্পূর্ণ প্রতিলিপি দেওয়া হলো। বিতর্কের বিষয় "${topic}". বিচারক হিসেবে, প্রথম পর্বের যুক্তি এবং দ্বিতীয় পর্বের খণ্ডনের মান বিচার করে কে জিতেছে এবং কেন—এটি নিরপেক্ষভাবে সংক্ষেপে (300-400 শব্দের মধ্যে) বাংলা ভাষায় জানাও। উভয় পক্ষের শক্তিশালী ও দুর্বল দিকগুলি উল্লেখ করো এবং কোন পক্ষ অধিক বিশ্বাসযোগ্য ও যুক্তিসঙ্গত ছিল তা ব্যাখ্যা করো।`;
            const verdict = await callGroqAPI(MODEL, judgePrompt, "আপনি একজন নিরপেক্ষ বিচারক যিনি একটি বিতর্ক বিচার করছেন। আপনার রায় 300-400 শব্দের মধ্যে সীমাবদ্ধ রাখুন, উভয় পক্ষের শক্তিশালী ও দুর্বল দিকগুলি উল্লেখ করুন এবং কোন পক্ষ অধিক বিশ্বাসযোগ্য ও যুক্তিসঙ্গত ছিল তা ব্যাখ্যা করুন।");
            displayVerdict(MODEL_DISPLAY_NAME, verdict);
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

    if (startDebateBtn) {
        startDebateBtn.addEventListener('click', startDebate);
    }
});
