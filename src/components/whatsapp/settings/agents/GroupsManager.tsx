import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, ChevronRight, Users, Phone, X } from 'lucide-react';
import {
  useAgentGroups, useUpsertAgentGroup, useDeleteAgentGroup,
  useAgentGroupMembers, useAddGroupMember, useRemoveGroupMember,
} from '@/hooks/useWhatsappAgents';
import { LoadingState } from '@/components/common/LoadingState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MemberConnection } from './MemberConnection';

export function GroupsManager({ agentId }: { agentId: string }) {
  const { data: groups = [], isLoading } = useAgentGroups(agentId);
  const upsertGroup = useUpsertAgentGroup();
  const deleteGroup = useDeleteAgentGroup();
  const [creating, setCreating] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', topics: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCreateGroup = () => {
    upsertGroup.mutate({
      agent_id: agentId,
      name: groupForm.name,
      description: groupForm.description,
      default_for_topics: groupForm.topics.split(',').map(t => t.trim()).filter(Boolean),
    });
    setGroupForm({ name: '', description: '', topics: '' });
    setCreating(false);
  };

  if (isLoading) return <LoadingState message="Carregando grupos..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Departamentos / Grupos</p>
          <p className="text-xs text-muted-foreground">
            Crie grupos por departamento e vincule os telefones dos membros.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo grupo
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-8 border rounded-lg">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum grupo cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <button
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                    onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                  >
                    <ChevronRight className={`h-4 w-4 transition-transform ${expandedId === g.id ? 'rotate-90' : ''}`} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{g.name}</p>
                      {g.description && <p className="text-xs text-muted-foreground truncate">{g.description}</p>}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {g.default_for_topics?.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive shrink-0"
                    onClick={() => deleteGroup.mutate({ id: g.id, agent_id: agentId })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {expandedId === g.id && (
                  <div className="mt-3 pt-3 border-t">
                    <MembersManager groupId={g.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo grupo / departamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="Ex: Vendas, Financeiro, Diretoria"
              />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label>Tópicos automáticos (separados por vírgula)</Label>
              <Input
                value={groupForm.topics}
                onChange={(e) => setGroupForm({ ...groupForm, topics: e.target.value })}
                placeholder="financeiro, cobranca, boleto"
              />
              <p className="text-xs text-muted-foreground">
                Mensagens classificadas com estes tópicos serão roteadas automaticamente para este grupo.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={handleCreateGroup} disabled={!groupForm.name}>Criar grupo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembersManager({ groupId }: { groupId: string }) {
  const { data: members = [] } = useAgentGroupMembers(groupId);
  const add = useAddGroupMember();
  const remove = useRemoveGroupMember();
  const [bulk, setBulk] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleAddOne = () => {
    if (!phone) return;
    add.mutate({ group_id: groupId, phone_e164: phone, display_name: name || undefined });
    setPhone(''); setName('');
  };

  const handleBulk = () => {
    const lines = bulk.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      const [p, ...rest] = line.split(/[,;|]/).map(s => s.trim());
      if (p) add.mutate({ group_id: groupId, phone_e164: p, display_name: rest.join(' ') || undefined });
    });
    setBulk('');
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">MEMBROS ({members.length})</p>

      {members.length > 0 && (
        <div className="space-y-1">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/40">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-sm font-mono">{m.phone_e164}</span>
                {m.display_name && (
                  <span className="text-xs text-muted-foreground truncate">— {m.display_name}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <MemberConnection phoneE164={m.phone_e164} displayName={m.display_name} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate({ id: m.id, group_id: groupId })}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Input placeholder="+5511999999999" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input placeholder="Nome (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
        <Button size="sm" onClick={handleAddOne} disabled={!phone}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Adicionar em massa
        </summary>
        <div className="mt-2 space-y-2">
          <Textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={`+5511999999999, Bruno\n+5511888888888, Maria`}
            rows={4}
            className="font-mono text-xs"
          />
          <Button size="sm" variant="outline" onClick={handleBulk} disabled={!bulk.trim()}>
            Importar
          </Button>
        </div>
      </details>
    </div>
  );
}
