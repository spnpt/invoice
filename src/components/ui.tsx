import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PageHeader({ title, action, back }: { title: string; action?: ReactNode; back?: string }) {
  return (
    <div className="flex items-center justify-between mb-4 gap-2">
      <div className="flex items-center gap-2">
        {back && <Link to={back} className="text-blue-600 text-lg" aria-label="Back">&larr;</Link>}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function ErrorText({ msg }: { msg: string }) {
  return msg ? <p className="text-sm text-red-600 my-2">{msg}</p> : null;
}

export function StatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    draft: 'bg-gray-200 text-gray-700', sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700', void: 'bg-red-100 text-red-700',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${color[status] ?? ''}`}>{status}</span>;
}
