let chatHistory = []; // Hier bewaren we de chatgeschiedenis

async function askQuestion() {
    const userInput = document.getElementById("userInput").value;

    // Voeg system message toe bij eerste vraag
    if(chatHistory.length === 0) {
        chatHistory.push({
            role: "system",
            content: "You're a helpful assistant"
        });
    }

    // Voeg gebruikersvraag toe aan historie
    chatHistory.push({
        role: "user",
        content: userInput
    });

    try {
        const response = await fetch("http://localhost:3000/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: chatHistory }),
        });

        const data = await response.json();

        // Voeg AI antwoord toe aan historie
        chatHistory.push({
            role: "assistant",
            content: data.message
        });

        updateChatDisplay();

    } catch (error) {
        console.error("Fout:", error);
        document.getElementById("response").innerHTML +=
            `<div class="error">Fout: ${error.message}</div>`;
    }
}

function updateChatDisplay() {
    const container = document.getElementById("response");
    container.innerHTML = chatHistory
        .filter(msg => msg.role !== "system") // Verberg system messages
        .map(msg => `
            <div class="message ${msg.role}">
                <strong>${msg.role}:</strong> 
                ${msg.content}
            </div>
        `).join("");
}

// Event listener voor de knop
document.getElementById("askButton").addEventListener("click", askQuestion);

