'use client';

import { useState } from 'react';

export default function Home() {
  const [jobUrl, setJobUrl] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'processing' | 'complete'>('input');
  const [tailoredCV, setTailoredCV] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setStep('processing');

    try {
      // Step 1: Extract job description
      const extractResponse = await fetch('/api/extract-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl }),
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract job description');
      }

      const { jobDescription } = await extractResponse.json();

      // Step 2: Tailor CV
      const formData = new FormData();
      formData.append('jobDescription', jobDescription);
      formData.append('cvFile', cvFile!);

      const tailorResponse = await fetch('/api/tailor-cv', {
        method: 'POST',
        body: formData,
      });

      if (!tailorResponse.ok) {
        throw new Error('Failed to tailor CV');
      }

      const { tailoredCV: cv } = await tailorResponse.json();
      setTailoredCV(cv);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    // Create a simple PDF using browser print
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Michael Novack CV</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 40px auto;
                padding: 20px;
                line-height: 1.6;
              }
              h1, h2, h3 { margin-top: 20px; }
              @media print {
                body { margin: 0; padding: 20px; }
              }
            </style>
          </head>
          <body>
            <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${tailoredCV}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadText = () => {
    const blob = new Blob([tailoredCV], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Michael_Novack_CV.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setJobUrl('');
    setCvFile(null);
    setTailoredCV('');
    setStep('input');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            CV Matcher
          </h1>
          <p className="text-gray-600 mb-8">
            Tailor your CV to match any job description using AI
          </p>

          {step === 'input' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="jobUrl"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Job Posting URL
                </label>
                <input
                  type="url"
                  id="jobUrl"
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  placeholder="https://example.com/job-posting"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="cvFile"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Your CV (Word Document)
                </label>
                <input
                  type="file"
                  id="cvFile"
                  accept=".docx,.doc"
                  onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Processing...' : 'Tailor CV'}
              </button>
            </form>
          )}

          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                Analyzing job description and tailoring your CV...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This may take up to 30 seconds
              </p>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                ✓ Your CV has been successfully tailored!
              </div>

              <div className="bg-gray-50 rounded-lg p-6 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                  {tailoredCV}
                </pre>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleDownloadPDF}
                  className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                >
                  Download as PDF
                </button>
                <button
                  onClick={handleDownloadText}
                  className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Download as Text
                </button>
              </div>

              <button
                onClick={handleReset}
                className="w-full bg-white text-gray-700 py-3 px-6 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                Tailor Another CV
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-gray-600 text-sm">
          <p>
            Powered by Claude AI • Your data is processed securely and not stored
          </p>
        </div>
      </div>
    </div>
  );
}
