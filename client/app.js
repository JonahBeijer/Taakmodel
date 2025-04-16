import { SYSTEM_PROMPT } from '../promptConfig.js';

let chatHistory = [];
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const askButton = document.getElementById('askButton');
let currentStream = null;

function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.innerHTML = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) typingIndicator.remove();
}

async function askQuestion() {
    const question = userInput.value.trim();
    if (!question) return;

    addMessage('user', question);
    userInput.value = '';
    askButton.disabled = true;

    chatHistory.push({ role: "user", content: question });
    const assistantMessage = addMessage('assistant', '');
    showTypingIndicator();

    let fullResponse = '';
    let typingDelay = 0;
    const baseDelay = 100; // Basis delay tussen tokens (ms)
    const randomVariation = 25; // Willekeurige variatie

    try {
        const response = await fetch('http://localhost:3000/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatHistory }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.trim());

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                const data = line.replace('data: ', '');
                if (data === '[DONE]') {
                    chatHistory.push({ role: "assistant", content: fullResponse });
                    hideTypingIndicator();
                    assistantMessage.innerHTML = fullResponse;
                    return;
                }

                try {
                    const { token } = JSON.parse(data);
                    if (token) {
                        // Voeg vertraging toe met kleine variatie
                        typingDelay += baseDelay + Math.random() * randomVariation;

                        setTimeout(() => {
                            fullResponse += token;
                            assistantMessage.innerHTML = fullResponse + '<span class="typing-cursor">|</span>';
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }, typingDelay);
                    }
                } catch (e) {
                    console.error('Parse error:', e);
                }
            }
        }
    } catch (error) {
        console.error("Error:", error);
        hideTypingIndicator();
        assistantMessage.textContent = "Fout: Kon geen antwoord genereren";
    } finally {
        setTimeout(() => {
            askButton.disabled = false;
        }, typingDelay + 100); // Wacht tot laatste token is weergegeven
    }
}
// Event listeners
askButton.addEventListener('click', askQuestion);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') askQuestion();
});

userInput.focus();