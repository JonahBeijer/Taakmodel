import express from 'express'
import cors from 'cors'
import { AzureChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";

const model = new AzureChatOpenAI({ temperature: 1.2 });

const app = express()
app.use(cors())
app.use(express.json());
app.use(express.urlencoded({extended: true}));


app.get('/', async (req, res) => {
    const result = await tellJoke()
    res.json({ message: result })
})

// Vervang beide POST handlers door deze ene:
app.post('/', async (req, res) => {
    try {
        // Probeer zowel 'prompt' als 'messages' te ondersteunen
        const { prompt, messages } = req.body;

        if (messages) {
            // Chat historie mode
            const langchainMessages = messages.map(msg => {
                switch(msg.role) {
                    case "system": return new SystemMessage(msg.content);
                    case "user": return new HumanMessage(msg.content);
                    case "assistant": return new AIMessage(msg.content);
                    default: throw new Error(`Onbekend rol type: ${msg.role}`);
                }
            });
            const result = await model.invoke(langchainMessages);
            return res.json({ message: result.content });
        }

        if (prompt) {
            // Enkele prompt mode
            const result = await model.invoke(prompt);
            return res.json({ message: result.content });
        }

        res.status(400).json({ message: "Prompt of messages vereist" });

    } catch (error) {
        console.error("Fout:", error);
        res.status(500).json({ message: error.message || "Server error" });
    }
});
async function tellJoke() {
    const joke = await model.invoke("Tell me a Minecraft joke!")
    return joke.content
}


app.post('/', async (req, res) => {
    try {
        const messages = req.body?.messages;

        // Valideer de messages array
        if (!Array.isArray(messages)) {
            return res.status(400).json({
                message: "Ongeldig bericht formaat"
            });
        }

        // Converteer naar LangChain message objecten
        const langchainMessages = messages.map(msg => {
            switch(msg.role) {
                case "system":
                    return new SystemMessage(msg.content);
                case "user":
                    return new HumanMessage(msg.content);
                case "assistant":
                    return new AIMessage(msg.content);
                default:
                    throw new Error(`Onbekend rol type: ${msg.role}`);
            }
        });

        // Stuur de volledige chat historie naar AI
        const result = await model.invoke(langchainMessages);

        res.json({
            message: result.content
        });

    } catch (error) {
        console.error("Chat fout:", error);
        res.status(500).json({
            message: error.message || "Server error"
        });
    }
});

app.listen(3000, () => console.log(`Server running on http://localhost:3000`))