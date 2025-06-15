# Gon - AI Nieuws & Anime Assistent

Dit is een LLM project met Azure OpenAI voor een AI-chatbot genaamd Gon.
Het project is gemaakt met **Javascript + Vite (Client)** en **Node.js/Express (Server)** en gebruikt **LangChain**.

## Installatie

Voor je het project kunt gebruiken, moet je geïnstalleerd hebben:
- Node.js
- npm
- Git

Clone daarna de repository en volg de stappen voor de **server** en de **client**.

### 1. Server Setup (Backend)

Open een terminal en navigeer naar de `/server` map:

```bash
# Ga naar de server map
cd server

# Installeer de packages
npm install express cors axios @langchain/openai @langchain/community langchain

# Maak een .env bestand aan in de /server map
# en vul het met je API sleutels (zie hieronder)

Inhoud van .env bestand (in /server map):

# Azure OpenAI Credentials
AZURE_OPENAI_API_KEY="..."
AZURE_OPENAI_API_INSTANCE_NAME="..."
AZURE_OPENAI_API_DEPLOYMENT_NAME="..."
AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME="..."
AZURE_OPENAI_API_VERSION="..."

# NewsData.io API Key
NEWSDATA_API="..."

```


### 2. Client Setup (Frontend)
````bash
Open een tweede, aparte terminal en navigeer naar de /client map:
# Ga naar de client map
cd client

# Installeer de packages
npm install

Starten & Gebruiken
Je hebt twee terminals tegelijk nodig om het project te draaien.

1. Start de server:
In je eerste terminal (in de /server map):

npm run server.js

De server draait nu op http://localhost:3000.

2. Start de client:
In je tweede terminal (in de /client map):



npm run dev
Vite zal nu een lokale URL tonen (meestal http://localhost:5173). Open deze URL in je browser.

````

### Hoe praat je met Gon?
De bot werkt het beste als je een logische volgorde aanhoudt:

Start met vragen om nieuws: "geef me het laatste nieuws"
Vraag daarna om een aanbeveling: "geef een passende anime bij dit nieuws"
Test de AI met een vervolgvraag: "waarom past die aanbeveling erbij?"

### Opmerkingen
De kwaliteit van de anime-aanbevelingen hangt volledig af van de inhoud van je vectorbestand.txt.
De AI is slim, maar kan soms een gek antwoord geven als een vraag heel onduidelijk is.