import { Gamepad2 } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <Gamepad2 size={32} strokeWidth={1.75} className="text-text-3" aria-hidden />
      <p className="text-h3 font-medium text-text-1">{title}</p>
      {description !== undefined && <p className="text-body text-text-2">{description}</p>}
    </div>
  );
}
