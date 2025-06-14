# Gon - AI Nieuws & Anime Assistent

Dit is een LLM project met Azure OpenAI voor een AI-chatbot genaamd Gon.

Het project is gemaakt met Vanilla Javascript en Node.js/Express en gebruikt Langchain en AZURE.

## installatie

Voor het gebruiken van het project moet je een aantal dingen hebben geinstalleerd:

- Node.js
- npm
- Git

Daarna kun je de github repo clonen in je eigen editor. Het project werkt alleen lokaal. Open een terminal in de hoofdmap van het project.

**Installeer de benodigde packages:**
```bash
npm install express cors axios @langchain/openai @langchain/community langchain dotenv

Dit installeert alles wat de server nodig heeft.

env
De backend gebruikt een .env bestand. Hier moeten je API sleutels voor AZURE en de Nieuws API in.
Deze zal je zelf moeten aanmaken in de server directory aangezien er gevoelige informatie in staat.

Hierin moet staan:

# Azure OpenAI Credentials
AZURE_OPENAI_API_KEY="..."
AZURE_OPENAI_API_INSTANCE_NAME="..."
AZURE_OPENAI_API_DEPLOYMENT_NAME="..."
AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME="..."
AZURE_OPENAI_API_VERSION="2023-07-01-preview"

# NewsData.io API Key
NEWSDATA_API_KEY="..."
Vervang de ... door je eigen API keys.

belangrijke aanpassingen
! let op: je moet 3 kleine aanpassingen maken in server.js om het project te laten werken !

Laad de .env variabelen: Voeg deze regel helemaal bovenaan server.js toe:

starten & gebruiken
1. Start de server: Open je terminal in de projectmap en type:

Bash

node server.js
Dit start de backend. Je ziet 🚀 Server draait op http://localhost:3000 als het goed is.

2. Open de client: Ga naar je projectmap en open het index.html bestand gewoon in je browser.

Hoe praat je met Gon? De bot werkt het beste als je een logische volgorde aanhoudt.

Start door te vragen naar het nieuws. Bijvoorbeeld: "geef me het laatste nieuws"
Vraag daarna om een aanbeveling. Bijvoorbeeld: "geef een passende anime bij dit nieuws"
Test de AI met een vervolgvraag! Bijvoorbeeld: "waarom past die aanbeveling erbij?"
PS. Je hoeft niet precies deze zinnen te gebruiken! De bot gebruikt een slimme "AI-Router" om te snappen wat je bedoelt, dus experimenteer gerust.

opmerkingen
De kwaliteit van de anime-aanbevelingen hangt volledig af van hoe goed je vectorbestand.txt is. Betere beschrijvingen = betere aanbevelingen.
De AI-Router is slim, maar kan soms een gek antwoord geven als je vraag heel onduidelijk is. Meestal werkt het echter verrassend goed!
Het project is bedoeld om lokaal te draaien.