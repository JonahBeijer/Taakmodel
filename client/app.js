let chatHistory = [];
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const askButton = document.getElementById('askButton');
let currentController = null;
const sessionId = Date.now().toString();

let isRequestInProgress = false;
let pendingRequest = null;

function addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    let formattedContent = content;
    if (content.includes("**")) {
        formattedContent = '';
        const parts = content.split('**');
        for (let i = 0; i < parts.length; i++) {
            formattedContent += i % 2 === 1 ? `<strong>${parts[i]}</strong>` : parts[i];
        }
    }

    if (content.includes("🎌")) {
        messageDiv.innerHTML = `
            <div class="anime-recommendations">
                ${formattedContent.replace(/\n/g, '<br>')
            .replace(/🎌/g, '<div class="anime-card">')
            .replace(/Waarom deze anime past:/g, '<br>📌 Waarom deze anime past:')
            .replace(/Alternatieven/g, '<br>🎬 Alternatieven')
            .replace(/\n\n/g, '</div>')
        }
            </div>
        `;
    } else {
        messageDiv.innerHTML = formattedContent.replace(/\n/g, '<br>');
    }

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

function disableUI() {
    userInput.disabled = true;
    askButton.disabled = true;
    userInput.placeholder = "Even geduld...";
}

function enableUI() {
    userInput.disabled = false;
    askButton.disabled = false;
    userInput.placeholder = "Stel je vraag...";
    userInput.focus();
}

async function askQuestion() {
    const question = userInput.value.trim();
    if (!question) return;

    if (isRequestInProgress) {
        pendingRequest = question;
        addMessage('user', question);
        userInput.value = '';
        return;
    }

    if (currentController) currentController.abort();
    currentController = new AbortController();
    isRequestInProgress = true;

    addMessage('user', question);
    userInput.value = '';
    disableUI();
    showTypingIndicator();

    chatHistory.push({ role: "user", content: question });
    const assistantMessage = addMessage('assistant', '');

    try {
        const response = await fetch('http://localhost:3000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: chatHistory,
                sessionId: sessionId
            }),
            signal: currentController.signal
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                const data = line.replace('data: ', '').trim();
                if (data === '[DONE]') {
                    chatHistory.push({ role: "assistant", content: fullResponse });
                    break;
                }

                try {
                    const parsedData = JSON.parse(data);
                    if (parsedData.token) {
                        fullResponse += parsedData.token;

                        // Herformattering voor anime
                        let displayContent = fullResponse;
                        if (displayContent.includes("**")) {
                            displayContent = '';
                            const parts = fullResponse.split('**');
                            for (let i = 0; i < parts.length; i++) {
                                displayContent += i % 2 === 1 ? `<strong>${parts[i]}</strong>` : parts[i];
                            }
                        }

                        if (fullResponse.includes("🎌")) {
                            assistantMessage.innerHTML = `
                                <div class="anime-recommendations">
                                    ${displayContent.replace(/\n/g, '<br>')
                                .replace(/🎌/g, '<div class="anime-card">')
                                .replace(/Waarom deze anime past:/g, '<br>📌 Waarom deze anime past:')
                                .replace(/Alternatieven/g, '<br>🎬 Alternatieven')
                                .replace(/\n\n/g, '</div>')
                            }
                                </div>
                            `;
                        } else {
                            assistantMessage.innerHTML = displayContent.replace(/\n/g, '<br>');
                        }

                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                } catch (e) {
                    console.error('Parse error:', e);
                }
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Error:", error);
            assistantMessage.textContent = "Fout: Kon geen antwoord genereren";
        }
    } finally {
        hideTypingIndicator();
        enableUI();
        isRequestInProgress = false;

        if (pendingRequest) {
            const nextQuestion = pendingRequest;
            pendingRequest = null;
            userInput.value = nextQuestion;
            askQuestion();
        }
    }
}

askButton.addEventListener('click', () => {
    if (!isRequestInProgress) askQuestion();
});

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isRequestInProgress) {
        askQuestion();
    }
});

setTimeout(() => {
    addMessage('assistant', 'Hallo! Ik ben Aiko, je anime- en nieuwsassistent. Vraag me naar het laatste nieuws!');
}, 1000);

userInput.focus();
