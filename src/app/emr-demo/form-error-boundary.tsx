'use client';

import React from 'react';

export class FormErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error)
      return (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-4 text-red-800"
        >
          <p className="font-semibold">Unable to render this form</p>
          <p className="mt-1 text-sm">{this.state.error.message}</p>
          <p className="mt-2 text-sm">
            You can edit this form in SurveyFormBuilder, choose another form, or
            click Render form to try again.
          </p>
        </div>
      );
    return this.props.children;
  }
}
