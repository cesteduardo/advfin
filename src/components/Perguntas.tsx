"use client";

import { useId, useState } from "react";
import { IPhoneDuo } from "./Molduras";

/**
 * Perguntas frequentes. A pergunta aberta aparece também no iPhone Duo ao lado,
 * como uma conversa com o AdvFin: o aparelho repete a lista, então fica escondido
 * dos leitores de tela.
 */

const PERGUNTAS = [
  {
    p: "O AdvFin substitui o parecer do advogado?",
    r: "Não. A IA prepara a pesquisa e o cálculo; quem revisa, assina e responde pelo trabalho é você. Toda resposta nasce marcada como pendente e só muda de estado depois da sua revisão.",
    curta: "Não. A IA prepara; quem revisa, assina e responde pelo trabalho é você.",
  },
  {
    p: "De onde vêm as fontes citadas?",
    r: "De uma base normativa versionada: Constituição, EC 132/2023, LC 214/2025 e os atos que as regulamentam, cada dispositivo com a data em que começou e a data em que deixou de valer. Citação que não existe na base bloqueia a resposta, em vez de passar adiante.",
    curta: "De uma base normativa versionada por vigência. Citação fora da base bloqueia a resposta.",
  },
  {
    p: "Como o sistema trata a vigência das normas?",
    r: "Toda consulta tem uma data de referência. O AdvFin busca o texto que valia naquela data, e não apenas o mais recente, e mostra o selo de vigência ao lado de cada citação.",
    curta: "Cada consulta tem uma data de referência, e o texto citado é o que valia nela.",
  },
  {
    p: "A calculadora usa inteligência artificial?",
    r: "Não. Alíquotas, reduções e a transição de 2026 a 2033 saem de um motor determinístico: a mesma entrada dá sempre o mesmo resultado. Cada número diz se vem de norma, de estimativa oficial ou de premissa informada por você. A IA apenas explica o número.",
    curta: "Não. Os números saem de um motor determinístico; a IA só os explica.",
  },
  {
    p: "Os dados do escritório e dos clientes ficam protegidos?",
    r: "Sim. Os dados ficam hospedados no Brasil, isolados por escritório e nunca são usados para treinar modelos, conforme a LGPD. Tudo o que a IA produz fica registrado numa trilha de auditoria.",
    curta: "Hospedados no Brasil, isolados por escritório e nunca usados para treinar modelos.",
  },
  {
    p: "Quem pode usar?",
    r: "Advogados, escritórios, departamentos jurídicos e profissionais da contabilidade que trabalham com a transição tributária. A ferramenta apoia o trabalho técnico; não presta serviço jurídico a quem não é profissional.",
    curta: "Profissionais do Direito e da contabilidade que trabalham com a transição.",
  },
  {
    p: "Quanto custa e como funciona o beta?",
    r: "O beta é gratuito, sem cartão, para os primeiros 10 escritórios, que também ganham desconto vitalício. Depois, a assinatura é mensal e em reais, com teste de 7 dias e plano anual com dois meses de desconto.",
    curta: "Beta gratuito para os primeiros 10 escritórios. Depois, assinatura mensal em reais.",
  },
  {
    p: "Posso cancelar quando quiser?",
    r: "Sim. O plano mensal não tem fidelidade. Antes de sair, você pode exportar seus casos em Word ou PDF.",
    curta: "Sim. O plano mensal não tem fidelidade.",
  },
];

export function Perguntas() {
  const [aberta, setAberta] = useState(0);
  const base = useId();
  const atual = PERGUNTAS[aberta] ?? PERGUNTAS[0];
  const proximas = [1, 2].map((d) => PERGUNTAS[(aberta + d) % PERGUNTAS.length]);

  return (
    <div className="faq">
      <div className="faq-lista">
        {PERGUNTAS.map((item, i) => {
          const sel = i === aberta;
          return (
            <div key={item.p} className={`faq-item${sel ? " aberta" : ""}`}>
              <h3>
                <button
                  type="button"
                  id={`${base}-b${i}`}
                  aria-expanded={sel}
                  aria-controls={`${base}-r${i}`}
                  onClick={() => setAberta(sel ? -1 : i)}
                >
                  <span>{item.p}</span>
                  <i aria-hidden="true" />
                </button>
              </h3>
              <div className="faq-resposta" id={`${base}-r${i}`} role="region" aria-labelledby={`${base}-b${i}`}>
                <div>
                  <p>{item.r}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="faq-palco vitrine">
        <IPhoneDuo classe="faq-duo">
          <div className="viewport app tela-ajuda">
            <div className="app-topo">
              <span className="app-marca">
                <svg className="simbolo-app" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="9" fill="#0f2742" /><path d="M8 19.5h12M9.5 17V11.5M14 17V11.5M18.5 17V11.5M7.5 10 14 6.5l6.5 3.5" stroke="#d9bf86" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                <span>Adv<i>Fin</i></span>
              </span>
              <span className="app-data">Ajuda</span>
            </div>
            <div className="ajuda-conversa" key={aberta}>
              <p className="bolha eu">{atual.p}</p>
              <p className="bolha ia">{atual.curta}</p>
              <p className="ajuda-rotulo">Outras dúvidas</p>
              <div className="ajuda-sugestoes">
                {proximas.map((q) => (
                  <span key={q.p}>{q.p}</span>
                ))}
              </div>
            </div>
          </div>
        </IPhoneDuo>
        <p className="faq-legenda">iPhone Duo fechado · a pergunta aberta aparece como conversa</p>
      </div>
    </div>
  );
}
