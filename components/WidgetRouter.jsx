'use client';
import dynamic from 'next/dynamic';

const LinearGraphMatcher = dynamic(() => import('./widgets/LinearGraphMatcher'), { ssr: false });
const FractionBar = dynamic(() => import('./widgets/FractionBar'), { ssr: false });
const NumberLineMarker = dynamic(() => import('./widgets/NumberLineMarker'), { ssr: false });

export default function WidgetRouter({ node, onSubmit }) {
  const kind = node?.widget?.kind;
  if (!kind) return (
    <div className="rounded-lg border p-8 text-center text-muted-foreground">
      This concept has no interactive widget — use the Quick Quiz tab.
    </div>
  );
  if (kind === 'LinearGraphMatcher') return <LinearGraphMatcher node={node} onSubmit={onSubmit} />;
  if (kind === 'FractionBar')        return <FractionBar        node={node} onSubmit={onSubmit} />;
  if (kind === 'NumberLineMarker')   return <NumberLineMarker   node={node} onSubmit={onSubmit} />;
  return (
    <div className="rounded-lg border p-8 text-center text-muted-foreground">
      Widget kind “{kind}” not implemented yet.
    </div>
  );
}
