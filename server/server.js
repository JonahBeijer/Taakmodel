
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { AzureChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

// Model initialisatie met streaming
const model = new AzureChatOpenAI({
    temperature: 0.7,
    maxTokens: 800,
    frequencyPenalty: 0.2,
    presencePenalty: 0.2,
    streaming: true,
    callbacks: [
        {
            handleLLMNewToken(token) {

            }
        }
    ]
});

// Embeddings voor vector database
const embeddings = new AzureOpenAIEmbeddings({
    azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME
});

const app = express();
app.use(cors());
app.use(express.json());

// Globale variabelen
let vectorStore;
let isVectorStoreReady = false;
const newsMemory = new Set();
const userSessions = new Map();

// Anime database laden
async function loadVectorStore() {
    try {
        // Zorg ervoor dat dit pad correct is voor jouw systeem
        const loader = new TextLoader("C:/Users/jonah/TaalModel-PRG8/public/vectorbestand.txt");
        const docs = await loader.load();

        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200
        });

        const splitDocs = await textSplitter.splitDocuments(docs);
        vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);
        isVectorStoreReady = true;
        console.log("✅ Anime database geladen");
    } catch (error) {
        console.error("❌ Databasefout:", error);
        process.exit(1);
    }
}

// Nieuws ophalen met categorie-filter
async function getFreshNews(category) {
    try {
        const response = await axios.get('https://newsdata.io/api/1/news', {
            params: {
                // Zorg ervoor dat je API-sleutel geldig en actief is
                apikey: process.env.NEWSDATA_API,
                country: 'nl',
                language: 'nl',
                category: category,
            }
        });

        if (!response.data.results) {
            console.warn("API gaf geen 'results' array terug.");
            return [];
        }

        return response.data.results.filter(article =>
            article.title &&
            article.description &&
            article.description.length > 50 &&
            article.link &&
            !newsMemory.has(article.title)
        );
    } catch (error) {
        console.error('❌ Nieuwsfout:', error.response ? error.response.data : error.message);
        return [];
    }
}

// Anime aanbevelingen zoeken
async function findRelatedAnime(themes, count = 5) {
    if (!isVectorStoreReady) {
        console.warn("Vector store niet geladen!");
        return [];
    }
    try {
        const query = themes.join(", ");
        const results = await vectorStore.similaritySearch(query, count);

        return results.map(doc => {
            const content = doc.pageContent;
            const animeData = {};
            content.split('\n').forEach(line => {
                if (line.startsWith('Titel:')) animeData.title = line.replace('Titel:', '').trim();
                else if (line.startsWith('Jaar:')) animeData.year = line.replace('Jaar:', '').trim();
                else if (line.startsWith('Thema:')) animeData.theme = line.replace('Thema:', '').trim();
                else if (line.startsWith('Beschrijving:')) animeData.description = line.replace('Beschrijving:', '').trim();
            });
            return {
                title: animeData.title || 'Onbekende titel',
                year: animeData.year || '?',
                theme: animeData.theme || 'Geen thema gespecificeerd',
                description: animeData.description || 'Geen beschrijving beschikbaar.',
            };
        });
    } catch (error) {
        console.error("❌ Zoekfout:", error);
        return [];
    }
}

// Belangrijke thema's extraheren
function extractThemes(article) {
    const importantKeywords = [
        ...(article.keywords || []),
        ...article.title.split(/\s+/).filter(word => word.length > 3),
        ...(article.description ? article.description.split(/\s+/) : [])
    ];

    const stopWords = new Set(['de', 'het', 'een', 'en', 'in', 'op', 'voor', 'van', 'met', 'is', 'te', 'zijn']);
    return [...new Set(importantKeywords)]
        .map(word => word.toLowerCase().replace(/[.,!?]/g, '')) // Normaliseer woorden
        .filter(word => word && word.length > 3 && !stopWords.has(word))
        .slice(0, 5);
}

