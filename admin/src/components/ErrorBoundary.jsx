import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './ui/Button';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-6">
          <div className="max-w-lg rounded-lg border border-line bg-white p-6 text-center shadow-soft">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-berry">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold text-ink">Có lỗi xảy ra</h1>
            <p className="mt-2 text-sm text-muted">{this.state.error.message}</p>
            <Button className="mt-5" onClick={() => window.location.reload()}>
              Tải lại
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
