import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Shield,
  Globe,
  UserCheck,
  Lightbulb,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useSecuritySettings, useUpdateSecuritySettings } from '@/hooks/useWhatsappSettings';
import { useToast } from '@/hooks/use-toast';

interface SecuritySettings {
  restrict_signup_by_domain: boolean;
  allowed_domains: string;
  require_approval: boolean;
}

export function SecurityTab() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useSecuritySettings();
  const updateSettings = useUpdateSecuritySettings();
  
  const [localSettings, setLocalSettings] = useState<SecuritySettings>({
    restrict_signup_by_domain: settings?.restrict_signup_by_domain ?? false,
    allowed_domains: settings?.allowed_domains ?? '',
    require_approval: settings?.require_approval ?? false,
  });
  
  // Update local state when data loads
  useState(() => {
    if (settings) {
      setLocalSettings({
        restrict_signup_by_domain: settings.restrict_signup_by_domain ?? false,
        allowed_domains: settings.allowed_domains ?? '',
        require_approval: settings.require_approval ?? false,
      });
    }
  });
  
  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(localSettings);
      toast({ title: 'Configurações salvas!' });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };
  
  const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(settings || {});
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Segurança</h2>
          <p className="text-sm text-muted-foreground">
            Configure as políticas de acesso e cadastro.
          </p>
        </div>
        <Button 
          onClick={handleSave}
          disabled={!hasChanges || updateSettings.isPending}
        >
          {updateSettings.isPending && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          Salvar Alterações
        </Button>
      </div>
      
      {/* Security Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Domain Restriction */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Restrição por Domínio</CardTitle>
                <CardDescription>
                  Limite o cadastro a domínios específicos
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="restrict_domain">Habilitar restrição</Label>
              <Switch
                id="restrict_domain"
                checked={localSettings.restrict_signup_by_domain}
                onCheckedChange={(checked) => setLocalSettings({ 
                  ...localSettings, 
                  restrict_signup_by_domain: checked 
                })}
              />
            </div>
            
            {localSettings.restrict_signup_by_domain && (
              <div className="space-y-2">
                <Label htmlFor="domains">Domínios Permitidos</Label>
                <Input
                  id="domains"
                  value={localSettings.allowed_domains}
                  onChange={(e) => setLocalSettings({ 
                    ...localSettings, 
                    allowed_domains: e.target.value 
                  })}
                  placeholder="empresa.com.br, filial.com"
                />
                <p className="text-xs text-muted-foreground">
                  Separe múltiplos domínios por vírgula.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Manual Approval */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Aprovação de Contas</CardTitle>
                <CardDescription>
                  Exija aprovação manual para novos usuários
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="require_approval">Exigir aprovação</Label>
              <Switch
                id="require_approval"
                checked={localSettings.require_approval}
                onCheckedChange={(checked) => setLocalSettings({ 
                  ...localSettings, 
                  require_approval: checked 
                })}
              />
            </div>
            
            <p className="text-sm text-muted-foreground">
              Quando ativado, novos usuários ficam pendentes até um admin aprovar.
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Security Tips */}
      <Alert className="border-primary/30 bg-primary/5">
        <Lightbulb className="h-4 w-4 text-primary" />
        <AlertTitle>Dicas de Segurança</AlertTitle>
        <AlertDescription>
          <ul className="mt-2 space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>
                <strong>Restrição por domínio:</strong> Garante que apenas emails da sua organização possam se cadastrar.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>
                <strong>Aprovação manual:</strong> Permite revisar cada novo cadastro antes de liberar acesso.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>
                <strong>Revisão periódica:</strong> Revise regularmente os membros e suas permissões.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>
                <strong>Hierarquia de roles:</strong> Use Admin apenas para quem precisa de acesso total.
              </span>
            </li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
