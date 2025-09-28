
// --- Gemini API LLM Integration ---
const queryInput = document.getElementById('queryInput');
const analyzeButton = document.getElementById('analyzeButton');
const speakButton = document.getElementById('speakButton');
const resultContainer = document.getElementById('resultContainer');
const resultText = document.getElementById('resultText');
const sourceLinks = document.getElementById('sourceLinks');
const loadingIndicator = document.getElementById('loadingIndicator');
const loadingAudio = document.getElementById('loadingAudio');
const messageBox = document.getElementById('messageBox');

// New feature elements
const projectKeywordInput = document.getElementById('projectKeywordInput');
const generateProjectButton = document.getElementById('generateProjectButton');
const projectResultContainer = document.getElementById('projectResultContainer');
const projectResultText = document.getElementById('projectResultText');
const loadingGenerator = document.getElementById('loadingGenerator');
const audioInputButton = document.getElementById('audioInputButton');

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent";
const AUDIO_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";
const IMAGE_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict";

// --- IMPORTANT: ADD YOUR API KEY HERE ---
// Your Gemini API key is required to use the AI-powered features.
// Get a key at https://aistudio.google.com/
const API_KEY = "AIzaSyBjx6ZDcU8GIBPFY4Q4eHOUsw6ixikpz18";

// --- Helper Functions for TTS ---
function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function pcmToWav(pcmData, sampleRate) {
    const buffer = new ArrayBuffer(44 + pcmData.byteLength);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF'); // RIFF identifier
    view.setUint32(4, 36 + pcmData.byteLength, true); // file length
    writeString(view, 8, 'WAVE'); // RIFF type
    writeString(view, 12, 'fmt '); // format chunk identifier
    view.setUint32(16, 16, true); // format chunk length
    view.setUint16(20, 1, true); // sample format (1 = PCM)
    view.setUint16(22, 1, true); // number of channels (1 = mono)
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(view, 36, 'data'); // data chunk identifier
    view.setUint32(40, pcmData.byteLength, true); // data chunk length

    // Write PCM data
    let offset = 44;
    for (let i = 0; i < pcmData.length; i++) {
        view.setInt16(offset, pcmData[i], true);
        offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}

async function generateAudioSummary() {
    const textToSpeak = resultText.textContent;
    if (!textToSpeak) {
        showMessage("Please generate a summary first to hear it.", 'info');
        return;
    }

    // Check for API key before proceeding
    if (!API_KEY) {
        showMessage("API key is not configured. Audio generation is unavailable.", 'error');
        return;
    }

    speakButton.disabled = true;
    loadingAudio.classList.remove('hidden');

    const payload = {
        contents: [{
            parts: [{ text: textToSpeak }]
        }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: "Fenrir" }
                }
            }
        },
        model: "gemini-2.5-flash-preview-tts"
    };

    const fetchFn = () => fetch(`${AUDIO_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    try {
        const response = await fetchWithRetry(fetchFn);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;

        if (audioData && mimeType && mimeType.startsWith("audio/")) {
            const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)[1], 10);
            const pcmData = base64ToArrayBuffer(audioData);
            const pcm16 = new Int16Array(pcmData);
            const wavBlob = pcmToWav(pcm16, sampleRate);
            const audioUrl = URL.createObjectURL(wavBlob);
            const audio = new Audio(audioUrl);
            audio.play();
        } else {
            showMessage("Failed to generate audio. The API response was empty.", 'error');
        }

    } catch (error) {
        console.error("Audio API Error:", error);
        showMessage("Audio generation failed. Please check your network.", 'error');
    } finally {
        speakButton.disabled = false;
        loadingAudio.classList.add('hidden');
    }
}

// --- Helper Functions for API Calls ---
function showMessage(message, type = 'error') {
    messageBox.textContent = message;
    messageBox.className = 'p-4 rounded-lg text-sm mono-text mt-4';
    if (type === 'error') {
        messageBox.classList.add('bg-red-900/50', 'text-red-300');
    } else if (type === 'success') {
        messageBox.classList.add('bg-green-900/50', 'text-green-300');
    } else {
        messageBox.classList.add('bg-yellow-900/50', 'text-yellow-300');
    }
    messageBox.classList.remove('hidden');
}

async function fetchWithRetry(fn, retries = 5, delay = 1000) {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) {
            throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(fn, retries - 1, delay * 2);
    }
}

// --- Text-to-Text Feature ---
analyzeButton.addEventListener('click', generateSummary);
speakButton.addEventListener('click', generateAudioSummary);

async function generateSummary() {
    const userQuery = queryInput.value.trim();
    if (!userQuery) {
        showMessage("Input field is empty. Please enter a technical concept to analyze.", 'error');
        return;
    }

    // Check for API key before proceeding
    if (!API_KEY) {
        showMessage("API key is not configured. Analysis is unavailable.", 'error');
        return;
    }

    resultText.textContent = '';
    sourceLinks.innerHTML = '';
    resultContainer.classList.add('hidden');
    messageBox.classList.add('hidden');

    analyzeButton.disabled = true;
    loadingIndicator.classList.remove('hidden');

    const systemPrompt = "Act as a senior cloud solutions architect. Provide a concise, clear, and technically accurate explanation of the user's query in one short paragraph. Your response should be professional and focused on security, efficiency, and scale.";

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        tools: [{ "google_search": {} }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    const fetchFn = () => fetch(`${API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    try {
        const response = await fetchWithRetry(fetchFn);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();

        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            let sources = [];
            const groundingMetadata = candidate.groundingMetadata;

            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title);
            }

            resultText.textContent = text;
            resultContainer.classList.remove('hidden');

            if (sources.length > 0) {
                sources.forEach((source, index) => {
                    const link = document.createElement('a');
                    link.href = source.uri;
                    link.target = "_blank";
                    link.className = "block hover:text-accent-blue transition duration-150 underline";
                    link.textContent = `[Source ${index + 1}] ${source.title}`;
                    sourceLinks.appendChild(link);
                });
            }

        } else {
            showMessage("Analysis failed: Could not generate a meaningful summary. Please try a different query.", 'error');
        }

    } catch (error) {
        console.error("Gemini API Error:", error);
        showMessage("Connection error. Could not reach the analysis engine. Please check your network.", 'error');

    } finally {
        analyzeButton.disabled = false;
        loadingIndicator.classList.add('hidden');
    }
}

