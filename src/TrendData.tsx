/** Native disclosure/table provides the same values without hover, SVG or chart gestures. */
export function TrendData({
  summary,
  caption,
  dateHeading,
  valueHeading,
  rows,
}: {
  summary: string;
  caption: string;
  dateHeading: string;
  valueHeading: string;
  rows: { date: string; value: string }[];
}) {
  return (
    <details className="trend-data">
      <summary>{summary}</summary>
      <div
        className="trend-data-scroll"
        role="region"
        aria-label={`${caption}，可捲動數值清單`}
        tabIndex={0}
      >
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{dateHeading}</th>
              <th scope="col">{valueHeading}</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((row) => (
              <tr key={row.date}>
                <th scope="row">
                  <time dateTime={row.date}>{row.date}</time>
                </th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
export function TrendTooltip({
  active,
  date,
  label,
  value,
}: {
  active?: boolean;
  date: string;
  label: string;
  value: string;
}) {
  if (!active || !date) return null;
  return (
    <div
      className="trend-tooltip"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p>{date}</p>
      <strong>
        {label}：{value}
      </strong>
    </div>
  );
}