// Streaming response handler
async function handleStreamingResponse(res, stream, session, role = "assistant", delayMs = 20) {
    const controller = new AbortController();
    const signal = controller.signal;
    let fullResponse = '';
    let isFirstToken = true;

    res.on('close', () => {
        if (!signal.aborted) {
            controller.abort();
            console.log("🔌 Streaming afgebroken door client");
        }
    });

    try {
        for await (const chunk of stream) {
            if (signal.aborted) break;
            if (chunk.content) {
                const token = chunk.content;
                fullResponse += token;
                const currentDelay = isFirstToken ? delayMs * 3 : delayMs;
                await new Promise(resolve => setTimeout(resolve, currentDelay));
                isFirstToken = false;
                if (!res.writableEnded) {
                    res.write(`data: ${JSON.stringify({ token })}\n\n`);
                }
            }
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("❌ Streamfout:", error);
            if (!res.writableEnded) {
                res.write('data: {"token": " Oeps, er ging iets mis tijdens het genereren."}\n\n');
            }
        }
    } finally {
        if (!signal.aborted && !res.writableEnded) {
            res.write('data: [DONE]\n\n');
            session.conversationHistory.push({ role, content: fullResponse });
        }
        if (!res.writableEnded) {
            res.end();
        }
    }
}

/**
 * Bepaalt de intentie van de gebruiker met behulp van het taalmodel.
 * @param {Array<object>} conversationHistory - De geschiedenis van het gesprek.
 * @param {string} userMessage - Het laatste bericht van de gebruiker.
 * @returns {Promise<string>} De vastgestelde intentie ('GET_NEWS', 'GET_ANIME', 'FOLLOW_UP', 'GENERAL_CHAT').
 */
async function getIntent(conversationHistory, userMessage) {
    // We gebruiken alleen de laatste 4 berichten voor een beknopte context
    const history = conversationHistory.slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n');

    const routerPrompt = `
Je bent een expert intentie-classifier. Analyseer het laatste bericht van de gebruiker ("user") in de context van de recente gespreksgeschiedenis.
Classificeer de intentie in EEN van de volgende vier categorieën. Je antwoord mag UITSLUITEND een van deze vier woorden zijn.

CATEGORIEËN:
1.  GET_NEWS: De gebruiker wil een nieuw, vers nieuwsartikel horen. Dit geldt voor zinnen als "geef me het nieuws", "een ander artikel", "iets over politiek".
2.  GET_ANIME: De gebruiker wil een of meer anime-aanbevelingen die passen bij het HUIDIGE nieuwsartikel.
3.  FOLLOW_UP: De gebruiker stelt een verdiepende vraag over wat de assistent Zojuist heeft gezegd. Dit geldt voor zinnen als "waarom past die?", "geef meer uitleg daarover", "vertel meer over het eerste punt", "wat bedoel je daarmee?".
4.  GENERAL_CHAT: Alle andere conversatie. Begroetingen, algemene vragen, of opmerkingen die niet direct in de andere categorieën vallen.

---
CONVERSATIEGESCHIEDENIS:
${history}
---
LAATSTE BERICHT VAN GEBRUIKER:
"${userMessage}"
---

Welke categorie is dit? Geef alleen het woord.`;

    // Gebruik een apart, klein model voor snelle classificatie indien beschikbaar, of het hoofdmodel
    const routerModel = new AzureChatOpenAI({ temperature: 0, maxTokens: 10 });
    const response = await routerModel.invoke([new SystemMessage(routerPrompt)]);
    const intent = response.content.trim().replace('.', ''); // Verwijder eventuele punten

    // Validatie om zeker te zijn dat het model een van de vier opties teruggeeft
    const validIntents = ['GET_NEWS', 'GET_ANIME', 'FOLLOW_UP', 'GENERAL_CHAT'];
    if (validIntents.includes(intent)) {
        console.log(`🤖 Intentie vastgesteld: ${intent}`);
        return intent;
    }

    console.warn(`❗️ Onbekende intentie ontvangen: "${intent}". Valt terug op GENERAL_CHAT.`);
    return 'GENERAL_CHAT'; // Fallback voor als de AI iets anders teruggeeft
}