// --- Image Generation Feature ---
const imageQueryInput = document.getElementById('imageQueryInput');
const visualizeButton = document.getElementById('visualizeButton');
const generatedImage = document.getElementById('generatedImage');
const imageResultContainer = document.getElementById('imageResultContainer');
const loadingImage = document.getElementById('loadingImage');

visualizeButton.addEventListener('click', generateImage);

async function generateImage() {
    const userPrompt = imageQueryInput.value.trim();
    if (!userPrompt) {
        showMessage("Please enter a concept to visualize.", 'error');
        return;
    }

    // Check for API key before proceeding
    if (!API_KEY) {
        showMessage("API key is not configured. Image visualization is unavailable.", 'error');
        return;
    }

    visualizeButton.disabled = true;
    imageResultContainer.classList.add('hidden');
    loadingImage.classList.remove('hidden');

    const payload = {
        instances: { prompt: userPrompt },
        parameters: { "sampleCount": 1 }
    };

    const fetchFn = () => fetch(`${IMAGE_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    try {
        const response = await fetchWithRetry(fetchFn);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();

        if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
            const base64Data = result.predictions[0].bytesBase64Encoded;
            generatedImage.src = `data:image/png;base64,${base64Data}`;
            imageResultContainer.classList.remove('hidden');
        } else {
            showMessage("Image generation failed. Please try a different prompt.", 'error');
        }
    } catch (error) {
        console.error("Image API Error:", error);
        showMessage("Image generation failed. Check your network connection.", 'error');
    } finally {
        visualizeButton.disabled = false;
        loadingImage.classList.add('hidden');
    }
}

// --- NEW: Fictional Project Generator ---
generateProjectButton.addEventListener('click', generateFictitiousProject);

async function generateFictitiousProject() {
    const userKeyword = projectKeywordInput.value.trim();
    if (!userKeyword) {
        showMessage("Please enter a keyword for the fictional project.", 'error');
        return;
    }

    if (!API_KEY) {
        showMessage("API key is not configured. Fictional project generation is unavailable.", 'error');
        return;
    }

    projectResultText.innerHTML = '';
    projectResultContainer.classList.add('hidden');
    loadingGenerator.classList.remove('hidden');
    generateProjectButton.disabled = true;

    const systemPrompt = `You are a satirical solutions architect. Generate a single project description in HTML that includes a "Challenge" and a "Solution" that sounds technologically advanced but is physically absurd. Use <p> tags for each section and ** for bold text. The project should be based on the user's input keyword.`;
    const userPrompt = `Generate a project based on the keyword: "${userKeyword}".`;

    const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    const fetchFn = () => fetch(`${API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    try {
        const response = await fetchWithRetry(fetchFn);
        const result = await response.json();
        const generatedContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (generatedContent) {
            projectResultText.innerHTML = generatedContent;
            projectResultContainer.classList.remove('hidden');
        } else {
            showMessage("Fictional project generation failed. Please try again.", 'error');
        }
    } catch (error) {
        console.error("Project Generator API Error:", error);
        showMessage("Fictional project generation failed. Please check your network.", 'error');
    } finally {
        loadingGenerator.classList.add('hidden');
        generateProjectButton.disabled = false;
    }
}

// --- NEW: Audio Input Feature (for Resonance Analyzer) ---
audioInputButton.addEventListener('click', startSpeechRecognition);

function startSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
        showMessage("Your browser does not support speech recognition.", 'error');
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    audioInputButton.classList.add('animate-pulse');
    queryInput.placeholder = "Listening...";
    queryInput.value = "";
    queryInput.disabled = true;

    recognition.start();

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        queryInput.value = transcript;
        queryInput.placeholder = "e.g., Define FinOps and its core principles...";
        queryInput.disabled = false;
        audioInputButton.classList.remove('animate-pulse');
    };

    recognition.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        showMessage(`Speech recognition failed: ${event.error}`, 'error');
        queryInput.placeholder = "e.g., Define FinOps and its core principles...";
        queryInput.disabled = false;
        audioInputButton.classList.remove('animate-pulse');
    };
}

// Initialize Lucide Icons
lucide.createIcons();

// --- Firebase Initialization (Simplified) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
let app, db, auth;
setLogLevel('Debug');

if (firebaseConfig) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    signInAnonymously(auth); // Sign in anonymously for a token, if needed for future features.
}

// --- Scroll Rain Effect Logic (Unchanged) ---
document.addEventListener('DOMContentLoaded', () => {
    const heroSection = document.getElementById('hero');
    const scrollRainContainer = document.getElementById('scrollRainContainer');
    const cloudLeft = document.getElementById('cloudLeft');
    const solutionsSection = document.getElementById('solutions');

    const CLOUD_MAX_OPACITY = 0.1;

    // Initial cloud position is off-screen below the viewport
    cloudLeft.style.transform = 'translateY(100vh)';
    cloudLeft.style.opacity = '0';

    const numDrops = 10;
    const dropElements = [];
    const dropTimeOffsets = [];

    for (let i = 0; i < numDrops; i++) {
        const drop = document.createElement('div');
        drop.className = 'scroll-drop';
        drop.style.left = `${Math.random() * 30}vw`;
        const size = Math.random() * 4 + 4;
        drop.style.width = `${size}px`;
        drop.style.height = `${size}px`;
        dropElements.push(drop);
        scrollRainContainer.appendChild(drop);
        dropTimeOffsets.push(Math.random() * 0.35);
    }

    dropElements.forEach(drop => {
        drop.style.transform = 'translateY(100px)';
        drop.style.opacity = '0';
    });

    function handleScrollRain() {
        const scrollY = window.scrollY;
        const heroHeight = heroSection.offsetHeight;
        const scrollDistance = heroHeight;
        const currentScroll = Math.min(scrollDistance, Math.max(0, scrollY));
        const scrollProgress = currentScroll / scrollDistance;

        // Cloud Scroll
        const cloudScrollDuration = 0.5;
        const cloudScrollProgress = Math.min(1, scrollProgress / cloudScrollDuration);
        const cloudStartVH = 100;
        const cloudEndVH = 20;
        const cloudYVH = cloudStartVH + (cloudEndVH - cloudStartVH) * cloudScrollProgress;
        cloudLeft.style.transform = `translateY(${cloudYVH}vh)`;

        // Cloud Opacity
        let normalizedFadeOpacity = 1.0;
        const fadeInStart = 0.0;
        const fadeInEnd = 0.10;
        if (scrollProgress < fadeInEnd) {
            normalizedFadeOpacity = Math.min(1, (scrollProgress - fadeInStart) / (fadeInEnd - fadeInStart));
        }
        const fadeOutStart = 0.80;
        const fadeOutEnd = 1.0;
        if (scrollProgress > fadeOutStart) {
            normalizedFadeOpacity = Math.max(0, 1 - (scrollProgress - fadeOutStart) / (fadeOutEnd - fadeOutStart));
        }
        cloudLeft.style.opacity = (normalizedFadeOpacity * CLOUD_MAX_OPACITY).toFixed(3);

        // Drop Movement
        const cloudBottomOffsetPixels = (cloudYVH / 100) * window.innerHeight;
        const cloudYAbsolute = window.innerHeight - cloudBottomOffsetPixels;
        const heroTop = heroSection.offsetTop;
        const solutionsOffsetTop = solutionsSection.offsetTop;
        const splashYAbsoluteTarget = solutionsOffsetTop + 10;
        const dropStartOffsetAbsolute = heroTop + cloudYAbsolute + 200;
        const dropTravelRange = splashYAbsoluteTarget - dropStartOffsetAbsolute;
        const cycleLength = 0.35;

        dropElements.forEach((drop, index) => {
            const offset = dropTimeOffsets[index];
            let effectiveProgress = (scrollProgress + offset) % cycleLength;
            let normalizedCycleProgress = effectiveProgress / cycleLength;

            if (normalizedFadeOpacity > 0.001) {
                if (normalizedCycleProgress < 0.8) {
                    drop.style.opacity = normalizedFadeOpacity.toFixed(3);
                    drop.classList.remove('splashing');

                    let distanceTraveled = normalizedCycleProgress * dropTravelRange / 0.8;
                    let dropYAbsolute = dropStartOffsetAbsolute + distanceTraveled;
                    let dropYRelative = dropYAbsolute - heroTop;

                    drop.style.transform = `translateY(${dropYRelative}px)`;
                }
                else {
                    const splashYRelative = splashYAbsoluteTarget - heroTop;

                    if (normalizedCycleProgress > 0.8 && normalizedCycleProgress < 0.9) {
                        if (!drop.classList.contains('splashing')) {
                            drop.classList.add('splashing');
                            drop.style.opacity = normalizedFadeOpacity.toFixed(3);
                            drop.style.transform = `translateY(${splashYRelative}px)`;
                        }
                    }

                    if (normalizedCycleProgress >= 0.95) {
                        drop.style.opacity = '0';
                        drop.classList.remove('splashing');
                    }
                }
            } else {
                drop.style.opacity = '0';
            }
        });
    }

    window.addEventListener('scroll', handleScrollRain, { passive: true });
    handleScrollRain();
});
// --- END OF FILE ---q