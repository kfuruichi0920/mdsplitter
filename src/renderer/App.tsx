import { useMemo } from "react";

const upcomingMilestones = [
  {
    phase: "P1",
    label: "プロジェクト雛形",
    focus: "Electron/React/TS雛形とビルドフロー整備"
  },
  {
    phase: "P2",
    label: "共通基盤",
    focus: "設定・ログ・ファイルI/O土台"
  },
  {
    phase: "P3",
    label: "カード変換",
    focus: "固定ルール/LLMハイブリッド変換"
  }
];

function App() {
  const milestones = useMemo(() => upcomingMilestones, []);

  return (
    <main style={containerStyle}>
      <section style={panelStyle}>
        <h1 style={titleStyle}>doc2data mdsplitter</h1>
        <p style={leadStyle}>
          Electron / React / TypeScript をベースにしたカード編集アプリの開発環境です。
        </p>
        <h2 style={subtitleStyle}>次のマイルストーン</h2>
        <ul style={listStyle}>
          {milestones.map((item) => (
            <li key={item.phase} style={listItemStyle}>
              <span style={phaseStyle}>{item.phase}</span>
              <div>
                <strong>{item.label}</strong>
                <p style={captionStyle}>{item.focus}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Inter', system-ui, sans-serif",
  background: "linear-gradient(135deg, #e0f2fe 0%, #f1f5f9 100%)",
  padding: "2rem"
};

const panelStyle: React.CSSProperties = {
  width: "min(640px, 100%)",
  backgroundColor: "#ffffffcc",
  borderRadius: "16px",
  padding: "32px",
  boxShadow: "0 20px 45px -20px rgba(15, 23, 42, 0.45)",
  backdropFilter: "blur(8px)"
};

const titleStyle: React.CSSProperties = {
  fontSize: "2rem",
  marginBottom: "0.5rem",
  color: "#0f172a"
};

const leadStyle: React.CSSProperties = {
  marginBottom: "1.5rem",
  color: "#334155",
  lineHeight: 1.6
};

const subtitleStyle: React.CSSProperties = {
  marginBottom: "0.75rem",
  color: "#1e293b"
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: "0.75rem"
};

const listItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem 1rem",
  borderRadius: "12px",
  backgroundColor: "#f8fafc",
  border: "1px solid rgba(148, 163, 184, 0.3)"
};

const phaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  fontSize: "0.85rem",
  color: "#2563eb",
  backgroundColor: "#dbeafe",
  borderRadius: "999px",
  width: "3rem",
  height: "3rem"
};

const captionStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: "0.9rem"
};

export default App;
