'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [jobUrl, setJobUrl] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'input' | 'processing' | 'complete'>('input');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [useDefaultCV, setUseDefaultCV] = useState(true);

  // Load default CV on mount
  useEffect(() => {
    const loadDefaultCV = async () => {
      try {
        const response = await fetch('/default-cv.docx');
        const blob = await response.blob();
        const file = new File([blob], 'Michael Novack CV.docx', {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        setCvFile(file);
      } catch (error) {
        console.error('Failed to load default CV:', error);
      }
    };

    loadDefaultCV();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setCvFile(file);
      setUseDefaultCV(false);
    }
  };

  const handleUseDefault = () => {
    const loadDefaultCV = async () => {
      try {
        const response = await fetch('/default-cv.docx');
        const blob = await response.blob();
        const file = new File([blob], 'Michael Novack CV.docx', {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        setCvFile(file);
        setUseDefaultCV(true);
      } catch (error) {
        console.error('Failed to load default CV:', error);
      }
    };

    loadDefaultCV();
  };

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
        const errorData = await tailorResponse.json();
        throw new Error(errorData.details || errorData.error || 'Failed to tailor CV');
      }

      // Get the blob (docx file)
      const blob = await tailorResponse.blob();
      const url = URL.createObjectURL(blob);

      setDownloadUrl(url);

      // Set filename based on content type
      const contentType = tailorResponse.headers.get('content-type');
      const isPdf = contentType?.includes('pdf');
      const filename = isPdf ? 'Michael Novack CV.pdf' : 'Michael Novack CV.docx';
      setFileName(filename);
      setStep('complete');

      // Auto-download the file
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    a.click();
  };

  const handleDownloadDocx = async () => {
    try {
      setLoading(true);

      // Get the job description again
      const extractResponse = await fetch('/api/extract-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jobUrl }),
      });

      if (!extractResponse.ok) {
        throw new Error('Failed to extract job description');
      }

      const { jobDescription } = await extractResponse.json();

      // Request docx format
      const formData = new FormData();
      formData.append('jobDescription', jobDescription);
      formData.append('cvFile', cvFile!);
      formData.append('format', 'docx');

      const tailorResponse = await fetch('/api/tailor-cv', {
        method: 'POST',
        body: formData,
      });

      if (!tailorResponse.ok) {
        const errorData = await tailorResponse.json();
        throw new Error(errorData.details || errorData.error || 'Failed to tailor CV');
      }

      const blob = await tailorResponse.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'Michael Novack CV.docx';
      a.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setJobUrl('');
    handleUseDefault();
    setDownloadUrl('');
    setFileName('');
    setStep('input');
    setError('');
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
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
                <div className="space-y-3">
                  {useDefaultCV && cvFile && (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Using default CV: {cvFile.name}
                    </div>
                  )}
                  <input
                    type="file"
                    id="cvFile"
                    accept=".docx,.doc"
                    onChange={handleFileChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  {!useDefaultCV && cvFile && (
                    <button
                      type="button"
                      onClick={handleUseDefault}
                      className="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      Use default CV instead
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !cvFile}
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ready to Download
                </h3>
                <p className="text-gray-600 mb-4">
                  Your tailored CV is ready. Only the summary and bullet points have been updated to match the job description, while preserving all original formatting.
                </p>
                <p className="text-sm text-gray-500">
                  File: {fileName}
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                >
                  Download PDF
                </button>
                <button
                  onClick={handleDownloadDocx}
                  disabled={loading}
                  className="flex-1 bg-gray-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Processing...' : 'Download DOCX'}
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
