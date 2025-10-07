import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import PizZip from 'pizzip';
import mammoth from 'mammoth';
import libre from 'libreoffice-convert';
import { promisify } from 'util';

export const maxDuration = 60; // Set max duration for serverless function

interface BulletReplacement {
  original: string;
  tailored: string;
}

interface TailoredContent {
  title: string;
  summary: string;
  bullets: BulletReplacement[];
  skills: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const jobDescription = formData.get('jobDescription') as string;
    const cvFile = formData.get('cvFile') as File;

    console.log('Received jobDescription:', jobDescription ? 'Yes' : 'No');
    console.log('Received cvFile:', cvFile ? cvFile.name : 'No');

    if (!jobDescription || !cvFile) {
      return NextResponse.json(
        { error: 'Job description and CV file are required', debug: { hasJob: !!jobDescription, hasFile: !!cvFile } },
        { status: 400 }
      );
    }

    // Read CV file
    const arrayBuffer = await cvFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from Word document for Claude analysis
    const result = await mammoth.extractRawText({ buffer });
    const cvContent = result.value;

    // Use Claude to get tailored content
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY not configured' },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const prompt = `You are an expert CV writer, ATS optimizer, and recruiter. Your job is to make this candidate's CV pass ATS screening AND appeal to human recruiters by HEAVILY CUSTOMIZING it for the specific job.

ORIGINAL CV:
${cvContent}

JOB DESCRIPTION:
${jobDescription}

CRITICAL INSTRUCTIONS - CONCISE & IMPACTFUL:

**WRITING STYLE - Action-focused, impact-driven:**
- Write TIGHT, PUNCHY, FOCUSED content emphasizing RESULTS and IMPACT
- Focus on "I did X, which achieved Y" structure - action → outcome
- Lead with what you DID, follow with the measurable IMPACT
- Eliminate filler words: "in order to", "was able to", "responsible for", "helped to", "worked on"
- Use VARIED, strong action verbs - avoid repeating "Led", "Architected", "Built", "Developed"
- Mix in verbs like: Spearheaded, Drove, Launched, Designed, Scaled, Delivered, Transformed, Optimized, Executed, Pioneered, Established, Created, Implemented
- ALWAYS include numbers/metrics showing impact (revenue, %, users, time saved, etc.)
- Remove job description language - focus on accomplishments and outcomes
- Never use em dashes "—" in any content
- Example BAD: "Responsible for product strategy and team management"
- Example GOOD: "Launched product strategy driving $5M revenue and 40% user growth"

1. **Professional Title & Summary** - Customize both for this role:
   - **Title**: Replace "Product Leader" with the exact job title from the posting (e.g., "Senior Product Manager", "Director of Product", "VP of Product")
   - **Summary**: MAXIMUM 3 lines on page (50-60 words)
   - Mirror the job title and key requirements from the description
   - Include 3-5 critical keywords from the job posting
   - Make it obvious this person is perfect for THIS SPECIFIC ROLE
   - Write tight and impactful - no fluff

2. **Hims, Dropbox, Postmates, and Just Eat Bullets** - HEAVILY customize each:
   - Identify the TOP 3-5 requirements from the job description
   - Rewrite bullets using ACTION → IMPACT structure
   - Focus on what was DONE and the MEASURABLE RESULT
   - Use EXACT keywords from the job posting where truthful
   - Include specific numbers, percentages, dollar amounts, timeframes
   - Avoid describing job duties - highlight achievements and outcomes
   - Make every bullet feel like a success story aligned with this job
   - CRITICAL: Within each job section, bullets must address DIFFERENT aspects (don't repeat themes)
   - For example: one bullet on product launch, one on team/process, one on metrics/optimization
   - Vary the focus: strategy, execution, results, scale, innovation, etc.
   - CRITICAL: Each bullet MUST be MAXIMUM 20-25 words
   - Be ruthlessly concise - action, outcome, numbers
   - ALWAYS use "$" for currency (not "£" or other symbols)
   - Never use em dashes "—"
   - Format: [Strong Verb] [What] [Impact with numbers]

3. **Skills Section** - STRICT ATS optimization requirements:
   - List ONLY 8-10 most relevant TECHNICAL/TOOL skills from job description
   - Focus on: specific technologies, platforms, tools, programming languages, frameworks
   - Prioritize hard skills over soft skills (e.g., "Python" not "Leadership", "Figma" not "Strategic Thinking")
   - Use exact tool/technology names from job posting (e.g., "Tableau", "SQL", "React", "A/B Testing", "Jira")
   - Include certifications or technical methodologies if mentioned (e.g., "Agile", "Scrum")
   - MUST fit on 2 lines maximum (approximately 120-140 characters total including separators)
   - Format: Skill | Skill | Skill with " | " separators
   - These are ATS keywords - be very precise with terminology

4. **ATS Optimization**:
   - Use exact keywords and phrases from job description
   - Match their language style (e.g., "product strategy" vs "strategic planning")
   - Include any certifications or technical skills they mention

Return your response in this EXACT JSON format:
{
  "title": "Exact job title from posting",
  "summary": "Heavily customized summary using job-specific keywords",
  "bullets": [
    {
      "original": "Built engagement platform strategy for GLP-1 treatments, designing patient experience and care workflows that unlocked $XXXM+ incremental revenue in year one.",
      "tailored": "Heavily customized bullet using job description language"
    }
  ],
  "skills": "Only 8-10 skills (2 lines max)"
}

Include ALL bullets from Hims, Dropbox, Postmates, and Just Eat. Return ONLY valid JSON, no additional text.`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse JSON response
    let tailoredContent: TailoredContent;
    try {
      // Remove markdown code blocks if present
      const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      tailoredContent = JSON.parse(jsonText);
    } catch {
      console.error('Failed to parse Claude response:', responseText);
      throw new Error('Failed to parse AI response');
    }

    // Second pass: Polish the content for readability
    const polishPrompt = `You are a professional CV editor. Review the following tailored CV content and make it more natural, readable, and less jargony while maintaining all keywords and metrics.

CONTENT TO POLISH:
Title: ${tailoredContent.title}
Summary: ${tailoredContent.summary}

Bullets:
${tailoredContent.bullets.map((b, i) => `${i + 1}. ${b.tailored}`).join('\n')}

Skills: ${tailoredContent.skills}

INSTRUCTIONS:
- Make the language flow naturally - avoid corporate buzzwords and jargon
- Keep it professional but human-readable
- Maintain ALL numbers, metrics, and technical terms
- Keep ALL ATS keywords from the original
- Fix any awkward phrasing or repetitive language
- Ensure bullets read smoothly and professionally
- Keep the same length or shorter
- Don't add new information - just polish what's there

Return the polished content in this EXACT JSON format:
{
  "title": "polished title",
  "summary": "polished summary",
  "bullets": ["polished bullet 1", "polished bullet 2", ...],
  "skills": "polished skills"
}

Return ONLY valid JSON, no additional text.`;

    const polishMessage = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: polishPrompt,
        },
      ],
    });

    const polishResponseText = polishMessage.content[0].type === 'text'
      ? polishMessage.content[0].text
      : '';

    // Parse polished response
    let polishedContent: { title: string; summary: string; bullets: string[]; skills: string };
    try {
      const polishJsonText = polishResponseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      polishedContent = JSON.parse(polishJsonText);

      // Update tailoredContent with polished versions
      tailoredContent.title = polishedContent.title;
      tailoredContent.summary = polishedContent.summary;
      tailoredContent.skills = polishedContent.skills;

      // Map polished bullets back to original structure
      polishedContent.bullets.forEach((polishedBullet, index) => {
        if (tailoredContent.bullets[index]) {
          tailoredContent.bullets[index].tailored = polishedBullet;
        }
      });
    } catch {
      console.warn('Failed to parse polish response, using original');
      // Continue with original tailoredContent if polish fails
    }

    // Load the docx file as a zip
    const zip = new PizZip(buffer);

    // Get the main document XML
    const documentXml = zip.file('word/document.xml')?.asText();

    if (!documentXml) {
      throw new Error('Could not read document.xml from docx file');
    }

    let modifiedXml = documentXml;

    // Helper function to escape XML special characters
    const escapeXml = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Helper function to find and replace text in XML while preserving structure
    const replaceInXml = (xml: string, original: string, replacement: string): string => {
      // Escape both strings for XML
      const originalEscaped = escapeXml(original);
      const replacementEscaped = escapeXml(replacement);

      // Try direct replacement first
      if (xml.includes(originalEscaped)) {
        return xml.replace(new RegExp(originalEscaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacementEscaped);
      }

      // If not found, the text might be split across multiple <w:t> tags
      // Try to find and replace character by character through text nodes
      // This is a more complex operation but handles split text
      const textNodePattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let fullText = '';
      const matches: { text: string; fullMatch: string; index: number }[] = [];

      let textMatch;
      while ((textMatch = textNodePattern.exec(xml)) !== null) {
        matches.push({
          text: textMatch[1],
          fullMatch: textMatch[0],
          index: textMatch.index
        });
        fullText += textMatch[1];
      }

      if (fullText.includes(original)) {
        // Found the text across nodes, need to reconstruct
        const startIdx = fullText.indexOf(original);
        const endIdx = startIdx + original.length;

        let charCount = 0;
        let startMatch = -1;
        let endMatch = -1;

        for (let i = 0; i < matches.length; i++) {
          const matchLen = matches[i].text.length;
          if (startMatch === -1 && charCount + matchLen > startIdx) {
            startMatch = i;
          }
          if (charCount + matchLen >= endIdx) {
            endMatch = i;
            break;
          }
          charCount += matchLen;
        }

        if (startMatch !== -1 && endMatch !== -1) {
          // Replace the text across the identified nodes
          // For simplicity, we'll replace the first node's text and clear the rest
          let newXml = xml;
          const firstMatch = matches[startMatch];
          const newTextNode = `<w:t xml:space="preserve">${replacementEscaped}</w:t>`;

          // Replace first occurrence
          newXml = newXml.replace(firstMatch.fullMatch, newTextNode);

          // Remove the text from subsequent nodes if they're part of the same phrase
          for (let i = startMatch + 1; i <= endMatch; i++) {
            if (i < matches.length) {
              newXml = newXml.replace(matches[i].fullMatch, '');
            }
          }

          return newXml;
        }
      }

      return xml;
    };

    // Replace the "Product Leader" title with the tailored job title
    const originalTitle = 'Product Leader';
    if (tailoredContent.title) {
      modifiedXml = replaceInXml(modifiedXml, originalTitle, tailoredContent.title);
    }

    // Replace the Product Leader summary
    const summaryPattern = /I build products that improve people's lives by combining strategic thinking with hands-on design and operational\s+expertise\. Over the past decade, I've led product strategy for companies generating \$100M\+ revenue, from early-stage\s+hardware ventures to global platforms serving billions\. I focus on creating seamless experiences that solve real problems\s+while driving business impact\./;

    const originalSummary = cvContent.match(summaryPattern)?.[0] || '';
    if (originalSummary) {
      // Remove em dashes from summary
      const cleanSummary = tailoredContent.summary.replace(/—/g, '-').replace(/–/g, '-');
      modifiedXml = replaceInXml(modifiedXml, originalSummary, cleanSummary);
    }

    // Replace each bullet point
    for (const bullet of tailoredContent.bullets) {
      let tailoredText = bullet.tailored.trim();

      // Remove em dashes from bullets
      tailoredText = tailoredText.replace(/—/g, '-').replace(/–/g, '-');

      // Enforce word count limit (30 words max for 2 lines)
      const wordCount = tailoredText.split(/\s+/).length;
      if (wordCount > 30) {
        console.warn(`Bullet too long (${wordCount} words), truncating to 30 words`);
        const words = tailoredText.split(/\s+/).slice(0, 30);
        tailoredText = words.join(' ') + '.';
      }

      modifiedXml = replaceInXml(modifiedXml, bullet.original.trim(), tailoredText);
    }

    // Replace the Skills section
    const originalSkills = 'Generative AI | LLM Integration | Personalization Algorithms | Customer Data Platforms | Machine Learning | Data Analytics | Go-to-Market (GTM) Strategy | Marketplaces | UX/UI Design | Agile Methodologies | Wireframing | Python | SQL';
    if (tailoredContent.skills) {
      // Enforce character limit for skills (2 lines = ~140 characters max)
      let skills = tailoredContent.skills;
      if (skills.length > 140) {
        console.warn(`Skills too long (${skills.length} chars), truncating to 140`);
        // Split by pipe, take only first 8-10 skills
        const skillList = skills.split(' | ').slice(0, 10);
        skills = skillList.join(' | ');
      }
      modifiedXml = replaceInXml(modifiedXml, originalSkills, skills);
    }

    // Fix dollar sign formatting - remove any special styling that might make it smaller
    // Look for dollar signs that might be in different font sizes or styles
    modifiedXml = modifiedXml.replace(/<w:rPr>[\s\S]*?<\/w:rPr>[\s]*<w:t[^>]*>\$<\/w:t>/g, () => {
      // Replace with clean dollar sign without special formatting
      return '<w:t xml:space="preserve">$</w:t>';
    });

    // Update the document XML in the zip
    zip.file('word/document.xml', modifiedXml);

    // Generate the modified docx buffer
    const modifiedBuffer = zip.generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    // Check if user requested docx format
    const format = formData.get('format') as string || 'pdf';

    let finalBuffer: Buffer;
    let contentType: string;
    let fileExtension: string;

    if (format === 'docx') {
      // Return docx directly
      finalBuffer = modifiedBuffer;
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      fileExtension = '.docx';
    } else {
      // Convert docx to PDF using libreoffice
      const convertAsync = promisify(libre.convert);

      try {
        // Try to convert to PDF
        finalBuffer = await convertAsync(modifiedBuffer, '.pdf', undefined);
        contentType = 'application/pdf';
        fileExtension = '.pdf';
      } catch (conversionError) {
        console.warn('PDF conversion failed, returning docx:', conversionError);
        // Fall back to docx if conversion fails
        finalBuffer = modifiedBuffer;
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        fileExtension = '.docx';
      }
    }

    // Return the file with proper filename
    return new NextResponse(finalBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="Michael Novack CV${fileExtension}"`,
      },
    });

  } catch (error) {
    console.error('Error tailoring CV:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to tailor CV', details: errorMessage },
      { status: 500 }
    );
  }
}
