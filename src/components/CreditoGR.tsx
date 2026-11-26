/** Assinatura da GR Brands: símbolo, nome e o ponto vermelho, como no rodapé do GR Vagas. */
export function CreditoGR({ id = "gr" }: { id?: string }) {
  return (
    <a className="logo-grb" href="https://grbrands.com.br" target="_blank" rel="noopener" aria-label="GR Brands, site principal">
      <svg className="gr-ico" viewBox="22.5 22 84 84" aria-hidden="true" focusable="false">
        <clipPath id={`${id}-ct`}>
          <rect x="-60" y="-60" width="220" height="107" />
        </clipPath>
        <clipPath id={`${id}-cb`}>
          <rect x="-60" y="53" width="220" height="160" />
        </clipPath>
        <g transform="translate(25.3 24) scale(1.00125) translate(-16 -8.2)">
          <g fill="currentColor" transform="rotate(-22 50 50)">
            <g clipPath={`url(#${id}-ct)`}>
              <circle cx="60" cy="50" r="38" />
            </g>
            <g clipPath={`url(#${id}-cb)`}>
              <circle cx="50" cy="50" r="38" />
            </g>
          </g>
        </g>
      </svg>
      <b>GR Brands</b>
      <i aria-hidden="true">.</i>
    </a>
  );
}
