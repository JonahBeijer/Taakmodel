import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { AzureChatOpenAI, AzureOpenAIEmbeddings } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { storyPrompt } from '../promptConfig.js';

const model = new AzureChatOpenAI({
    temperature: 0.4,
    maxTokens: 1200,
    frequencyPenalty: 0.2,
    streaming: true
});

const embeddings = new AzureOpenAIEmbeddings({
    temperature: 0,
    azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME
});

const app = express();
app.use(cors());
app.use(express.json());

let vectorStore;
let isVectorStoreReady = false;

async function initializeVectorStore() {
    try {
        const loader = new TextLoader("C:/Users/jonah/TaalModel-PRG8/public/vectorbestand.txt");
        const docs = await loader.load();

        if (docs.length === 0) {
            throw new Error("Geen documenten geladen uit vectorbestand.txt");
        }

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
        });

        const splitDocs = await textSplitter.splitDocuments(docs);
        vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);
        isVectorStoreReady = true;
        console.log("Vectorstore succesvol geladen");
    } catch (error) {
        console.error("Vectorstore initialisatiefout:", error);
        process.exit(1);
    }
}

initializeVectorStore().then(() => {
    app.listen(3000, () => {
        console.log('Server draait op http://localhost:3000');
        console.log(`Vectorstore status: ${isVectorStoreReady ? 'Klaar' : 'Niet klaar'}`);
    });
});

async function fetchNews() {
    try {
        const response = await axios.get('https://newsdata.io/api/1/news', {
            params: {
                apikey: 'pub_81002b6ed8566a206e80849484a99d001fad0',
                country: 'nl',
                language: 'nl',
                category: 'politics,technology,science,health'
            }
        });
        return response.data.results.slice(0, 3);
    } catch (error) {
        console.error('Nieuws API Fout:', error);
        return null;
    }
}

app.post('/stream', async (req, res) => {
    if (!isVectorStoreReady) {
        return res.status(503).json({ error: "Vectorstore nog niet geladen" });
    }

    try {
        const { messages, context } = req.body;
        const latestMessage = messages[messages.length - 1]?.content?.toLowerCase();

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Handle news request
        if (latestMessage.includes('nieuws')) {
            const newsArticles = await fetchNews();
            if (!newsArticles) {
                res.write('data: {"error": "⚠️ Kon het nieuws niet ophalen"}\n\n');
                res.write('data: [DONE]\n\n');
                return res.end();
            }

            const selectedArticle = newsArticles[0];
            let animeRecommendations = [];

            try {
                animeRecommendations = await vectorStore.similaritySearch(
                    `${selectedArticle.title} ${selectedArticle.description}`, 3
                );
            } catch (searchError) {
                console.error("Anime search error:", searchError);
            }

            const verifiedAnimeList = animeRecommendations.map(doc => {
                const lines = doc.pageContent.split('\n');
                return {
                    title: lines[0].replace('Titel: ', '').trim(),
                    jaar: lines[1].replace('Jaar: ', '').trim(),
                    theme: lines[2].replace('Thema: ', '').trim(),
                    details: lines.slice(3).join('\n')
                };
            });

            const storyPromptWithContext = `${storyPrompt}
                **Nieuwsartikel**:
                Titel: ${selectedArticle.title}
                Beschrijving: ${selectedArticle.description.substring(0, 250)}
                
                **Anime uit database**:
                ${verifiedAnimeList.map(a =>
                `- ${a.title} (${a.jaar}): ${a.theme}`
            ).join('\n')}
                
                **Instructies**:
                1. Max 1 alinea nieuwssamenvatting
                2. Identificeer 2-3 hoofdthema's
                3. Link anime's aan deze thema's
                4. Gebruik anime-details uit database`;

            const stream = await model.stream([
                new SystemMessage(storyPromptWithContext),
                new HumanMessage(`Geef een nieuwsupdate en anime-aanraders. Bron: ${selectedArticle.link}`)
            ]);

            let fullStory = '';
            for await (const chunk of stream) {
                const token = chunk.content;
                const mentionedAnime = verifiedAnimeList.some(anime =>
                    token.toLowerCase().includes(anime.title.toLowerCase())
                );

                if(!mentionedAnime && token.match(/anime|serie/i)) {
                    res.write(`data: ${JSON.stringify({ error: "⚠️ Anime niet in database" })}\n\n`);
                    continue;
                }

                res.write(`data: ${JSON.stringify({ token })}\n\n`);
                fullStory += token;
            }

            res.write('data: [DONE]\n\n');
            return res.end();
        }

        // Handle normal questions with context
        const mentionedAnimeTitles = context.flatMap(msg =>
            msg.content.match(/(?<=- )[A-Za-z0-9 ]+(?= \()/g) || []
        );

        let contextText = '';
        if(mentionedAnimeTitles.length > 0) {
            const titleResults = await vectorStore.similaritySearch(mentionedAnimeTitles.join(' '), 2);
            contextText += 'Eerder besproken anime:\n' + titleResults.map(d => {
                const lines = d.pageContent.split('\n');
                return `- ${lines[0]} (${lines[1]})\n  ${lines[2]}\n  ${lines.slice(3).join('\n')}`;
            }).join('\n');
        }

        const questionResults = await vectorStore.similaritySearch(latestMessage, 3);
        contextText += '\n\nRelevante informatie:\n' + questionResults.map(d => d.pageContent).join('\n\n');

        const enhancedPrompt = `${storyPrompt}
            **Conversatiecontext**:
            ${context.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

            **Database informatie**:
            ${contextText.substring(0, 1000)}

            **Antwoordrichtlijnen**:
            1. Gebruik alleen onderstaande informatie
            2. Leg verband met eerder genoemde anime's
            3. Varieer in uitlegstijl
            4. Max 2 alinea's`;

        const chatStream = await model.stream([
            new SystemMessage(enhancedPrompt),
            new HumanMessage(latestMessage)
        ]);

        for await (const chunk of chatStream) {
            const token = chunk.content;
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error("Streaming fout:", error);
        res.write('data: {"error": "⚠️ Er ging iets mis tijdens het genereren"}\n\n');
        res.write('data: [DONE]\n\n');
        res.end();
    }
});