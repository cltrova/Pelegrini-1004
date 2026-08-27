import { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useEmpresaMutations, Empresa } from '@/hooks/useEmpresaConfig';
import { supabase } from '@/integrations/supabase/client';
import { isLocalPreviewEnabled } from '@/config/localPreview';
import { buildApiProxyUrl } from '@/utils/apiEndpointResolver';
import {
  FileJson, Upload, X, Loader2, Wifi, WifiOff, ChevronDown, Check, AlertTriangle,
} from 'lucide-react';

interface EmpresaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa?: Empresa | null;
}

type DataSourceKey =
  | 'dre' | 'variacao' | 'comercial' | 'comercial_produtos' | 'comercial_devolucoes'
  | 'comercial_ch' | 'comercial_produtos_ch'
  | 'estoque_giro' | 'estoque_consolidado' | 'estoque_detalhado' | 'resumo'
  | 'duplicatas' | 'fluxo_caixa' | 'fluxo_caixa_movimento';

interface FeatureDef {
  key: string;
  label: string;
  dataSources?: { key: DataSourceKey; label: string; subgroup?: string }[];
}

interface ModuleGroupDef {
  id: string;
  label: string;
  features: FeatureDef[];
}

function buildModuleSchema(codEmpresaBi: string): ModuleGroupDef[] {
  const financeiroFeatures: FeatureDef[] = [
    { key: 'modulo_dre', label: 'DRE', dataSources: [{ key: 'dre', label: 'DRE' }] },
    { key: 'modulo_variacao', label: 'Variação / DFC', dataSources: [{ key: 'variacao', label: 'Variação' }] },
    { key: 'modulo_assistente_ia', label: 'Assistente IA' },
    { key: 'modulo_resumo', label: 'Resumo Consolidado', dataSources: [{ key: 'resumo', label: 'Resumo' }] },
  ];
  if (codEmpresaBi === '1002') {
    // Relatórios exclusivos da empresa 1002 — vinculados ao módulo DRE (financeiro)
    const dreFeat = financeiroFeatures.find((f) => f.key === 'modulo_dre');
    if (dreFeat) {
      dreFeat.dataSources = [
        ...(dreFeat.dataSources || []),
        { key: 'duplicatas', label: 'Duplicatas' },
        { key: 'fluxo_caixa', label: 'Fluxo Caixa' },
        { key: 'fluxo_caixa_movimento', label: 'Fluxo Caixa Movimento' },
      ];
    }
  }
  return [
    { id: 'financeiro', label: 'Financeiro', features: financeiroFeatures },
    {
      id: 'comercial', label: 'Comercial',
      features: [
        { key: 'modulo_comercial', label: 'Dashboard Comercial',
          dataSources: codEmpresaBi === '1004' ? [
            { key: 'comercial', label: 'Pedidos', subgroup: 'Casa da Transmissão' },
            { key: 'comercial_produtos', label: 'Itens dos Pedidos', subgroup: 'Casa da Transmissão' },
            { key: 'comercial_ch', label: 'Pedidos', subgroup: 'Casa da Chevrolet' },
            { key: 'comercial_produtos_ch', label: 'Itens dos Pedidos', subgroup: 'Casa da Chevrolet' },
          ] : codEmpresaBi === '1003' ? [
            { key: 'comercial', label: 'Pedidos' },
            { key: 'comercial_produtos', label: 'Itens dos Pedidos' },
            { key: 'comercial_devolucoes', label: 'Devoluções' },
          ] : codEmpresaBi === '1001' ? [
            { key: 'comercial', label: 'Pedidos' },
            { key: 'comercial_produtos', label: 'Itens dos Pedidos' },
            { key: 'duplicatas', label: 'Saldo a Vencer / Duplicatas' },
          ] : [
            { key: 'comercial', label: 'Pedidos' },
            { key: 'comercial_produtos', label: 'Itens dos Pedidos' },
          ] },
        { key: 'possui_meta_vendedor', label: 'Meta por Vendedor' },
      ],
    },
    {
      id: 'operacional', label: 'Operacional',
      features: [
        { key: 'modulo_operacional', label: 'Gestão de Estoque',
          dataSources: [
            { key: 'estoque_giro', label: 'Giro' },
            { key: 'estoque_consolidado', label: 'Consolidado' },
            { key: 'estoque_detalhado', label: 'Detalhado' },
          ] },
      ],
    },
    {
      id: 'whatsapp', label: 'WhatsApp',
      features: [
        { key: 'modulo_whatsapp', label: 'Central WhatsApp' },
      ],
    },
  ];
}

