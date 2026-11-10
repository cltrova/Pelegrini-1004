import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AppInstallBranding } from './AppInstallBranding';

const context=vi.hoisted(()=>({filialAtiva:'transmissao' as string|null,codEmpresaContexto:'1004' as string|null}));
vi.mock('@/contexts/FilialSelecionadaContext',()=>({useFilialSelecionada:()=>context}));
beforeEach(()=>{
  context.filialAtiva='transmissao';context.codEmpresaContexto='1004';
  document.head.innerHTML='<link rel="manifest" href="/pwa/pelegrini/manifest.json"><link rel="apple-touch-icon" href="/pwa/pelegrini/apple-touch-icon.png"><meta name="apple-mobile-web-app-title" content="Grupo Pelegrini"><meta name="application-name" content="Grupo Pelegrini"><meta name="theme-color" content="#073f73">';
});

describe('installed app identity',()=>{
  it('uses the selected branch logo and switches metadata without changing the selection',()=>{
    const view=render(<AppInstallBranding/>);
    expect(document.querySelector('link[rel="manifest"]')).toHaveAttribute('href','/pwa/transmissao/manifest.json');
    expect(document.querySelector('link[rel="apple-touch-icon"]')).toHaveAttribute('href','/pwa/transmissao/apple-touch-icon.png');
    expect(document.querySelector('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content','Casa da Transmissão');
    context.filialAtiva='chevrolet';view.rerender(<AppInstallBranding/>);
    expect(document.querySelector('link[rel="manifest"]')).toHaveAttribute('href','/pwa/chevrolet/manifest.json');
    expect(document.querySelector('link[rel="apple-touch-icon"]')).toHaveAttribute('href','/pwa/chevrolet/apple-touch-icon.png');
    expect(document.querySelectorAll('link[rel="manifest"]')).toHaveLength(1);
    expect(document.querySelectorAll('link[rel="apple-touch-icon"]')).toHaveLength(1);
    expect(context.filialAtiva).toBe('chevrolet');
  });
  it('uses Chevrolet for company10041 and group branding before branch selection',()=>{
    context.filialAtiva=null;context.codEmpresaContexto='10041';
    const view=render(<AppInstallBranding/>);
    expect(document.querySelector('link[rel="manifest"]')).toHaveAttribute('href','/pwa/chevrolet/manifest.json');
    context.codEmpresaContexto=null;view.rerender(<AppInstallBranding/>);
    expect(document.querySelector('link[rel="manifest"]')).toHaveAttribute('href','/pwa/pelegrini/manifest.json');
  });
  it('provides distinct install IDs and opaque PNG-size assets for Android and iOS',()=>{
    const ids=[];
    for(const branch of ['pelegrini','transmissao','chevrolet']){
      const manifest=JSON.parse(readFileSync(`public/pwa/${branch}/manifest.json`,'utf8'));
      ids.push(manifest.id);expect(manifest.start_url).toBe('/');expect(manifest.display).toBe('standalone');
      expect(manifest.icons).toEqual(expect.arrayContaining([expect.objectContaining({sizes:'192x192',type:'image/png',purpose:'any'}),expect.objectContaining({sizes:'512x512',purpose:'any'}),expect.objectContaining({sizes:'512x512',purpose:'maskable'})]));
      for(const icon of [...manifest.icons,{src:`/pwa/${branch}/apple-touch-icon.png`,sizes:'180x180'}]){
        const data=readFileSync('public'+icon.src);
        expect(data.subarray(1,4).toString()).toBe('PNG');
        const [width,height]=icon.sizes.split('x').map(Number);
        expect([data.readUInt32BE(16),data.readUInt32BE(20)]).toEqual([width,height]);
      }
    }
    expect(new Set(ids).size).toBe(3);
    const html=readFileSync('index.html','utf8');
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('rel="apple-touch-icon" type="image/png" sizes="180x180"');
  });
});
