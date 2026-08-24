import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Wifi, 
  Users, 
  MessageSquare, 
  GitBranch, 
  Check,
  ChevronRight,
  PartyPopper
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWhatsappInstances, useWhatsappMacros } from '@/hooks/useWhatsappData';
import { useAssignmentRules, useTeamMembers } from '@/hooks/useWhatsappSettings';

interface SetupTabProps {
  onNavigateToTab: (tab: string) => void;
}

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetTab: string;
  isComplete: boolean;
}

export function SetupTab({ onNavigateToTab }: SetupTabProps) {
  const { data: instances = [] } = useWhatsappInstances();
  const { data: macros = [] } = useWhatsappMacros();
  const { data: rules = [] } = useAssignmentRules();
  const { data: members = [] } = useTeamMembers();
  
  const steps: SetupStep[] = [
    {
      id: 'connect',
      title: 'Conectar WhatsApp',
      description: 'Configurar instância Evolution API',
      icon: <Wifi className="h-5 w-5" />,
      targetTab: 'instances',
      isComplete: instances.length > 0,
    },
    {
      id: 'team',
      title: 'Configurar Equipe',
      description: 'Adicionar membros à equipe',
      icon: <Users className="h-5 w-5" />,
      targetTab: 'team',
      isComplete: members.length > 1,
    },
    {
      id: 'macros',
      title: 'Criar Macros',
      description: 'Configurar respostas rápidas',
      icon: <MessageSquare className="h-5 w-5" />,
      targetTab: 'macros',
      isComplete: macros.length > 0,
    },
    {
      id: 'assignment',
      title: 'Regras de Atribuição',
      description: 'Definir distribuição de conversas',
      icon: <GitBranch className="h-5 w-5" />,
      targetTab: 'assignment',
      isComplete: rules.length > 0,
    },
  ];
  
  const completedCount = steps.filter(s => s.isComplete).length;
  const totalSteps = steps.length;
  const progressPercent = (completedCount / totalSteps) * 100;
  const isAllComplete = completedCount === totalSteps;
  
  return (
    <div className="space-y-6">
      {/* Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Guia de Configuração Inicial
                {isAllComplete && <PartyPopper className="h-5 w-5 text-yellow-500" />}
              </CardTitle>
              <CardDescription>
                {isAllComplete 
                  ? 'Parabéns! Sua configuração está completa.'
                  : 'Complete os passos abaixo para configurar o sistema.'}
              </CardDescription>
            </div>
            <Badge variant={isAllComplete ? 'default' : 'secondary'}>
              {completedCount} de {totalSteps} completos
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2">
            {Math.round(progressPercent)}% concluído
          </p>
        </CardContent>
      </Card>
      
      {/* Steps Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step, index) => (
          <Card 
            key={step.id}
            className={cn(
              "transition-all hover:shadow-md cursor-pointer",
              step.isComplete && "border-primary/50 bg-primary/5"
            )}
            onClick={() => onNavigateToTab(step.targetTab)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Step Number / Check */}
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2",
                  step.isComplete 
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30 text-muted-foreground"
                )}>
                  {step.isComplete ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "p-1.5 rounded-md",
                      step.isComplete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {step.icon}
                    </span>
                    <h3 className="font-medium text-foreground">{step.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                
                {/* Action */}
                <Button 
                  variant={step.isComplete ? "outline" : "default"} 
                  size="sm"
                  className="shrink-0"
                >
                  {step.isComplete ? 'Editar' : 'Configurar'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
