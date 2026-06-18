'use client';

import React from 'react';
import { RouteError } from './RouteError';

export interface RetryBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: (Error & { digest?: string }) | null;
}

/**
 * Hand-rolled React error boundary class component for client component trees
 * that can throw outside an RSC/segment boundary.
 *
 * Renders RouteError as its fallback. Reset clears boundary state and calls
 * onReset (default: router.refresh() via the RouteError reset path).
 *
 * No new dependency — uses React.Component directly.
 */
export class RetryBoundary extends React.Component<RetryBoundaryProps, State> {
  constructor(props: RetryBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error: unknown): State {
    const err =
      error instanceof Error ? (error as Error & { digest?: string }) : new Error(String(error));
    return { hasError: true, error: err };
  }

  handleReset(): void {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  }

  override render(): React.ReactNode {
    if (this.state.hasError && this.state.error !== null) {
      return (
        <RouteError
          error={this.state.error}
          reset={this.handleReset}
          title={this.props.fallbackTitle}
          description={this.props.fallbackDescription}
        />
      );
    }

    return this.props.children;
  }
}
