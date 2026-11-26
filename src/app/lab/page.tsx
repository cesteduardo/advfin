import { Cabeca } from "@/components/app/Cabeca";
import { LabChat } from "@/components/app/LabChat";
import { Marca } from "@/components/app/Marca";

/**
 * Laboratório estático do chat, publicado com a landing (GitHub Pages).
 * Tudo roda no navegador: base embutida, verificador e, se o desenvolvedor colar
 * a própria chave, a chamada à Anthropic. O laboratório com banco fica em /app/dev.
 */
export default function PaginaLab() {
  return (
    <main className="mesa mesa-principal lab" id="conteudo">
      <Marca />
      <Cabeca
        trilha="AdvFin / Desenvolvedor"
        titulo="Laboratório do chat"
        descricao="Teste o chat da IA com os bastidores à vista: trechos recuperados, prompt, saída bruta, verificador, tempo, tokens e custo."
      />
      <LabChat />
    </main>
  );
}
