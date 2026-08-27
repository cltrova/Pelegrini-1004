import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X, Smartphone, Activity, BrainCircuit, TrendingUp, BarChart3, Users, Cog, Settings } from 'lucide-react';

interface ModuleDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    gradient?: string;
    color?: string;
    bgColor?: string;
    features: string[];
    detailedFeatures?: {
      title: string;
      description: string;
    }[];
  } | null;
}

const moduleMarketingContent: Record<string, { 
  headline: string; 
  description: string;
  highlights: { icon: React.ComponentType<{ className?: string }>; text: string }[];
}> = {
  'WhatsApp': {
    headline: 'Atendimento Inteligente via WhatsApp',
    description: `Revolucione o atendimento ao cliente da sua empresa com nossa plataforma completa de CRM para WhatsApp.

O módulo WhatsApp oferece uma central de atendimento unificada onde sua equipe gerencia todas as conversas em tempo real. Múltiplos atendentes podem trabalhar simultaneamente, com distribuição automática de conversas e histórico completo de cada cliente.

Nossa Inteligência Artificial analisa automaticamente o sentimento de cada conversa, identificando clientes insatisfeitos, urgências e oportunidades de venda. Receba alertas proativos e tome ações antes que pequenos problemas se tornem grandes.

O sistema de macros e respostas rápidas agiliza o atendimento, enquanto relatórios detalhados mostram tempo médio de resposta, satisfação do cliente e performance individual de cada atendente.

Com acesso mobile, seus vendedores e atendentes respondem de qualquer lugar, mantendo a qualidade e o controle centralizado.`,
    highlights: [
      { icon: Activity, text: 'IA para análise de sentimentos' },
      { icon: Smartphone, text: 'Atendimento de qualquer lugar' },
      { icon: Users, text: 'Gestão de equipe e relatórios' },
    ]
  },
  'Financeiro': {
    headline: 'Controle Total das Suas Finanças',
    description: `Transforme a gestão financeira da sua empresa com nossa plataforma completa de análise e inteligência de dados. 

O módulo Financeiro oferece uma visão 360° das suas operações, desde a Demonstração de Resultado do Exercício (DRE) até análises avançadas de variações e tendências.

Nossa tecnologia de ponta processa milhares de transações em tempo real, apresentando dashboards interativos que permitem drill-down em cada conta contábil. Acompanhe margens, EBITDA, lucro líquido e dezenas de outros indicadores com atualização automática.

O diferencial? Nossa Inteligência Artificial integrada responde suas perguntas em linguagem natural. Pergunte "qual foi minha maior despesa no trimestre?" e receba insights instantâneos, com gráficos e recomendações personalizadas.

Disponível também em versão mobile, você monitora a saúde financeira do seu negócio de qualquer lugar, a qualquer momento.`,
    highlights: [
      { icon: BrainCircuit, text: 'Assistente IA com linguagem natural' },
      { icon: Smartphone, text: 'App mobile para gestão em qualquer lugar' },
      { icon: TrendingUp, text: 'Dashboards em tempo real' },
    ]
  },
  'Comercial': {
    headline: 'Potencialize Suas Vendas',
    description: `Desbloqueie todo o potencial comercial da sua empresa com análises profundas de vendas, clientes e performance de equipe.

O módulo Comercial foi desenvolvido para gestores que buscam resultados extraordinários. Acompanhe em tempo real o faturamento, ticket médio, conversões e metas — tudo em dashboards visuais e intuitivos.

Analise a performance individual de cada vendedor, compare resultados entre períodos, identifique padrões de compra dos clientes e descubra oportunidades ocultas de crescimento. Nossa curva ABC automatizada revela quais produtos e clientes realmente impulsionam seu resultado.

Com Inteligência Artificial embarcada, o sistema identifica automaticamente tendências de mercado, prevê sazonalidades e sugere ações estratégicas para aumentar suas vendas.

A versão mobile coloca todo esse poder na palma da sua mão, permitindo acompanhar metas e resultados em reuniões, viagens ou qualquer momento que precisar.`,
    highlights: [
      { icon: TrendingUp, text: 'IA preditiva para tendências de vendas' },
      { icon: Smartphone, text: 'Acompanhe metas pelo celular' },
      { icon: Users, text: 'Ranking e gestão de vendedores' },
    ]
  },
  'Operacional': {
    headline: 'Eficiência Máxima nas Operações',
    description: `Otimize cada etapa do seu processo produtivo com visibilidade total das operações, desde a produção até a entrega final.

O módulo Operacional integra todas as áreas da sua operação em uma única plataforma inteligente. Monitore ordens de produção, rendimento fabril, níveis de estoque, logística de entregas e manutenção de equipamentos.

Nossos indicadores automatizados revelam gargalos, desperdícios e oportunidades de melhoria que passariam despercebidos. O giro de estoque, cobertura de inventário e lead time de entregas ficam sempre visíveis para tomada de decisão ágil.

A Inteligência Artificial trabalha continuamente analisando padrões operacionais, alertando sobre possíveis falhas, sugerindo manutenções preventivas e otimizando rotas de distribuição.

Com acesso mobile, supervisores e gestores acompanham a operação em tempo real, recebem alertas críticos e tomam decisões rápidas mesmo fora da empresa.`,
    highlights: [
      { icon: Settings, text: 'IA para manutenção preditiva' },
      { icon: Smartphone, text: 'Alertas em tempo real no celular' },
      { icon: BarChart3, text: 'KPIs de produção automatizados' },
    ]
  },
  'Configurações': {
    headline: 'Controle Total da Plataforma',
    description: `Personalize e administre toda a plataforma de acordo com as necessidades específicas da sua empresa.

O módulo de Configurações oferece controle granular sobre usuários, permissões, empresas do grupo e integrações com sistemas externos.

Gerencie facilmente o acesso de cada colaborador, definindo exatamente quais módulos e informações cada perfil pode visualizar. Configure múltiplas empresas do grupo com parâmetros individualizados.

Conecte a plataforma aos seus sistemas existentes através de APIs robustas e bem documentadas. A sincronização de dados acontece de forma automática e segura.`,
    highlights: [
      { icon: Users, text: 'Gestão avançada de usuários' },
      { icon: Cog, text: 'Integrações com sistemas externos' },
      { icon: Settings, text: 'Configurações personalizadas por empresa' },
    ]
  },
};

export function ModuleDetailsDialog({ open, onOpenChange, module }: ModuleDetailsDialogProps) {
  if (!module) return null;

  const content = moduleMarketingContent[module.title] || {
    headline: module.description,
    description: module.features.join('. '),
    highlights: []
  };

  const Icon = module.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <div className="flex items-center gap-4 mb-4">
            <div 
              className={cn(
                'h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg',
                module.gradient ? `bg-gradient-to-br ${module.gradient}` : module.bgColor
              )}
            >
              <Icon className={cn('h-8 w-8', module.gradient ? 'text-white' : module.color)} />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">{module.title}</DialogTitle>
              <p className="text-primary font-medium mt-1">{content.headline}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main description */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {content.description.split('\n\n').map((paragraph, index) => (
              <p key={index} className="text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Highlights */}
          {content.highlights.length > 0 && (
            <div className="grid gap-3">
              {content.highlights.map((highlight, index) => {
                const HighlightIcon = highlight.icon;
                return (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <HighlightIcon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">{highlight.text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* CTA section */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground text-center mb-4">
              Faça login para acessar todas as funcionalidades
            </p>
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
