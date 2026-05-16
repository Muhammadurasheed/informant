import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
  details?: string;
};

import { initError } from '../utils/firebase';

export default class SidepanelErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    // Check if we already have a critical init error from firebase.ts
    if (initError) {
      this.state = {
        hasError: true,
        message: 'Firebase Initialization Failed',
        details: initError.message + "\n(Check API Key restrictions in Google Cloud Console)"
      };
    } else {
      this.state = { hasError: false, message: 'Something went wrong.' };
    }
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred while loading the side panel.';

    const isFirebaseConfigIssue =
      typeof message === 'string' &&
      (message.includes('Firebase configuration incomplete') ||
        message.includes('auth/invalid-api-key'));

    return {
      hasError: true,
      message: isFirebaseConfigIssue
        ? 'Firebase configuration is missing/invalid for the extension build.'
        : 'The side panel crashed while loading.',
      details: message,
    };
  }

  componentDidCatch(error: unknown) {
    // Log for debugging (visible in extension devtools)
    console.error('[SidepanelErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-6 text-center text-slate-200 font-sans">
          <div className="bg-red-900/20 p-4 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-400 mb-6 bg-slate-900 p-3 rounded border border-slate-800 font-mono text-left w-full max-h-40 overflow-auto whitespace-pre-wrap word-break">
            {this.state.details || this.state.message || "Unknown error occurred"}
          </p>
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
            onClick={() => window.location.reload()}
          >
            Reload Extension Panel
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
