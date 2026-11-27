/** Cada tela entra com um deslize curto (mesa-pagina em mesa.css); o template remonta a cada navegação. */
export default function Entrada({ children }: { children: React.ReactNode }) {
  return <div className="mesa-pagina">{children}</div>;
}