const JSON_PATH_KEYS: Record<DataSourceKey, string> = {
  dre: 'json_path_dre', variacao: 'json_path_variacao',
  comercial: 'json_path_comercial', comercial_produtos: 'json_path_comercial_produtos',
  comercial_devolucoes: 'json_path_comercial_devolucoes',
  comercial_ch: 'json_path_comercial_ch', comercial_produtos_ch: 'json_path_comercial_produtos_ch',
  estoque_giro: 'json_path_estoque_giro', estoque_consolidado: 'json_path_estoque_consolidado',
  estoque_detalhado: 'json_path_estoque_detalhado', resumo: 'json_path_resumo',
  duplicatas: 'json_path_duplicatas', fluxo_caixa: 'json_path_fluxo_caixa',
  fluxo_caixa_movimento: 'json_path_fluxo_caixa_movimento',
};
const ENDPOINT_PATH_KEYS: Record<DataSourceKey, string> = {
  dre: 'endpoint_path_dre', variacao: 'endpoint_path_variacao',
  comercial: 'endpoint_path_comercial_pedidos', comercial_produtos: 'endpoint_path_comercial_produtos',
  comercial_devolucoes: 'endpoint_path_comercial_devolucoes',
  comercial_ch: 'endpoint_path_comercial_pedidos_ch', comercial_produtos_ch: 'endpoint_path_comercial_produtos_ch',
  estoque_giro: 'endpoint_path_estoque_giro', estoque_consolidado: 'endpoint_path_estoque_consolidado',
  estoque_detalhado: 'endpoint_path_estoque_detalhado', resumo: 'endpoint_path_resumo',
  duplicatas: 'endpoint_path_duplicatas', fluxo_caixa: 'endpoint_path_fluxo_caixa',
  fluxo_caixa_movimento: 'endpoint_path_fluxo_caixa_movimento',
};

type SectionId = 'dados' | 'fontes' | 'modulos';



