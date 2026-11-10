import { useEffect } from 'react';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';

const names = { pelegrini: 'Grupo Pelegrini', transmissao: 'Casa da Transmissão', chevrolet: 'Casa do Chevrolet' } as const;

/** Installation metadata only: the existing branch selection and authorization remain authoritative. */
export function AppInstallBranding() {
  const { filialAtiva, codEmpresaContexto } = useFilialSelecionada();
  const branch = codEmpresaContexto === '10041' ? 'chevrolet' : filialAtiva === 'transmissao' || filialAtiva === 'chevrolet' ? filialAtiva : 'pelegrini';
  useEffect(() => {
    const set = (tag: 'link' | 'meta', attribute: 'rel' | 'name', key: string, values: Record<string,string>) => {
      const node = document.head.querySelector(`${tag}[${attribute}="${key}"]`) ?? document.head.appendChild(document.createElement(tag));
      node.setAttribute(attribute,key);
      for (const [name,value] of Object.entries(values)) node.setAttribute(name,value);
    };
    set('link','rel','manifest',{href:`/pwa/${branch}/manifest.json`});
    set('link','rel','apple-touch-icon',{href:`/pwa/${branch}/apple-touch-icon.png`,type:'image/png',sizes:'180x180'});
    set('meta','name','apple-mobile-web-app-title',{content:names[branch]});
    set('meta','name','application-name',{content:names[branch]});
  },[branch]);
  return null;
}
