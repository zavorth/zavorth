import { asText } from "../../controlPageClient.utils";

export function RuntimeKeyValueList({ entries }: { entries: Array<[string, string]> }) {
  return (
    <div className="bcc-list">
      {entries.map(([label, value]) => (
        <div key={label} className="bcc-list-item">
          <span className="bcc-list-item__title">{label}</span>
          <span className="bcc-list-item__meta">{asText(value, "nao informado")}</span>
        </div>
      ))}
    </div>
  );
}