app.post('/chat', async (req, res) => {
    const { messages, sessionId } = req.body;
    if (!messages || messages.length === 0 || !sessionId) {
        return res.status(400).json({ error: 'Foute request: "messages" en "sessionId" zijn verplicht.' });
    }
    const userMessage = messages[messages.length - 1].content;

    if (!userSessions.has(sessionId)) {
        userSessions.set(sessionId, {
            currentNews: null,
            currentThemes: null,
            conversationHistory: []
        });
    }
    const session = userSessions.get(sessionId);

    // Bepaal de intentie VOORDAT we het bericht aan de geschiedenis toevoegen
    const intent = await getIntent(session.conversationHistory, userMessage);

    // Voeg het bericht nu pas toe aan de geschiedenis
    session.conversationHistory.push({ role: "user", content: userMessage });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        switch (intent) {
            case 'GET_NEWS':
                let category = 'politics,technology,science,health,entertainment';
                const categoryMap = { 'politiek': 'politics', 'technologie': 'technology', 'wetenschap': 'science', 'gezondheid': 'health', 'entertainment': 'entertainment' };
                for (const [keyword, apiCategory] of Object.entries(categoryMap)) {
                    if (userMessage.toLowerCase().includes(keyword)) { category = apiCategory; break; }
                }
                const articles = await getFreshNews(category);
                if (articles.length === 0) {
                    return res.end('data: {"token": "Helaas kon ik op dit moment geen passend nieuws vinden."}\n\ndata: [DONE]\n\n');
                }
                const article = articles.reduce((best, current) => (current.description.length > best.description.length) ? current : best);
                newsMemory.add(article.title);
                session.currentNews = article;
                session.currentThemes = extractThemes(article);

                const newsSystemPrompt = `Vat dit nieuwsartikel samen: "${article.title}: ${article.description}". Sluit af met de vraag: "Waar wil je het over hebben, of wil je misschien passende anime-aanbevelingen?"`;
                const streamNews = await model.stream([new SystemMessage(newsSystemPrompt)]);
                return handleStreamingResponse(res, streamNews, session);

            case 'GET_ANIME':
                if (!session.currentNews) {
                    return res.end('data: {"token": "Ik heb nog geen nieuwsartikel om een aanbeveling op te baseren. Vraag me eerst om het nieuws!"}\n\ndata: [DONE]\n\n');
                }
                const animeRecommendations = await findRelatedAnime(session.currentThemes, 2);
                if (animeRecommendations.length === 0) {
                    return res.end('data: {"token": "Helaas, ik kon geen passende anime vinden bij dit specifieke nieuwsartikel."}\n\ndata: [DONE]\n\n');
                }
                const animeSystemPrompt = `Je bent Gon, een anime-expert. Het nieuws is "${session.currentNews.title}". Geef aanbevelingen op basis van: ${JSON.stringify(animeRecommendations)}. Leg per anime in 1-2 zinnen uit waarom het past bij de thema's van het nieuws (zoals technologie, hacking, samenwerking).`;
                const streamAnime = await model.stream([new SystemMessage(animeSystemPrompt)]);
                return handleStreamingResponse(res, streamAnime, session);

            case 'FOLLOW_UP':
            case 'GENERAL_CHAT':
            default:
                const contextPrompt = `
Je bent Gon, een vriendelijke en behulpzame AI-assistent.
Huidig nieuwsartikel in sessie: "${session.currentNews?.title || 'geen'}"

TAAK: Beantwoord de laatste vraag van de gebruiker op basis van de gespreksgeschiedenis.
- Als de vraag een verduidelijking is ("waarom", "leg uit", "vertel meer"), baseer je antwoord dan VOLLEDIG op de vorige berichten.
- Als het een algemene vraag is, voer dan een normaal, behulpzaam gesprek.

GESCHIEDENIS:
${session.conversationHistory.slice(-6).map(msg => `${msg.role}: ${msg.content}`).join('\n')}
`;
                const streamGeneral = await model.stream([
                    new SystemMessage(contextPrompt)
                ]);
                return handleStreamingResponse(res, streamGeneral, session);
        }
    } catch (error) {
        console.error("❌ Chatfout:", error);
        if (!res.writableEnded) {
            res.end('data: {"token": "Oeps, er is een interne fout opgetreden."}\n\ndata: [DONE]\n\n');
        }
    }
});

// Server starten
loadVectorStore().then(() => {
    app.listen(3000, () => {
        console.log('🚀 Server draait op http://localhost:3000');
    });
});
