import { SearchX } from 'lucide-react';

export default function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <SearchX size={28} />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
