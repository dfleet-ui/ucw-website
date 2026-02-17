UCW Website (Netlify-ready)

This package is set up for:
- Static hosting (index.html)
- A serverless function to securely call the Gemini API (netlify/functions/gemini.js)

How to deploy (recommended):
1) Put this folder into a Git repo (GitHub is easiest).
2) In Netlify: Add new site → Import from Git → pick the repo.
   - Build command: (leave blank)
   - Publish directory: .
   Netlify will deploy your site and the function automatically.

Configure the AI key (required for the AI widgets):
- In Netlify: Site configuration → Environment variables
- Add: GEMINI_API_KEY = <your API key from Google AI Studio>

The front-end calls:
  /.netlify/functions/gemini

That serverless function forwards your prompt + chat history to Gemini via:
  https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent

Notes:
- Your API key stays on Netlify (server-side) and is never exposed in the browser.
- Default model used by the site: gemini-2.5-flash-lite (you can change it inside index.html).
