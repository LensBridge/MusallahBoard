// Fixed-width digits for faces that have no tabular figures.
// Made to prevent UI jumping around with things like live clock and such 

/**
 * @param {{children: any, className?: string}} props
 *   children is stringified; wrap only the numeric run you want cell-aligned.
 */
export default function Digits({ children, className }) {
  const text = String(children ?? '');
  return (
    <span className={className ? `tnum ${className}` : 'tnum'}>
      {Array.from(text, (ch, i) =>
        ch >= '0' && ch <= '9' ? (
          <span key={i} className="tnum-cell">{ch}</span>
        ) : (
          <span key={i}>{ch}</span>
        )
      )}
    </span>
  );
}
