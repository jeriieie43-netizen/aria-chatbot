# Aria — Chatbot IA

Chatbot conversationnel avec interface web propre, propulsé par l'API gratuite Groq (modèles Llama open-source), en streaming.

Groq ne demande pas de carte bancaire pour la clé API gratuite : https://console.groq.com/keys

## Structure

```
ai-chatbot/
├── server.js          # Backend Express (appelle l'API Anthropic, streaming SSE)
├── package.json
├── .env.example        # Variables d'environnement à copier en .env
└── public/
    ├── index.html       # Interface
    ├── style.css        # Design
    └── script.js        # Logique du chat côté navigateur
```

## Lancer en local

```bash
npm install
cp .env.example .env
# Ouvre .env et colle ta clé API Groq (gratuite, sans carte bancaire)
npm start
```

Puis ouvre http://localhost:3000

## Déployer en ligne (Render.com, gratuit)

Voir le guide détaillé fourni dans la conversation. En résumé :
1. Pousser ce dossier sur un dépôt GitHub.
2. Créer un Web Service sur Render.com relié à ce dépôt.
3. Build command : `npm install` — Start command : `npm start`.
4. Ajouter la variable d'environnement `GROQ_API_KEY` dans Render.
5. Déployer — l'app est en ligne sur une URL `https://ton-app.onrender.com`.

## Personnalisation

- **Nom/branding** : change "Aria" dans `index.html` et les couleurs dans `style.css` (variables `:root`).
- **Personnalité de l'IA** : modifie `SYSTEM_PROMPT` dans `.env`.
- **Modèle** : change `GROQ_MODEL` dans `.env` (ex: `llama-3.3-70b-versatile` pour la qualité, `llama-3.1-8b-instant` pour la vitesse).
