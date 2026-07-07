/** Renders coach plain-text with NagStudy typography. */
export default function CoachMessageBody({ content, variant = "bubble" }) {
  if (!content) return null;

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let bulletGroup = null;

  function flushBullets() {
    if (bulletGroup?.length) {
      blocks.push({ type: "ul", items: bulletGroup });
      bulletGroup = null;
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushBullets();
      continue;
    }

    const section = trimmed.match(/^──\s*(.+?)\s*──$/);
    if (section) {
      flushBullets();
      blocks.push({ type: "section", text: section[1] });
      continue;
    }

    if (/^[•\-\*]\s/.test(trimmed)) {
      if (!bulletGroup) bulletGroup = [];
      bulletGroup.push(trimmed.replace(/^[•\-\*]\s+/, ""));
      continue;
    }

    flushBullets();
    blocks.push({ type: "p", text: trimmed.replace(/^[#]+\s*/, "") });
  }
  flushBullets();

  const cls = variant === "report" ? "cgm-report-body" : "cgm-text-body";

  return (
    <div className={cls}>
      {blocks.map((b, i) => {
        if (b.type === "section") {
          return <div key={i} className="cgm-section-title">{b.text}</div>;
        }
        if (b.type === "ul") {
          return (
            <ul key={i} className="cgm-bullet-list">
              {b.items.map((item, j) => <li key={j}>{item}</li>)}
            </ul>
          );
        }
        return <p key={i} className="cgm-para">{b.text}</p>;
      })}
    </div>
  );
}
