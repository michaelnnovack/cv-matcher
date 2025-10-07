import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Readable } from 'stream';
import mammoth from 'mammoth';

export const maxDuration = 60; // Set max duration for serverless function

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const jobDescription = formData.get('jobDescription') as string;
    const cvFile = formData.get('cvFile') as File;

    if (!jobDescription || !cvFile) {
      return NextResponse.json(
        { error: 'Job description and CV file are required' },
        { status: 400 }
      );
    }

    // Read CV file
    const arrayBuffer = await cvFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from Word document
    const result = await mammoth.extractRawText({ buffer });
    const cvContent = result.value;

    // Use Claude to tailor CV
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const prompt = `You are an expert CV writer. Given the candidate's CV and a job description, rewrite the CV to better match the job requirements while maintaining truthfulness.

ORIGINAL CV:
${cvContent}

JOB DESCRIPTION:
${jobDescription}

Instructions:
1. Maintain all truthful information - do not fabricate experience
2. Reorder and emphasize relevant experience that matches the job
3. Adjust language to mirror keywords from the job description
4. Highlight relevant skills and accomplishments
5. Keep the same overall structure and sections
6. Return ONLY the tailored CV content in plain text format, no additional commentary

Provide the tailored CV:`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const tailoredCV = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    return NextResponse.json({ tailoredCV });
  } catch (error) {
    console.error('Error tailoring CV:', error);
    return NextResponse.json(
      { error: 'Failed to tailor CV' },
      { status: 500 }
    );
  }
}
