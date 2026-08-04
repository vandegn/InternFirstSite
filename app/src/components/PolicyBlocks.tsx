import type { PolicyBlock } from '@/lib/policies';

// Renders the structured policy blocks (see lib/policies) as HTML. Shared by
// the signup agreement modal and the public /terms and /privacy pages so the
// two can't drift apart.
export default function PolicyBlocksView({ blocks }: { blocks: PolicyBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => (
        <PolicyLine key={i} block={block} />
      ))}
    </>
  );
}

function PolicyLine({ block }: { block: PolicyBlock }) {
  if (block.type === 'h') {
    return <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '18px 0 6px' }}>{block.text}</h4>;
  }
  if (block.type === 'li') {
    return (
      <div style={{ display: 'flex', gap: '8px', margin: '4px 0 4px 4px' }}>
        <span aria-hidden style={{ color: 'var(--primary)', lineHeight: 1.6 }}>•</span>
        <span>{block.text}</span>
      </div>
    );
  }
  return <p style={{ margin: '0 0 10px' }}>{block.text}</p>;
}
