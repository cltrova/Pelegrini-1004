import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Check, Globe, BarChart3, TrendingUp, ShoppingCart, MessageSquare, Sparkles } from 'lucide-react';
import { useEmpresas, Empresa } from '@/hooks/useEmpresaConfig';
import { useEmpresaSelecionada } from '@/contexts/EmpresaSelecionadaContext';
import { useFilialSelecionada } from '@/contexts/FilialSelecionadaContext';
import { empresaPossuiFiliais, getFiliaisDaEmpresa } from '@/config/filiaisEmpresa';
import { FilialSelectorDialog } from '@/components/common/FilialSelectorDialog';
import { LoadingState } from '@/components/common/LoadingState';
import { cn } from '@/lib/utils';
import { isCliente1004 } from '@/config/cliente1004';

interface EmpresaSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPath: string;
  moduloKey?: 'dre' | 'variacao' | 'comercial' | 'whatsapp' | 'assistente_ia' | 'operacional' | 'resumo' | 'financeiro';
}

export function EmpresaSelectorDialog({ 
  open, 
  onOpenChange, 
  targetPath,
  moduloKey 
}: EmpresaSelectorDialogProps) {
  const navigate = useNavigate();
  const { data: empresas, isLoading } = useEmpresas();
  const { empresaSelecionada, setEmpresaSelecionada } = useEmpresaSelecionada();
  const { clearFilial } = useFilialSelecionada();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingFilialEmpresa, setPendingFilialEmpresa] = useState<{ codEmpresa: string; previousEmpresa: string | null } | null>(null);

  const empresasDisponiveis = empresas?.filter(emp => {
    if (!emp.ativo) return false;
    if (!isCliente1004(emp.cod_empresa_bi)) return false;
    if (!moduloKey) return true;
    
    switch (moduloKey) {
      case 'dre':
        return emp.modulo_dre;
      case 'variacao':
        return emp.modulo_variacao;
      case 'comercial':
        return emp.modulo_comercial;
      case 'whatsapp':
        return emp.modulo_whatsapp;
      case 'assistente_ia':
        return emp.modulo_assistente_ia;
      case 'operacional':
        return emp.modulo_operacional ?? false;
      case 'resumo':
        return emp.modulo_resumo ?? false;
      case 'financeiro':
        return emp.modulo_dre || emp.modulo_variacao || (emp.modulo_resumo ?? false);
      default:
        return true;
    }
  }) || [];

  useEffect(() => {
    if (open && empresaSelecionada && empresas?.length) {
      const found = empresas.find(e => e.cod_empresa_bi === empresaSelecionada);
      if (found) {
        setSelectedId(found.id);
      }
    }
    if (!open) {
      setSelectedId(null);
    }
  }, [open, empresaSelecionada, empresas]);

  const handleConfirm = () => {
    const selected = empresasDisponiveis.find(e => e.id === selectedId);
    if (!selected) return;
    if (selected.cod_empresa_bi !== empresaSelecionada) clearFilial();
    setEmpresaSelecionada(selected.cod_empresa_bi);

    if (empresaPossuiFiliais(selected.cod_empresa_bi) && getFiliaisDaEmpresa(selected.cod_empresa_bi).length > 1) {
      setPendingFilialEmpresa({
        codEmpresa: selected.cod_empresa_bi,
        previousEmpresa: empresaSelecionada,
      });
      onOpenChange(false);
      return;
    }

    onOpenChange(false);
    navigate(targetPath);
  };

  const handleEmpresaClick = (empresa: Empresa) => {
    setSelectedId(empresa.id);
  };

  const getModuloIcon = (modulo: string) => {
    switch (modulo) {
      case 'dre':
        return <BarChart3 className="h-3 w-3" />;
      case 'variacao':
        return <TrendingUp className="h-3 w-3" />;
      case 'comercial':
        return <ShoppingCart className="h-3 w-3" />;
      case 'whatsapp':
        return <MessageSquare className="h-3 w-3" />;
      case 'assistente_ia':
        return <Sparkles className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 max-h-[90vh] flex flex-col border-white/[0.08] bg-gradient-to-b from-slate-950/95 to-slate-900/95 backdrop-blur-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="relative p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-base">
              <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/10">
                <Building2 className="h-4.5 w-4.5 text-slate-300" />
              </span>
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent font-semibold">
                Selecionar Empresa
              </span>
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1.5">
              Escolha qual empresa deseja visualizar neste módulo.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <LoadingState message="Carregando empresas..." />
          ) : empresasDisponiveis.length === 0 ? (
            <div className="py-8 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {moduloKey
                  ? `Nenhuma empresa com o módulo ${moduloKey.toUpperCase()} habilitado.`
                  : 'Nenhuma empresa cadastrada.'}
              </p>
              <Button
                variant="link"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/configuracoes/empresas');
                }}
              >
                Cadastrar empresas
              </Button>
            </div>
          ) : (
            <>
              <div className="h-[420px] pr-3 mt-5 overflow-y-scroll space-y-2.5">
                {empresasDisponiveis.map((empresa, idx) => {
                  const selected = selectedId === empresa.id;
                  return (
                    <button
                      key={empresa.id}
                      onClick={() => handleEmpresaClick(empresa)}
                      onMouseMove={handleCardMouseMove}
                      style={{ animationDelay: `${idx * 60}ms` }}
                      className={cn(
                        'group relative w-full overflow-hidden rounded-xl border text-left',
                        'p-4 transition-all duration-300 animate-fade-in',
                        'hover:-translate-y-0.5',
                        selected
                          ? 'border-white/20 bg-white/[0.04] shadow-[0_8px_30px_-10px_rgba(255,255,255,0.06)]'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.03]'
                      )}
                    >
                      {/* Cursor spotlight */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                        style={{
                          background:
                            'radial-gradient(260px circle at var(--mx) var(--my), hsl(0 0% 100% / 0.06), transparent 60%)',
                        }}
                      />

                      <div className="relative flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'relative flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition-all duration-300',
                              selected
                                ? 'bg-white/[0.06] ring-white/20 scale-105'
                                : 'bg-white/[0.03] ring-white/10 group-hover:ring-white/15'
                            )}
                          >
                            <Building2
                              className={cn(
                                'h-5 w-5 transition-colors',
                                selected ? 'text-slate-200' : 'text-slate-400'
                              )}
                            />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-100 tracking-tight flex items-center gap-2">
                              {empresa.nome}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Código:{' '}
                              <span className="font-mono text-slate-400">
                                {empresa.cod_empresa_bi}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                            selected
                              ? 'bg-white/15 scale-100 opacity-100'
                              : 'scale-75 opacity-0'
                          )}
                        >
                          <Check className="h-3.5 w-3.5 text-slate-200" />
                        </div>
                      </div>

                      {empresa.endpoint_url && (
                        <div className="relative mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Globe className="h-3 w-3" />
                          <span className="truncate font-mono">{empresa.endpoint_url}</span>
                        </div>
                      )}

                      <div className="relative mt-3 flex flex-wrap gap-1.5">
                        {empresa.modulo_dre && (
                          <Badge variant="secondary" className="text-[10px] gap-1 bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.07]">
                            {getModuloIcon('dre')} DRE
                          </Badge>
                        )}
                        {empresa.modulo_variacao && (
                          <Badge variant="secondary" className="text-[10px] gap-1 bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.07]">
                            {getModuloIcon('variacao')} Variação
                          </Badge>
                        )}
                        {empresa.modulo_comercial && (
                          <Badge variant="secondary" className="text-[10px] gap-1 bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.07]">
                            {getModuloIcon('comercial')} Comercial
                          </Badge>
                        )}
                        {empresa.modulo_whatsapp && (
                          <Badge variant="secondary" className="text-[10px] gap-1 bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.07]">
                            {getModuloIcon('whatsapp')} WhatsApp
                          </Badge>
                        )}
                        {empresa.modulo_assistente_ia && (
                          <Badge variant="secondary" className="text-[10px] gap-1 bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:bg-white/[0.07]">
                            {getModuloIcon('assistente_ia')} IA
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-4">
                <p className="text-[11px] text-slate-600">
                  {empresasDisponiveis.length}{' '}
                  {empresasDisponiveis.length === 1 ? 'empresa disponível' : 'empresas disponíveis'}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={!selectedId}
                    className={cn(
                      'relative overflow-hidden bg-white/[0.08] text-slate-100 border border-white/10',
                      'hover:bg-white/[0.12] hover:text-white transition-all',
                      'disabled:opacity-40'
                    )}
                  >
                    Acessar
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <FilialSelectorDialog
      open={!!pendingFilialEmpresa}
      onOpenChange={(o) => {
        if (!o && pendingFilialEmpresa) {
          if (pendingFilialEmpresa.previousEmpresa !== pendingFilialEmpresa.codEmpresa) {
            clearFilial();
            setEmpresaSelecionada(pendingFilialEmpresa.previousEmpresa);
          }
          setPendingFilialEmpresa(null);
        }
      }}
      codEmpresa={pendingFilialEmpresa?.codEmpresa}
      required
      onConfirm={() => {
        setPendingFilialEmpresa(null);
        navigate(targetPath);
      }}
    />
    </>
  );
}
