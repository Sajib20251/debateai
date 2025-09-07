// --- GLOBALS & CONSTANTS ---
let lastDebateText = ""; // Store the last debate as plain text

// --- CALL GROQ THROUGH NETLIFY FUNCTION ---
async function callGroqAPI(model, prompt, systemMessage = "You are a helpful assistant participating in a debate.") {
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
                 errorMessage = "The selected model is currently unavailable. Please try again later.";
            } else if (response.status === 401) {
                errorMessage = "API key issue or quota exceeded.";
            } else if (response.status === 429) {
                errorMessage = "Rate limit exceeded or the model's daily quota is exhausted.";
            } else if (response.status === 400) {
                errorMessage = "Model name or parameter issue.";
            }
            console.error("Error calling Netlify function:", errorMessage, data.details || '');
            throw new Error(errorMessage);
        }

        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content.trim();
        } else {
            // Handle cases where the response is OK but doesn't have the expected structure
            console.error("Unexpected response structure from API:", data);
            throw new Error("Received an unexpected response from the API.");
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
        verdictArea.innerHTML = `<h3 class="phase-title">Judge's Verdict (${judgeName})</h3><p class="judge-verdict">${verdictText}</p>`;
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
            alert("Please enter a debate topic.");
            return;
        }

        startDebateBtn.disabled = true;
        startDebateBtn.textContent = "Debate in progress...";

        let debateTranscript = `Debate Topic: ${topic}\n\n`;

        try {
            // Phase 1: Initial Arguments
            appendToTranscript("Introduction", "System", "First phase is starting...");

            const agreePromptP1 = `You are a skilled debater. Provide strong arguments in favor of the topic: "${topic}".`;
            const agreeArgP1 = await callGroqAPI(MODEL, agreePromptP1, "You are a skilled debater arguing in favor of the topic.");
            appendToTranscript("Phase 1", `Pro (${MODEL_DISPLAY_NAME})`, agreeArgP1);
            debateTranscript += `Phase 1 - Pro (${MODEL_DISPLAY_NAME}):\n${agreeArgP1}\n\n`;

            const disagreePromptP1 = `You are a skilled debater. Provide strong arguments against the topic: "${topic}".`;
            const disagreeArgP1 = await callGroqAPI(MODEL, disagreePromptP1, "You are a skilled debater arguing against the topic.");
            appendToTranscript("Phase 1", `Con (${MODEL_DISPLAY_NAME})`, disagreeArgP1);
            debateTranscript += `Phase 1 - Con (${MODEL_DISPLAY_NAME}):\n${disagreeArgP1}\n\n`;

            // Phase 2: Rebuttals
            appendToTranscript("Introduction", "System", "Second phase (Rebuttals) is starting...");
            const agreeRebuttalPrompt = `"${disagreeArgP1}" - Respond to these arguments against the topic "${topic}" in favor of the topic.`;
            const agreeRebuttalP2 = await callGroqAPI(MODEL, agreeRebuttalPrompt, "You are a skilled debater rebutting the opponent's arguments in favor of the topic.");
            appendToTranscript("Phase 2", `Pro (${MODEL_DISPLAY_NAME})`, agreeRebuttalP2);
            debateTranscript += `Phase 2 - Pro (${MODEL_DISPLAY_NAME}):\n${agreeRebuttalP2}\n\n`;

            const disagreeRebuttalPrompt = `"${agreeArgP1}" - Respond to these arguments in favor of the topic "${topic}" against the topic.`;
            const disagreeRebuttalP2 = await callGroqAPI(MODEL, disagreeRebuttalPrompt, "You are a skilled debater rebutting the opponent's arguments against the topic.");
            appendToTranscript("Phase 2", `Con (${MODEL_DISPLAY_NAME})`, disagreeRebuttalP2);
            debateTranscript += `Phase 2 - Con (${MODEL_DISPLAY_NAME}):\n${disagreeRebuttalP2}\n\n`;

            // Judgment Phase
            appendToTranscript("Introduction", "System", "Judgment phase is starting...");
            const judgePrompt = `Below is the full transcript of a debate. Please act as a neutral judge and provide your verdict and reasoning. Transcript:\n${debateTranscript}`;
            const verdict = await callGroqAPI(MODEL, judgePrompt, "You are a neutral judge who judges a debate and provides a verdict and reasoning in English.");
            displayVerdict(MODEL_DISPLAY_NAME, verdict);
            lastDebateText = `${debateTranscript}\n\nJudge's Verdict:\n${verdict}`; // Store the last debate text

        } catch (error) {
            console.error("Debate flow error:", error);
            displayVerdict("System", `An error occurred: ${error.message}`);
        } finally {
            startDebateBtn.disabled = false;
            startDebateBtn.textContent = "Start Debate";
        }
    }

    // Download button logic
    const downloadBtn = document.getElementById('download-history-btn');
    if (downloadBtn) {
        downloadBtn.onclick = function() {
            if (!lastDebateText.trim()) {
                alert("No debate history available to download!");
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
