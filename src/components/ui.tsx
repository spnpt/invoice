import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from './icons';

/**
 * iOS-style navigation bar: sticky, translucent and clear of the notch.
 * Top-level screens get a large title; sub-screens (with `back`) get a back chevron and a compact title.
 */
export function PageHeader({ title, action, back }: { title: string; action?: ReactNode; back?: string }) {
  return (
    <div className="ios-bar sticky top-0 z-30 -mx-4 mb-3 border-b border-black/5 px-4 no-select"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}>
      {back ? (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-2 min-h-[2.75rem]">
          <Link to={back} className="flex items-center -ml-2 text-blue-600 text-[17px]" aria-label="Back">
            <ChevronLeft className="h-6 w-6" />Back
          </Link>
          <h1 className="truncate text-[17px] font-semibold text-center">{title}</h1>
          <div className="flex justify-end">{action}</div>
        </div>
      ) : (
        <div className="flex items-end justify-between gap-2 pb-2 pt-1">
          <h1 className="text-[32px] leading-tight font-bold tracking-tight">{title}</h1>
          <div className="pb-1">{action}</div>
        </div>
      )}
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
