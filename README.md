# CV Matcher

An AI-powered web application that tailors your CV to match job descriptions using Claude AI.

## Features

- 📝 Extract job descriptions from any URL
- 🤖 AI-powered CV tailoring using Claude
- 📄 Download as PDF or text
- 🎨 Clean, modern UI
- 🔒 Secure - no data stored

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
ANTHROPIC_API_KEY=your-api-key-here
```

3. Run development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push to GitHub
2. Connect to Vercel
3. Add environment variable `ANTHROPIC_API_KEY`
4. Deploy!

## Usage

1. Enter the URL of a job posting
2. Upload your CV (Word document)
3. Click "Tailor CV"
4. Download the tailored CV as PDF or text

## How It Works

1. **Extract**: Fetches and parses the job posting HTML
2. **Tailor**: Uses Claude AI to rewrite your CV emphasizing relevant experience
3. **Export**: Generates downloadable PDF via browser print or text file

The AI maintains truthfulness - it won't fabricate experience, just reorders and emphasizes relevant skills to match the job requirements.
