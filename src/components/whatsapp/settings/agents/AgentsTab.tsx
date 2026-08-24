import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Plus, Pencil, Trash2, Pause, Play, Sparkles, Plug, AlertCircle } from 'lucide-react';
import { useWhatsappAgents, useUpsertAgent, useDeleteAgent, type WhatsappAgent } from '@/hooks/useWhatsappAgents';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { AgentEditor } from './AgentEditor';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEmpresaAtiva } from '@/hooks/useEmpresaAtiva';

export function AgentsTab() {
  const { hasEmpresaSelecionada } = useEmpresaAtiva();
  const { data: agents = [], isLoading } = useWhatsappAgents();
  const upsert = useUpsertAgent();
  const remove = useDeleteAgent();

  const [editing, setEditing] = useState<WhatsappAgent | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WhatsappAgent | null>(null);

  if (!hasEmpresaSelecionada) {
    return (
      <EmptyState
        icon={<Bot className="h-8 w-8 text-muted-foreground" />}
        title="Selecione uma empresa"
        message="Escolha uma empresa para gerenciar agentes."
      />
    );
  }

  if (isLoading) return <LoadingState message="Carregando agentes..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Agentes
          </h2>
          <p className="text-sm text-muted-foreground">
            Centralize conversas internas por departamento e supervisione atendimentos com IA.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Agente
        </Button>
      </div>

      {agents.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            icon={<Bot className="h-8 w-8 text-muted-foreground" />}
            title="Nenhum agente cadastrado"
            message="Crie um agente para distribuir mensagens em grupos por departamento."
          />
          <div className="flex justify-center">
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-2" /> Criar primeiro agente
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <Card key={a.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.phone_e164 || 'Sem número'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={a.is_active ? 'default' : 'secondary'}>
                    {a.is_active ? 'Ativo' : 'Pausado'}
                  </Badge>
                </div>

                {a.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                )}

                <div className="flex items-center gap-2 text-xs flex-wrap">
                  {a.instance_id ? (
                    <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                      <Plug className="h-3 w-3" /> Instância vinculada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                      <AlertCircle className="h-3 w-3" /> Sem instância
                    </Badge>
                  )}
                  {a.supervises_clients && (
                    <Badge variant="outline" className="gap-1">
                      <Sparkles className="h-3 w-3" /> Supervisor
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-end gap-1 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => upsert.mutate({ id: a.id, is_active: !a.is_active })}
                  >
                    {a.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteTarget(a)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <AgentEditor
          open={creating || !!editing}
          agent={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover agente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o agente <strong>{deleteTarget?.name}</strong>, todos os seus grupos
              e o histórico de broadcasts. Não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (deleteTarget) remove.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