// ── Section wrapper (cartão isolado, numerado) — declarado FORA do componente
// principal para não remontar (e não perder foco dos inputs) a cada render.
function SectionCard({
  isOpen, onToggle, step, title, description, summary, children,
}: {
  isOpen: boolean;
  onToggle: () => void;
  step: number;
  title: string;
  description?: string;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border bg-muted/30 transition-colors ${
        isOpen ? 'border-foreground/20' : 'border-border hover:border-border'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        <div
          className={`h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 ${
            isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          {step}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          {description && <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {!isOpen && summary && (
          <span className="text-[11px] text-muted-foreground mr-2 truncate max-w-[200px]">{summary}</span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-1 border-t border-border">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </section>
  );
}

export function EmpresaFormDialog({ open, onOpenChange, empresa }: EmpresaFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createEmpresa, updateEmpresa } = useEmpresaMutations();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingModule, setUploadingModule] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<'success' | 'error' | null>(null);
  const [expanded, setExpanded] = useState<Record<SectionId, boolean>>({ dados: true, fontes: false, modulos: false });
  const toggleSection = (id: SectionId) =>
    setExpanded((p) => ({ dados: false, fontes: false, modulos: false, [id]: !p[id] }));


  const fileRefs = useRef<Record<DataSourceKey, HTMLInputElement | null>>({
    dre: null, variacao: null, comercial: null, comercial_produtos: null, comercial_devolucoes: null,
    comercial_ch: null, comercial_produtos_ch: null,
    estoque_giro: null, estoque_consolidado: null, estoque_detalhado: null, resumo: null,
    duplicatas: null, fluxo_caixa: null, fluxo_caixa_movimento: null,
  });

  const blankForm = {
    cod_empresa_bi: '', nome: '', endpoint_url: '',
    modulo_dre: false, modulo_variacao: false, modulo_comercial: false, modulo_assistente_ia: false,
    modulo_whatsapp: false, modulo_operacional: false, modulo_resumo: false,
    ativo: true,
    json_path_dre: '', json_path_variacao: '', json_path_comercial: '', json_path_comercial_produtos: '',
    json_path_comercial_devolucoes: '',
    json_path_comercial_ch: '', json_path_comercial_produtos_ch: '',
    json_path_estoque_giro: '', json_path_estoque_consolidado: '', json_path_estoque_detalhado: '', json_path_resumo: '',
    json_path_duplicatas: '', json_path_fluxo_caixa: '', json_path_fluxo_caixa_movimento: '',
    possui_meta_vendedor: true,
    endpoint_path_dre: '/financeiro/dre', endpoint_path_variacao: '/financeiro/variacao',
    endpoint_path_comercial_pedidos: '/comercial/pedidos', endpoint_path_comercial_devolucoes: '/comercial/devolucoes',
    endpoint_path_comercial_produtos: '/comercial/produtos',
    endpoint_path_comercial_pedidos_ch: '/comercial/pedidos_ch',
    endpoint_path_comercial_devolucoes_ch: '/comercial/devolucoes_ch',
    endpoint_path_comercial_produtos_ch: '/comercial/produtos_ch',
    endpoint_path_comercial_totais: '/comercial/totais',
    endpoint_path_comercial_pedidos_total: '/comercial/pedidos/total',
    endpoint_path_comercial_devolucoes_total: '/comercial/devolucoes/total',
    endpoint_path_comercial_produtos_total: '/comercial/produtos/total',
    endpoint_path_comercial_agrupado: '/comercial/agrupado',
    endpoint_path_comercial_clientes_analise: '/comercial/clientes/analise',
    endpoint_path_estoque_giro: '/operacional/estoque/giro',
    endpoint_path_estoque_consolidado: '/operacional/estoque/consolidado',
    endpoint_path_estoque_detalhado: '/operacional/estoque/detalhado',
    endpoint_path_resumo: '/financeiro/resumo',
    endpoint_path_duplicatas: '/financeiro/duplicatas',
    endpoint_path_fluxo_caixa: '/financeiro/fluxo-caixa',
    endpoint_path_fluxo_caixa_movimento: '/financeiro/fluxo-caixa-movimento',
    usar_vps_intermediaria: false, vps_base_url: 'http://187.77.203.16', vps_cliente_identificador: '',
  };

  const [formData, setFormData] = useState(blankForm);
  const [dataSourceType, setDataSourceType] = useState<Record<DataSourceKey, 'endpoint' | 'json'>>({
    dre: 'json', variacao: 'json', comercial: 'json', comercial_produtos: 'json', comercial_devolucoes: 'json',
    comercial_ch: 'json', comercial_produtos_ch: 'json',
    estoque_giro: 'json', estoque_consolidado: 'json', estoque_detalhado: 'json', resumo: 'json',
    duplicatas: 'json', fluxo_caixa: 'json', fluxo_caixa_movimento: 'json',
  });

  useEffect(() => {
    if (empresa) {
      setFormData({
        cod_empresa_bi: empresa.cod_empresa_bi,
        nome: empresa.nome,
        endpoint_url: empresa.endpoint_url,
        modulo_dre: empresa.modulo_dre,
        modulo_variacao: empresa.modulo_variacao,
        modulo_comercial: empresa.modulo_comercial,
        modulo_assistente_ia: empresa.modulo_assistente_ia,
        modulo_whatsapp: empresa.modulo_whatsapp,
        modulo_operacional: (empresa as any).modulo_operacional ?? false,
        modulo_resumo: (empresa as any).modulo_resumo ?? false,
        ativo: empresa.ativo,
        json_path_dre: empresa.json_path_dre || '',
        json_path_variacao: empresa.json_path_variacao || '',
        json_path_comercial: empresa.json_path_comercial || '',
        json_path_comercial_produtos: (empresa as any).json_path_comercial_produtos || '',
        json_path_comercial_devolucoes: (empresa as any).json_path_comercial_devolucoes || '',
        json_path_comercial_ch: (empresa as any).json_path_comercial_ch || '',
        json_path_comercial_produtos_ch: (empresa as any).json_path_comercial_produtos_ch || '',
        json_path_estoque_giro: (empresa as any).json_path_estoque_giro || '',
        json_path_estoque_consolidado: (empresa as any).json_path_estoque_consolidado || '',
        json_path_estoque_detalhado: (empresa as any).json_path_estoque_detalhado || '',
        json_path_resumo: (empresa as any).json_path_resumo || '',
        possui_meta_vendedor: empresa.possui_meta_vendedor ?? true,
        endpoint_path_dre: empresa.endpoint_path_dre || '/financeiro/dre',
        endpoint_path_variacao: empresa.endpoint_path_variacao || '/financeiro/variacao',
        endpoint_path_comercial_pedidos: empresa.endpoint_path_comercial_pedidos || '/comercial/pedidos',
        endpoint_path_comercial_devolucoes: empresa.endpoint_path_comercial_devolucoes || '/comercial/devolucoes',
        endpoint_path_comercial_produtos: (empresa as any).endpoint_path_comercial_produtos || '/comercial/produtos',
        endpoint_path_comercial_pedidos_ch: (empresa as any).endpoint_path_comercial_pedidos_ch || '/comercial/pedidos_ch',
        endpoint_path_comercial_devolucoes_ch: (empresa as any).endpoint_path_comercial_devolucoes_ch || '/comercial/devolucoes_ch',
        endpoint_path_comercial_produtos_ch: (empresa as any).endpoint_path_comercial_produtos_ch || '/comercial/produtos_ch',
        endpoint_path_estoque_giro: (empresa as any).endpoint_path_estoque_giro || '/operacional/estoque/giro',
        endpoint_path_estoque_consolidado: (empresa as any).endpoint_path_estoque_consolidado || '/operacional/estoque/consolidado',
        endpoint_path_estoque_detalhado: (empresa as any).endpoint_path_estoque_detalhado || '/operacional/estoque/detalhado',
        endpoint_path_resumo: (empresa as any).endpoint_path_resumo || '/financeiro/resumo',
        json_path_duplicatas: (empresa as any).json_path_duplicatas || '',
        json_path_fluxo_caixa: (empresa as any).json_path_fluxo_caixa || '',
        json_path_fluxo_caixa_movimento: (empresa as any).json_path_fluxo_caixa_movimento || '',
        endpoint_path_duplicatas: (empresa as any).endpoint_path_duplicatas || '/financeiro/duplicatas',
        endpoint_path_fluxo_caixa: (empresa as any).endpoint_path_fluxo_caixa || '/financeiro/fluxo-caixa',
        endpoint_path_fluxo_caixa_movimento: (empresa as any).endpoint_path_fluxo_caixa_movimento || '/financeiro/fluxo-caixa-movimento',
        endpoint_path_comercial_totais: (empresa as any).endpoint_path_comercial_totais || '/comercial/totais',
        endpoint_path_comercial_pedidos_total: (empresa as any).endpoint_path_comercial_pedidos_total || '/comercial/pedidos/total',
        endpoint_path_comercial_devolucoes_total: (empresa as any).endpoint_path_comercial_devolucoes_total || '/comercial/devolucoes/total',
        endpoint_path_comercial_produtos_total: (empresa as any).endpoint_path_comercial_produtos_total || '/comercial/produtos/total',
        endpoint_path_comercial_agrupado: (empresa as any).endpoint_path_comercial_agrupado || '/comercial/agrupado',
        endpoint_path_comercial_clientes_analise: (empresa as any).endpoint_path_comercial_clientes_analise || '/comercial/clientes/analise',
        usar_vps_intermediaria: (empresa as any).usar_vps_intermediaria ?? false,
        vps_base_url: (empresa as any).vps_base_url || 'http://187.77.203.16',
        vps_cliente_identificador: (empresa as any).vps_cliente_identificador || '',
      });
      const pick = (jsonPath: string | undefined | null): 'endpoint' | 'json' =>
        jsonPath ? 'json' : empresa.endpoint_url ? 'endpoint' : 'json';
      setDataSourceType({
        dre: pick(empresa.json_path_dre),
        variacao: pick(empresa.json_path_variacao),
        comercial: pick(empresa.json_path_comercial),
        comercial_produtos: pick((empresa as any).json_path_comercial_produtos),
        comercial_devolucoes: pick((empresa as any).json_path_comercial_devolucoes),
        comercial_ch: pick((empresa as any).json_path_comercial_ch),
        comercial_produtos_ch: pick((empresa as any).json_path_comercial_produtos_ch),
        estoque_giro: pick((empresa as any).json_path_estoque_giro),
        estoque_consolidado: pick((empresa as any).json_path_estoque_consolidado),
        estoque_detalhado: pick((empresa as any).json_path_estoque_detalhado),
        resumo: pick((empresa as any).json_path_resumo),
        duplicatas: pick((empresa as any).json_path_duplicatas),
        fluxo_caixa: pick((empresa as any).json_path_fluxo_caixa),
        fluxo_caixa_movimento: pick((empresa as any).json_path_fluxo_caixa_movimento),
      });
    } else {
      setFormData(blankForm);
      setDataSourceType({
        dre: 'json', variacao: 'json', comercial: 'json', comercial_produtos: 'json', comercial_devolucoes: 'json',
        comercial_ch: 'json', comercial_produtos_ch: 'json',
        estoque_giro: 'json', estoque_consolidado: 'json', estoque_detalhado: 'json', resumo: 'json',
        duplicatas: 'json', fluxo_caixa: 'json', fluxo_caixa_movimento: 'json',
      });
    }
    setConnectionResult(null);
    setExpanded({ dados: true, fontes: false, modulos: false });
  }, [open, empresa?.id]);

  const isMasterEmpresa = formData.cod_empresa_bi.toUpperCase() === 'MASTER';
  const isNewEmpresa = !empresa;

  const MODULE_SCHEMA = useMemo(
    () => buildModuleSchema(formData.cod_empresa_bi),
    [formData.cod_empresa_bi],
  );

  // Sempre exibe o schema completo para permitir habilitar/desabilitar qualquer módulo.
  const availableGroups = useMemo(() => MODULE_SCHEMA, [MODULE_SCHEMA]);

  const availableSources = useMemo(() => {
    return availableGroups
      .map((g) => {
        const sources = g.features.flatMap((f) =>
          (f.dataSources || []).filter((ds) => {
            const hasPath = Boolean((formData as any)[JSON_PATH_KEYS[ds.key]]);
            const featureOn = Boolean((formData as any)[f.key]);
            return hasPath || featureOn;
          }).map((ds) => ({ ds, featureKey: f.key })),
        );
        return { group: g, sources };
      })
      .filter((g) => g.sources.length > 0);
  }, [availableGroups, formData]);

  const handleTestConnection = async () => {
    const useVps = Boolean((formData as any).usar_vps_intermediaria);
    const vpsBase = ((formData as any).vps_base_url || 'http://187.77.203.16').replace(/\/+$/, '');
    const vpsIdent = String((formData as any).vps_cliente_identificador || '').replace(/^\/+|\/+$/g, '');

    if (!useVps && !formData.endpoint_url) {
      toast({ title: 'URL não informada', description: 'Preencha a URL antes de testar.', variant: 'destructive' });
      return;
    }
    if (useVps && !vpsIdent) {
      toast({ title: 'Identificador VPS não informado', description: 'Preencha o identificador do cliente (ex: pelegrini).', variant: 'destructive' });
      return;
    }

    // Quando triangulação está ativa, testar a URL da VPS + identificador (ex: http://187.77.203.16/pelegrini)
    const targetEndpoint = useVps ? vpsBase : formData.endpoint_url;
    const targetPath = useVps ? `/${vpsIdent}` : '/';
    const displayUrl = useVps ? `${vpsBase}/${vpsIdent}` : formData.endpoint_url;

    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const proxyUrl = isLocalPreviewEnabled()
        ? buildApiProxyUrl({
          endpoint_url: targetEndpoint,
          usar_vps_intermediaria: false,
        } as any, targetPath)
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-proxy?endpoint=${encodeURIComponent(targetEndpoint)}&path=${encodeURIComponent(targetPath)}&test=1`;
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok || (data.targetUrl && response.status < 500) || response.status === 404) {
        setConnectionResult('success');
        toast({ title: 'Conexão bem-sucedida', description: `${displayUrl} acessível.` });
      } else {
        throw new Error(data.error || 'Falha');
      }
    } catch (error: any) {
      setConnectionResult('error');
      toast({ title: 'Falha na conexão', description: error.message || 'Verifique a URL.', variant: 'destructive' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleFileUpload = async (file: File, modulo: DataSourceKey) => {
    if (!formData.cod_empresa_bi) {
      toast({ title: 'Código BI obrigatório', description: 'Preencha o código BI antes do upload.', variant: 'destructive' });
      return;
    }
    if (!file.name.endsWith('.json')) {
      toast({ title: 'Arquivo inválido', description: 'Apenas .json.', variant: 'destructive' });
      return;
    }
    const MAX_SIZE = 500 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast({ title: 'Arquivo muito grande', description: `${(file.size / 1024 / 1024).toFixed(1)}MB / máx 500MB.`, variant: 'destructive' });
      return;
    }
    setUploadingModule(modulo);
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
    const isLargeFile = file.size > 50 * 1024 * 1024;
    try {
      if (isLargeFile) {
        setUploadProgress(`Validando estrutura (${fileSizeMB}MB)...`);
        const startContent = await file.slice(0, 1000).text();
        const clean = startContent.charCodeAt(0) === 0xfeff ? startContent.slice(1) : startContent;
        const firstChar = clean.trim().charAt(0);
        if (firstChar !== '[' && firstChar !== '{') throw new Error(`JSON inválido: deve começar com [ ou {`);
        setUploadProgress(`Enviando arquivo (${fileSizeMB}MB)...`);
      } else {
        const content = await file.text();
        const clean = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
        try { JSON.parse(clean); } catch (e: any) { throw new Error(`JSON inválido: ${e.message}`); }
      }
      const fileName = `${formData.cod_empresa_bi}/${modulo}-${Date.now()}.json`;
      const storagePath = `storage:${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('dados-json')
        .upload(fileName, file, { contentType: 'application/json', cacheControl: '0', upsert: true });
      if (uploadError) throw uploadError;
      const pathKey = `json_path_${modulo}` as keyof typeof formData;
      setFormData((prev) => ({ ...prev, [pathKey]: storagePath }));
      if (empresa) {
        await updateEmpresa(empresa.id, { [pathKey]: storagePath } as Partial<Empresa>);
      }
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['empresa-config'] });
      toast({ title: 'Upload concluído', description: `${modulo.toUpperCase()} aplicado.` });
    } catch (error: any) {
      toast({ title: 'Erro no upload', description: error.message || 'Falha.', variant: 'destructive' });
    } finally {
      setUploadingModule(null);
      setUploadProgress(null);
    }
  };

  const handleRemoveJson = (modulo: DataSourceKey) => {
    const pathKey = `json_path_${modulo}` as keyof typeof formData;
    setFormData((prev) => ({ ...prev, [pathKey]: '' }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.cod_empresa_bi || !formData.nome) {
      toast({ title: 'Campos obrigatórios', description: 'Código BI e nome.', variant: 'destructive' });
      setExpanded((p) => ({ ...p, dados: true }));
      return;
    }
    setIsLoading(true);
    try {
      const dataToSave = {
        ...formData,
        json_path_dre: formData.json_path_dre || null,
        json_path_variacao: formData.json_path_variacao || null,
        json_path_comercial: formData.json_path_comercial || null,
        json_path_comercial_produtos: formData.json_path_comercial_produtos || null,
        json_path_comercial_devolucoes: (formData as any).json_path_comercial_devolucoes || null,
        json_path_comercial_ch: (formData as any).json_path_comercial_ch || null,
        json_path_comercial_produtos_ch: (formData as any).json_path_comercial_produtos_ch || null,
        json_path_estoque_giro: formData.json_path_estoque_giro || null,
        json_path_estoque_consolidado: formData.json_path_estoque_consolidado || null,
        json_path_estoque_detalhado: formData.json_path_estoque_detalhado || null,
        json_path_resumo: formData.json_path_resumo || null,
        json_path_duplicatas: formData.json_path_duplicatas || null,
        json_path_fluxo_caixa: formData.json_path_fluxo_caixa || null,
        json_path_fluxo_caixa_movimento: formData.json_path_fluxo_caixa_movimento || null,
        endpoint_path_comercial_totais: formData.endpoint_path_comercial_totais || null,
        endpoint_path_comercial_pedidos_total: formData.endpoint_path_comercial_pedidos_total || null,
        endpoint_path_comercial_devolucoes_total: formData.endpoint_path_comercial_devolucoes_total || null,
        endpoint_path_comercial_produtos_total: formData.endpoint_path_comercial_produtos_total || null,
        endpoint_path_comercial_agrupado: formData.endpoint_path_comercial_agrupado || null,
        endpoint_path_comercial_clientes_analise: formData.endpoint_path_comercial_clientes_analise || null,
      };
      if (empresa) {
        await updateEmpresa(empresa.id, dataToSave);
        toast({ title: 'Empresa atualizada', description: `${formData.nome} atualizada.` });
      } else {
        await createEmpresa(dataToSave);
        toast({ title: 'Empresa criada', description: `${formData.nome} criada.` });
      }
      queryClient.invalidateQueries({ queryKey: ['empresas'] });
      queryClient.invalidateQueries({ queryKey: ['empresa-config'] });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Falha.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Source row (compacto) ────────────────────────────────────────────────
  const renderSourceRow = (ds: { key: DataSourceKey; label: string }) => {
    const pathKey = JSON_PATH_KEYS[ds.key] as keyof typeof formData;
    const endpointField = ENDPOINT_PATH_KEYS[ds.key] as keyof typeof formData;
    const currentPath = formData[pathKey] as string;
    const hasFile = !!currentPath;
    const isUploading = uploadingModule === ds.key;
    const isStorageFile = currentPath?.startsWith('storage:');
    const sourceType = dataSourceType[ds.key];

    return (
      <div key={ds.key} className="py-4 first:pt-0 last:pb-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-sm font-medium text-foreground">{ds.label}</div>
          <RadioGroup
            value={sourceType}
            onValueChange={(val: 'endpoint' | 'json') => {
              setDataSourceType((prev) => ({ ...prev, [ds.key]: val }));
              if (val === 'endpoint') setFormData((prev) => ({ ...prev, [pathKey]: '' }));
            }}
            className="flex gap-0.5 p-0.5 rounded-md bg-muted/50"
          >
            {(['json', 'endpoint'] as const).map((opt) => (
              <Label
                key={opt}
                htmlFor={`${ds.key}-${opt}`}
                className={`text-[11px] cursor-pointer px-2.5 py-1 rounded transition-colors ${
                  sourceType === opt ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground/80'
                }`}
              >
                <RadioGroupItem value={opt} id={`${ds.key}-${opt}`} className="sr-only" />
                {opt === 'json' ? 'JSON' : 'Endpoint'}
              </Label>
            ))}
          </RadioGroup>
        </div>

        {sourceType === 'endpoint' ? (
          formData.endpoint_url ? (
            <Input
              value={(formData[endpointField] as string) || ''}
              onChange={(e) => setFormData((prev) => ({ ...prev, [endpointField]: e.target.value }))}
              className="h-9 text-xs font-mono bg-transparent border-border text-foreground"
              placeholder="/caminho/do/endpoint"
            />
          ) : (
            <div className="text-[11px] text-amber-300/80 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Defina o endpoint principal em Dados da Empresa.
            </div>
          )
        ) : (
          <div>
            <input
              ref={(el) => { fileRefs.current[ds.key] = el; }}
              type="file" accept=".json" className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f, ds.key);
                e.target.value = '';
              }}
            />
            {hasFile ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 ring-1 ring-border rounded-md text-xs">
                <FileJson className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                <span className="flex-1 truncate font-mono text-foreground/80">
                  {isStorageFile ? currentPath.replace('storage:', '') : currentPath}
                </span>
                <button type="button" onClick={() => fileRefs.current[ds.key]?.click()}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition">
                  Trocar
                </button>
                <button type="button" onClick={() => handleRemoveJson(ds.key)}
                  className="text-muted-foreground hover:text-foreground transition">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : isUploading ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 ring-1 ring-border rounded-md text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {uploadProgress || 'Enviando...'}
              </div>
            ) : (
              <button type="button" onClick={() => fileRefs.current[ds.key]?.click()}
                className="w-full flex items-center justify-center gap-2 h-9 text-xs rounded-md border border-dashed border-border hover:border-foreground/40 text-muted-foreground hover:text-foreground transition-all">
                <Upload className="h-3.5 w-3.5" /> Selecionar arquivo JSON
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Section wrapper foi movido para fora do componente (ver SectionCard),
  // evitando remount dos inputs a cada digitação.



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-hidden p-0 gap-0 bg-background border-border text-foreground">
        {/* Header simples */}
        <div className="px-7 pt-6 pb-4 border-b border-border">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
            {isNewEmpresa ? 'Nova empresa' : 'Editar empresa'}
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {formData.nome || 'Sem nome'}
          </h2>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-7" style={{ maxHeight: 'calc(92vh - 160px)' }}>
          <form onSubmit={handleSubmit} className="space-y-3 py-5">

            {/* ─── DADOS DA EMPRESA ─── */}
            <SectionCard
              isOpen={expanded.dados} onToggle={() => toggleSection('dados')} step={1}
              title="Dados da Empresa"
              description="Identificação, status e endpoint principal"
              summary={formData.cod_empresa_bi ? `${formData.cod_empresa_bi} · ${formData.ativo ? 'Ativa' : 'Inativa'}` : undefined}
            >

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Código BI</Label>
                    <Input
                      value={formData.cod_empresa_bi}
                      onChange={(e) => setFormData({ ...formData, cod_empresa_bi: e.target.value })}
                      placeholder="1001"
                      className="h-10 font-mono text-sm bg-transparent border-border focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Nome da Empresa</Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Empresa ABC Ltda."
                      className="h-10 text-sm bg-transparent border-border focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-sm font-medium text-foreground">Status</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      {formData.ativo ? 'Empresa ativa — usuários têm acesso.' : 'Empresa inativa — acesso bloqueado.'}
                    </div>
                  </div>
                  <Switch checked={formData.ativo} onCheckedChange={(c) => setFormData({ ...formData, ativo: c })} />
                </div>

                {!isMasterEmpresa && (
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-muted-foreground">Endpoint Principal</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.endpoint_url}
                        onChange={(e) => { setFormData({ ...formData, endpoint_url: e.target.value }); setConnectionResult(null); }}
                        placeholder="https://api.empresa.com"
                        className="h-10 flex-1 font-mono text-xs bg-transparent border-border focus-visible:ring-ring"
                      />
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={handleTestConnection}
                        disabled={testingConnection || !formData.endpoint_url}
                        className="h-10 gap-2 border-border bg-transparent text-foreground hover:bg-muted/60 hover:text-foreground"
                      >
                        {testingConnection ? <Loader2 className="h-4 w-4 animate-spin" />
                          : connectionResult === 'success' ? <Wifi className="h-4 w-4 text-emerald-400" />
                          : connectionResult === 'error' ? <WifiOff className="h-4 w-4 text-red-400" />
                          : null}
                        Testar Conexão
                      </Button>
                    </div>
                  </div>
                )}

                {!isMasterEmpresa && (
                  <div className="rounded-lg border border-border bg-background/40 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">VPS Intermediária (Triangulação)</div>
                        <div className="text-[12px] text-muted-foreground mt-0.5">
                          Ative quando o endpoint do cliente só aceita conexões de um IP fixo. As requisições passam pela sua VPS pública.
                        </div>
                      </div>
                      <Switch
                        checked={!!formData.usar_vps_intermediaria}
                        onCheckedChange={(c) => setFormData({ ...formData, usar_vps_intermediaria: c })}
                      />
                    </div>

                    {formData.usar_vps_intermediaria && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground">URL da VPS</Label>
                          <Input
                            value={formData.vps_base_url || ''}
                            onChange={(e) => setFormData({ ...formData, vps_base_url: e.target.value })}
                            placeholder="http://187.77.203.16"
                            className="h-10 font-mono text-xs bg-transparent border-border focus-visible:ring-ring"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground">Identificador do cliente</Label>
                          <Input
                            value={formData.vps_cliente_identificador || ''}
                            onChange={(e) => setFormData({ ...formData, vps_cliente_identificador: e.target.value })}
                            placeholder="ex.: pelegrini"
                            className="h-10 font-mono text-xs bg-transparent border-border focus-visible:ring-ring"
                          />
                        </div>
                        <p className="sm:col-span-2 text-[11px] text-muted-foreground flex items-start gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
                          <span>
                            Destino: <span className="font-mono text-foreground/80">{(formData.vps_base_url || '').replace(/\/+$/, '')}/{formData.vps_cliente_identificador || '{cliente}'}</span> + path do recurso.
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>

            {/* ─── FONTES DE DADOS ─── */}
            <SectionCard
              isOpen={expanded.fontes} onToggle={() => toggleSection('fontes')} step={2}
              title="Fontes de Dados"
              description="Arquivos JSON ou endpoints da empresa"
              summary={availableSources.length > 0 ? `${availableSources.reduce((a, g) => a + g.sources.length, 0)} fontes` : undefined}
            >

              {availableSources.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma fonte disponível. Ative módulos abaixo.</p>
              ) : (
                <div className="space-y-6">
                  {availableSources.map(({ group, sources }) => {
                    // Agrupa por subgroup (ex.: Casa da Transmissão / Casa da Chevrolet)
                    const subgroups = new Map<string, typeof sources>();
                    sources.forEach((s) => {
                      const key = (s.ds as any).subgroup || '';
                      if (!subgroups.has(key)) subgroups.set(key, []);
                      subgroups.get(key)!.push(s);
                    });
                    return (
                      <div key={group.id}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                          {group.label}
                        </div>
                        {Array.from(subgroups.entries()).map(([sub, subSources]) => (
                          <div key={sub || 'default'} className={sub ? 'mt-3' : ''}>
                            {sub && (
                              <div className="text-[11px] font-medium text-foreground/80 mt-2 mb-1">
                                {sub}
                              </div>
                            )}
                            <div className="divide-y divide-border">
                              {subSources.map(({ ds }) => renderSourceRow(ds))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}

              {formData.modulo_comercial && !isMasterEmpresa && (
                <div className="mt-6 rounded-lg border border-border bg-background/40 p-4 space-y-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">Totalizadores — Comercial</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">
                      Endpoints consolidados usados nos cards da Visão Geral (cálculo direto no SQL).
                      Respeitam o Endpoint Principal e a Triangulação VPS configurados acima.
                    </div>
                  </div>
                  {([
                    { field: 'endpoint_path_comercial_totais', label: 'Visão Geral (totais consolidados)', placeholder: '/comercial/totais' },
                    { field: 'endpoint_path_comercial_pedidos_total', label: 'Pedidos — Totalizador', placeholder: '/comercial/pedidos/total' },
                    { field: 'endpoint_path_comercial_devolucoes_total', label: 'Devoluções — Totalizador', placeholder: '/comercial/devolucoes/total' },
                    { field: 'endpoint_path_comercial_produtos_total', label: 'Produtos — Totalizador', placeholder: '/comercial/produtos/total' },
                    { field: 'endpoint_path_comercial_agrupado', label: 'Dados Agrupados (grupo + periodicidade)', placeholder: '/comercial/agrupado' },
                    { field: 'endpoint_path_comercial_clientes_analise', label: 'Análise de Clientes (dias_risco)', placeholder: '/comercial/clientes/analise' },
                  ] as const).map((f) => (
                    <div key={f.field} className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
                      <Input
                        value={((formData as any)[f.field] as string) || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, [f.field]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="h-9 text-xs font-mono bg-transparent border-border text-foreground"
                      />
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 pt-1">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
                    <span>Deixe em branco para desabilitar um totalizador — os cards voltam a usar o cálculo local a partir dos endpoints detalhados.</span>
                  </p>
                </div>
              )}
            </SectionCard>

            {/* ─── MÓDULOS ─── */}
            <SectionCard
              isOpen={expanded.modulos} onToggle={() => toggleSection('modulos')} step={3}
              title="Módulos"
              description="Habilite os recursos disponíveis para esta empresa"
              summary={(() => {
                const ativos = availableGroups.reduce(
                  (a, g) => a + g.features.filter((f) => Boolean((formData as any)[f.key])).length, 0,
                );
                const total = availableGroups.reduce((a, g) => a + g.features.length, 0);
                return total ? `${ativos}/${total} ativos` : undefined;
              })()}
            >

              {availableGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhum módulo configurado.</p>
              ) : (
                <div className="space-y-6">
                  {availableGroups.map((g) => (
                    <div key={g.id}>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
                        {g.label}
                      </div>
                      <div className="space-y-1">
                        {g.features.map((feature) => {
                          const checked = Boolean((formData as any)[feature.key]);
                          return (
                            <label
                              key={feature.key}
                              htmlFor={`feat-${feature.key}`}
                              className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-md hover:bg-muted/40 cursor-pointer transition"
                            >
                              <Checkbox
                                id={`feat-${feature.key}`}
                                checked={checked}
                                onCheckedChange={(c) =>
                                  setFormData((prev) => ({ ...prev, [feature.key]: Boolean(c) }))
                                }
                                className="border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary"
                              />
                              <span className="text-sm text-foreground">{feature.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-7 py-4 border-t border-border bg-muted/30">
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => onOpenChange(false)}
            className="h-9 text-foreground/80 hover:text-foreground hover:bg-muted/60"
          >
            Cancelar
          </Button>
          <Button
            type="button" size="sm"
            onClick={() => handleSubmit()}
            disabled={isLoading || !!uploadingModule}
            className="h-9 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isLoading ? 'Salvando' : empresa ? 'Salvar' : 'Criar'}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
