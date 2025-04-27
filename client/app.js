let chatHistory = [];
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const askButton = document.getElementById('askButton');
let currentController = null;

function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.innerHTML = content;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

function addNewsStory(storyContent) {
    const storyDiv = document.createElement('div');
    storyDiv.className = 'message assistant-message news-story';
    storyDiv.innerHTML = `
        <div class="verhaal-header">
            <h3 class="verhaal-titel">🗞️ Nieuws Update</h3>
            <div class="verhaal-inhoud">${storyContent}</div>
        </div>
    `;
    chatMessages.appendChild(storyDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
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
    if (currentController) {
        currentController.abort();
    }
    currentController = new AbortController();

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
    const baseDelay = 100;
    const randomVariation = 25;

    try {
        const response = await fetch('http://localhost:3000/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // In de askQuestion functie:
            body: JSON.stringify({
                messages: chatHistory,
                context: chatHistory.slice(-15) // Meer context behouden
            }),
            signal: currentController.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

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
                    const parsedData = JSON.parse(data);

                    if (parsedData.story) {
                        hideTypingIndicator();
                        addNewsStory(parsedData.story);
                    }
                    else if (parsedData.token) {
                        typingDelay += baseDelay + Math.random() * randomVariation;
                        setTimeout(() => {
                            fullResponse += parsedData.token;
                            assistantMessage.innerHTML = fullResponse + '<span class="typing-cursor">|</span>';
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }, typingDelay);
                    }
                    else if (parsedData.error) {
                        hideTypingIndicator();
                        assistantMessage.textContent = parsedData.error;
                    }

                } catch (e) {
                    console.error('Parse error:', e);
                }
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Error:", error);
            hideTypingIndicator();
            assistantMessage.textContent = "Fout: Kon geen antwoord genereren";
        }
    } finally {
        currentController = null;
        setTimeout(() => {
            askButton.disabled = false;
        }, typingDelay + 100);
    }
}

askButton.addEventListener('click', askQuestion);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') askQuestion();
});

userInput.focus();