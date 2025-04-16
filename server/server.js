import express from 'express';
import cors from 'cors';
import { AzureChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { SYSTEM_PROMPT } from '../promptConfig.js';

const model = new AzureChatOpenAI({
    temperature: 0.3,
    maxTokens: 100,
    frequencyPenalty: 0.5,
    streaming: true
});

const app = express();
app.use(cors());
app.use(express.json());

app.post('/stream', async (req, res) => {
    try {
        const { messages } = req.body;

        const langchainMessages = [
            new SystemMessage(SYSTEM_PROMPT),
            ...messages.filter(msg => ['user', 'assistant'].includes(msg.role))
                .map(msg => msg.role === 'user'
                    ? new HumanMessage(msg.content)
                    : new AIMessage(msg.content))
        ];

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = await model.stream(langchainMessages);

        // Stuur elk token direct zonder batch
        for await (const chunk of stream) {
            const token = chunk.content;
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }



        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error("Streaming error:", error);
        res.write('data: {"error": "Streaming failed"}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));