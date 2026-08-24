 import { useMemo, useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { 
   TrendingUp, 
   TrendingDown, 
   Users, 
   ShoppingCart, 
   AlertTriangle,
   Clock,
   Target,
   UserX,
   Calendar,
   ArrowUpRight,
   ArrowDownRight,
   Minus
 } from 'lucide-react';
 import { formatCurrency, formatInteger, formatPercent } from '@/utils/formatters';
 import { useComercialData } from '@/hooks/useComercialData';
 import { LoadingState } from '@/components/common/LoadingState';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { cn } from '@/lib/utils';
 
 export function AnaliseDiariaLayoutLegacy() {
   const { pedidos, isLoading } = useComercialData({});
   const [activeTab, setActiveTab] = useState('resumo');
   
   // "Hoje" = data mais recente do JSON (fallback: hoje do sistema)
   const hojeStr = useMemo(() => {
     if (!pedidos.length) return new Date().toISOString().split('T')[0];
     let max = '';
     for (const p of pedidos) {
       const d = ((p.data_pedido || p.data_faturamento || '') as string).slice(0, 10);
       if (d && d > max) max = d;
     }
     return max || new Date().toISOString().split('T')[0];
   }, [pedidos]);
   const hoje = useMemo(() => new Date(hojeStr + 'T12:00:00'), [hojeStr]);
   const ontemStr = useMemo(() => {
     const d = new Date(hoje); d.setDate(d.getDate() - 1);
     return d.toISOString().split('T')[0];
   }, [hoje]);

   
   // Análise do dia atual
   const analiseHoje = useMemo(() => {
     const pedidosHoje = pedidos.filter(p => 
       p.data_pedido?.startsWith(hojeStr) || p.data_faturamento?.startsWith(hojeStr)
     );
     const pedidosOntem = pedidos.filter(p => 
       p.data_pedido?.startsWith(ontemStr) || p.data_faturamento?.startsWith(ontemStr)
     );
     
     const faturamentoHoje = pedidosHoje
       .filter(p => p.status === 'faturado')
       .reduce((acc, p) => acc + (p.valor_liquido || 0), 0);
     
     const faturamentoOntem = pedidosOntem
       .filter(p => p.status === 'faturado')
       .reduce((acc, p) => acc + (p.valor_liquido || 0), 0);
     
     const pedidosRealizadosHoje = pedidosHoje.length;
     const pedidosRealizadosOntem = pedidosOntem.length;
     
     const clientesHoje = new Set(pedidosHoje.map(p => p.cliente_codigo)).size;
     const clientesOntem = new Set(pedidosOntem.map(p => p.cliente_codigo)).size;
     
     const vendedoresAtivosHoje = new Set(pedidosHoje.map(p => p.vendedor_codigo)).size;
     const vendedoresAtivosOntem = new Set(pedidosOntem.map(p => p.vendedor_codigo)).size;
     
     return {
       faturamentoHoje,
       faturamentoOntem,
       variacaoFaturamento: faturamentoOntem > 0 
         ? ((faturamentoHoje - faturamentoOntem) / faturamentoOntem) * 100 
         : 0,
       pedidosHoje: pedidosRealizadosHoje,
       pedidosOntem: pedidosRealizadosOntem,
       variacaoPedidos: pedidosRealizadosOntem > 0 
         ? ((pedidosRealizadosHoje - pedidosRealizadosOntem) / pedidosRealizadosOntem) * 100 
         : 0,
       clientesHoje,
       clientesOntem,
       vendedoresAtivosHoje,
       vendedoresAtivosOntem,
       ticketMedioHoje: pedidosRealizadosHoje > 0 ? faturamentoHoje / pedidosRealizadosHoje : 0,
     };
   }, [pedidos, hojeStr, ontemStr]);
   
   // Média diária do mês atual
   const mediaDiaria = useMemo(() => {
     const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
     const pedidosMes = pedidos.filter(p => 
       p.status === 'faturado' && 
       (p.data_faturamento?.startsWith(mesAtual) || p.data_pedido?.startsWith(mesAtual))
     );
     
     // Agrupar por dia
     const porDia: Record<string, number> = {};
     pedidosMes.forEach(p => {
       const dia = (p.data_faturamento || p.data_pedido || '').split('T')[0];
       if (dia) {
         porDia[dia] = (porDia[dia] || 0) + (p.valor_liquido || 0);
       }
     });
     
     const dias = Object.keys(porDia).length;
     const total = Object.values(porDia).reduce((a, b) => a + b, 0);
     
     return {
       media: dias > 0 ? total / dias : 0,
       diasComVenda: dias,
       totalMes: total,
     };
   }, [pedidos, hoje]);
   
   // Performance dos vendedores hoje
   const performanceVendedores = useMemo(() => {
     const pedidosHoje = pedidos.filter(p => 
       p.data_pedido?.startsWith(hojeStr) || p.data_faturamento?.startsWith(hojeStr)
     );
     
     const porVendedor: Record<string, { 
       codigo: string | number; 
       nome: string; 
       faturamento: number; 
       pedidos: number;
       clientes: Set<string | number>;
     }> = {};
     
     pedidosHoje.forEach(p => {
       const codigo = String(p.vendedor_codigo);
       if (!porVendedor[codigo]) {
         porVendedor[codigo] = {
           codigo: p.vendedor_codigo,
           nome: p.vendedor_nome || `Vendedor ${codigo}`,
           faturamento: 0,
           pedidos: 0,
           clientes: new Set(),
         };
       }
       if (p.status === 'faturado') {
         porVendedor[codigo].faturamento += p.valor_liquido || 0;
       }
       porVendedor[codigo].pedidos += 1;
       porVendedor[codigo].clientes.add(p.cliente_codigo);
     });
     
     // Calcular média diária de cada vendedor no mês
     const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
     const mediasPorVendedor: Record<string, number> = {};
     
     const pedidosMes = pedidos.filter(p => 
       p.status === 'faturado' && 
       (p.data_faturamento?.startsWith(mesAtual) || p.data_pedido?.startsWith(mesAtual))
     );
     
     pedidosMes.forEach(p => {
       const codigo = String(p.vendedor_codigo);
       mediasPorVendedor[codigo] = (mediasPorVendedor[codigo] || 0) + (p.valor_liquido || 0);
     });
     
     // Dividir pelo número de dias úteis decorridos
     const diasDecorridos = hoje.getDate();
     Object.keys(mediasPorVendedor).forEach(codigo => {
       mediasPorVendedor[codigo] = mediasPorVendedor[codigo] / diasDecorridos;
     });
     
     return Object.values(porVendedor)
       .map(v => ({
         ...v,
         clientes: v.clientes.size,
         mediaDiaria: mediasPorVendedor[String(v.codigo)] || 0,
         status: v.faturamento >= (mediasPorVendedor[String(v.codigo)] || 0) ? 'acima' : 'abaixo',
       }))
       .sort((a, b) => b.faturamento - a.faturamento);
   }, [pedidos, hojeStr, hoje]);
   
   // Vendedores sem vendas hoje
   const vendedoresSemVendaHoje = useMemo(() => {
     const pedidosHoje = pedidos.filter(p => 
       p.data_pedido?.startsWith(hojeStr) || p.data_faturamento?.startsWith(hojeStr)
     );
     const vendedoresHoje = new Set(pedidosHoje.map(p => String(p.vendedor_codigo)));
     
     // Todos os vendedores ativos no mês
     const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
     const vendedoresMes = new Map<string, string>();
     
     pedidos
       .filter(p => p.data_pedido?.startsWith(mesAtual) || p.data_faturamento?.startsWith(mesAtual))
       .forEach(p => {
         vendedoresMes.set(String(p.vendedor_codigo), p.vendedor_nome || `Vendedor ${p.vendedor_codigo}`);
       });
     
     return Array.from(vendedoresMes.entries())
       .filter(([codigo]) => !vendedoresHoje.has(codigo))
       .map(([codigo, nome]) => ({ codigo, nome }));
   }, [pedidos, hojeStr, hoje]);
   
   // Clientes recorrentes que não compraram hoje
   const clientesInativosHoje = useMemo(() => {
     const pedidosHoje = pedidos.filter(p => 
       p.data_pedido?.startsWith(hojeStr) || p.data_faturamento?.startsWith(hojeStr)
     );
     const clientesHoje = new Set(pedidosHoje.map(p => String(p.cliente_codigo)));
     
     // Clientes com mais de 3 compras nos últimos 30 dias
     const trintaDiasAtras = new Date(hoje);
     trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
     const trintaDiasStr = trintaDiasAtras.toISOString().split('T')[0];
     
     const clientesFrequentes: Record<string, { 
       codigo: string; 
       nome: string;
       compras: number;
       ultimaCompra: string;
       valorTotal: number;
     }> = {};
     
     pedidos
       .filter(p => (p.data_pedido || '') >= trintaDiasStr)
       .forEach(p => {
         const codigo = String(p.cliente_codigo);
         if (!clientesFrequentes[codigo]) {
           clientesFrequentes[codigo] = {
             codigo,
             nome: p.cliente_fantasia || p.cliente_razao || `Cliente ${codigo}`,
             compras: 0,
             ultimaCompra: p.data_pedido || '',
             valorTotal: 0,
           };
         }
         clientesFrequentes[codigo].compras += 1;
         clientesFrequentes[codigo].valorTotal += p.valor_liquido || 0;
         if ((p.data_pedido || '') > clientesFrequentes[codigo].ultimaCompra) {
           clientesFrequentes[codigo].ultimaCompra = p.data_pedido || '';
         }
       });
     
     return Object.values(clientesFrequentes)
       .filter(c => c.compras >= 3 && !clientesHoje.has(c.codigo))
       .sort((a, b) => b.compras - a.compras)
       .slice(0, 10);
   }, [pedidos, hojeStr, hoje]);
   
   if (isLoading) {
     return <LoadingState message="Carregando análise diária..." />;
   }
   
   const getTrendIcon = (value: number) => {
     if (value > 0) return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
     if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
     return <Minus className="h-4 w-4 text-muted-foreground" />;
   };
   
   return (
     <div className="p-4 md:p-6 space-y-6">
       {/* Header */}
       <div className="page-header">
         <div>
           <h1 className="page-title flex items-center gap-2">
             <Calendar className="h-7 w-7 text-primary" />
             Análise Diária
           </h1>
           <p className="page-subtitle">
             Performance do dia {hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
           </p>
         </div>
         <Badge variant="outline" className="text-sm px-4 py-2">
           <Clock className="h-4 w-4 mr-2" />
           Atualizado às {hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
         </Badge>
       </div>
       
       <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
         <TabsList className="grid w-full grid-cols-3">
           <TabsTrigger value="resumo">Resumo do Dia</TabsTrigger>
           <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
           <TabsTrigger value="alertas">Alertas</TabsTrigger>
         </TabsList>
         
         <TabsContent value="resumo" className="space-y-6">
           {/* KPIs do Dia */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <Card>
               <CardContent className="p-4">
                 <div className="flex items-center justify-between mb-2">
                   <span className="text-sm text-muted-foreground">Faturamento Hoje</span>
                   {getTrendIcon(analiseHoje.variacaoFaturamento)}
                 </div>
                 <p className="text-2xl font-bold">{formatCurrency(analiseHoje.faturamentoHoje)}</p>
                 <div className="flex items-center gap-1 mt-1">
                   <span className={cn(
                     "text-xs",
                     analiseHoje.variacaoFaturamento > 0 ? "text-emerald-500" : 
                     analiseHoje.variacaoFaturamento < 0 ? "text-red-500" : "text-muted-foreground"
                   )}>
                     {formatPercent(analiseHoje.variacaoFaturamento, true)} vs ontem
                   </span>
                 </div>
               </CardContent>
             </Card>
             
             <Card>
               <CardContent className="p-4">
                 <div className="flex items-center justify-between mb-2">
                   <span className="text-sm text-muted-foreground">Pedidos Hoje</span>
                   <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                 </div>
                 <p className="text-2xl font-bold">{formatInteger(analiseHoje.pedidosHoje)}</p>
                 <div className="flex items-center gap-1 mt-1">
                   <span className={cn(
                     "text-xs",
                     analiseHoje.variacaoPedidos > 0 ? "text-emerald-500" : 
                     analiseHoje.variacaoPedidos < 0 ? "text-red-500" : "text-muted-foreground"
                   )}>
                     {analiseHoje.pedidosOntem} ontem
                   </span>
                 </div>
               </CardContent>
             </Card>
             
             <Card>
               <CardContent className="p-4">
                 <div className="flex items-center justify-between mb-2">
                   <span className="text-sm text-muted-foreground">Clientes Atendidos</span>
                   <Users className="h-4 w-4 text-muted-foreground" />
                 </div>
                 <p className="text-2xl font-bold">{formatInteger(analiseHoje.clientesHoje)}</p>
                 <div className="flex items-center gap-1 mt-1">
                   <span className="text-xs text-muted-foreground">
                     {analiseHoje.clientesOntem} ontem
                   </span>
                 </div>
               </CardContent>
             </Card>
             
             <Card>
               <CardContent className="p-4">
                 <div className="flex items-center justify-between mb-2">
                   <span className="text-sm text-muted-foreground">Ticket Médio</span>
                   <Target className="h-4 w-4 text-muted-foreground" />
                 </div>
                 <p className="text-2xl font-bold">{formatCurrency(analiseHoje.ticketMedioHoje)}</p>
               </CardContent>
             </Card>
           </div>
           
           {/* Comparativo com Média */}
           <Card>
             <CardHeader className="pb-2">
               <CardTitle className="text-base flex items-center gap-2">
                 <TrendingUp className="h-5 w-5 text-primary" />
                 Comparativo com Média Diária do Mês
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="text-center p-4 rounded-lg bg-muted/50">
                   <p className="text-sm text-muted-foreground mb-1">Média Diária (Mês)</p>
                   <p className="text-xl font-bold">{formatCurrency(mediaDiaria.media)}</p>
                 </div>
                 <div className="text-center p-4 rounded-lg bg-muted/50">
                   <p className="text-sm text-muted-foreground mb-1">Faturamento Hoje</p>
                   <p className={cn(
                     "text-xl font-bold",
                     analiseHoje.faturamentoHoje >= mediaDiaria.media ? "text-emerald-500" : "text-red-500"
                   )}>
                     {formatCurrency(analiseHoje.faturamentoHoje)}
                   </p>
                 </div>
                 <div className="text-center p-4 rounded-lg bg-muted/50">
                   <p className="text-sm text-muted-foreground mb-1">Diferença</p>
                   <p className={cn(
                     "text-xl font-bold",
                     analiseHoje.faturamentoHoje >= mediaDiaria.media ? "text-emerald-500" : "text-red-500"
                   )}>
                     {formatCurrency(analiseHoje.faturamentoHoje - mediaDiaria.media)}
                   </p>
                 </div>
               </div>
               
               {/* Barra de progresso visual */}
               <div className="mt-4">
                 <div className="flex justify-between text-xs text-muted-foreground mb-1">
                   <span>Progresso em relação à média</span>
                   <span>
                     {mediaDiaria.media > 0 
                       ? formatPercent((analiseHoje.faturamentoHoje / mediaDiaria.media) * 100)
                       : '0%'}
                   </span>
                 </div>
                 <div className="h-3 bg-muted rounded-full overflow-hidden">
                   <div 
                     className={cn(
                       "h-full rounded-full transition-all",
                       analiseHoje.faturamentoHoje >= mediaDiaria.media 
                         ? "bg-emerald-500" 
                         : "bg-amber-500"
                     )}
                     style={{ 
                       width: `${Math.min(100, mediaDiaria.media > 0 
                         ? (analiseHoje.faturamentoHoje / mediaDiaria.media) * 100 
                         : 0)}%` 
                     }}
                   />
                 </div>
               </div>
             </CardContent>
           </Card>
           
           {/* Vendedores Ativos vs Inativos */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Card>
               <CardHeader className="pb-2">
                 <CardTitle className="text-base flex items-center gap-2">
                   <Users className="h-5 w-5 text-emerald-500" />
                   Vendedores Ativos Hoje
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="text-4xl font-bold text-emerald-500">
                   {analiseHoje.vendedoresAtivosHoje}
                 </div>
                 <p className="text-sm text-muted-foreground mt-1">
                   realizaram ao menos 1 venda
                 </p>
               </CardContent>
             </Card>
             
             <Card>
               <CardHeader className="pb-2">
                 <CardTitle className="text-base flex items-center gap-2">
                   <UserX className="h-5 w-5 text-amber-500" />
                   Vendedores Sem Venda Hoje
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="text-4xl font-bold text-amber-500">
                   {vendedoresSemVendaHoje.length}
                 </div>
                 <p className="text-sm text-muted-foreground mt-1">
                   ativos no mês, mas sem venda hoje
                 </p>
               </CardContent>
             </Card>
           </div>
         </TabsContent>
         
         <TabsContent value="vendedores" className="space-y-6">
           {/* Performance dos Vendedores Hoje */}
           <Card>
             <CardHeader>
               <CardTitle className="text-base">Performance Individual Hoje</CardTitle>
             </CardHeader>
             <CardContent>
               {performanceVendedores.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">
                   <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                   <p>Nenhuma venda registrada hoje</p>
                 </div>
               ) : (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Vendedor</TableHead>
                       <TableHead className="text-right">Faturamento</TableHead>
                       <TableHead className="text-right">Média Diária</TableHead>
                       <TableHead className="text-right">Pedidos</TableHead>
                       <TableHead className="text-right">Clientes</TableHead>
                       <TableHead className="text-center">Status</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {performanceVendedores.map((v) => (
                       <TableRow key={String(v.codigo)}>
                         <TableCell className="font-medium">{v.nome}</TableCell>
                         <TableCell className="text-right">{formatCurrency(v.faturamento)}</TableCell>
                         <TableCell className="text-right text-muted-foreground">
                           {formatCurrency(v.mediaDiaria)}
                         </TableCell>
                         <TableCell className="text-right">{v.pedidos}</TableCell>
                         <TableCell className="text-right">{v.clientes}</TableCell>
                         <TableCell className="text-center">
                           <Badge variant={v.status === 'acima' ? 'default' : 'secondary'} 
                                  className={cn(
                                    v.status === 'acima' 
                                      ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' 
                                      : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                                  )}>
                             {v.status === 'acima' ? 'Acima da média' : 'Abaixo da média'}
                           </Badge>
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               )}
             </CardContent>
           </Card>
           
           {/* Vendedores Sem Venda */}
           {vendedoresSemVendaHoje.length > 0 && (
             <Card className="border-amber-500/30">
               <CardHeader>
                 <CardTitle className="text-base flex items-center gap-2">
                   <AlertTriangle className="h-5 w-5 text-amber-500" />
                   Vendedores Sem Venda Hoje
                 </CardTitle>
               </CardHeader>
               <CardContent>
                 <div className="flex flex-wrap gap-2">
                   {vendedoresSemVendaHoje.map((v) => (
                     <Badge key={v.codigo} variant="outline" className="py-2 px-3">
                       {v.nome}
                     </Badge>
                   ))}
                 </div>
               </CardContent>
             </Card>
           )}
         </TabsContent>
         
         <TabsContent value="alertas" className="space-y-6">
           {/* Clientes Frequentes que não compraram */}
           <Card className="border-orange-500/30">
             <CardHeader>
               <CardTitle className="text-base flex items-center gap-2">
                 <AlertTriangle className="h-5 w-5 text-orange-500" />
                 Clientes Frequentes Sem Compra Hoje
               </CardTitle>
               <p className="text-sm text-muted-foreground">
                 Clientes com 3+ compras nos últimos 30 dias que ainda não compraram hoje
               </p>
             </CardHeader>
             <CardContent>
               {clientesInativosHoje.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">
                   <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                   <p>Todos os clientes frequentes já compraram hoje!</p>
                 </div>
               ) : (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Cliente</TableHead>
                       <TableHead className="text-right">Compras (30d)</TableHead>
                       <TableHead className="text-right">Valor Total</TableHead>
                       <TableHead className="text-right">Última Compra</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {clientesInativosHoje.map((c) => (
                       <TableRow key={c.codigo}>
                         <TableCell className="font-medium">{c.nome}</TableCell>
                         <TableCell className="text-right">{c.compras}</TableCell>
                         <TableCell className="text-right">{formatCurrency(c.valorTotal)}</TableCell>
                         <TableCell className="text-right text-muted-foreground">
                           {c.ultimaCompra ? new Date(c.ultimaCompra).toLocaleDateString('pt-BR') : '-'}
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               )}
             </CardContent>
           </Card>
           
           {/* Resumo de Alertas */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Card className={cn(
               analiseHoje.faturamentoHoje < mediaDiaria.media 
                 ? "border-red-500/30 bg-red-500/5" 
                 : "border-emerald-500/30 bg-emerald-500/5"
             )}>
               <CardContent className="p-4">
                 <div className="flex items-start gap-3">
                   {analiseHoje.faturamentoHoje < mediaDiaria.media ? (
                     <TrendingDown className="h-6 w-6 text-red-500 mt-0.5" />
                   ) : (
                     <TrendingUp className="h-6 w-6 text-emerald-500 mt-0.5" />
                   )}
                   <div>
                     <p className="font-medium">
                       {analiseHoje.faturamentoHoje < mediaDiaria.media 
                         ? "Faturamento abaixo da média" 
                         : "Faturamento acima da média"}
                     </p>
                     <p className="text-sm text-muted-foreground">
                       {analiseHoje.faturamentoHoje < mediaDiaria.media 
                         ? `Faltam ${formatCurrency(mediaDiaria.media - analiseHoje.faturamentoHoje)} para atingir a média diária`
                         : `Superou a média em ${formatCurrency(analiseHoje.faturamentoHoje - mediaDiaria.media)}`}
                     </p>
                   </div>
                 </div>
               </CardContent>
             </Card>
             
             <Card className={cn(
               vendedoresSemVendaHoje.length > 0 
                 ? "border-amber-500/30 bg-amber-500/5" 
                 : "border-emerald-500/30 bg-emerald-500/5"
             )}>
               <CardContent className="p-4">
                 <div className="flex items-start gap-3">
                   <UserX className={cn(
                     "h-6 w-6 mt-0.5",
                     vendedoresSemVendaHoje.length > 0 ? "text-amber-500" : "text-emerald-500"
                   )} />
                   <div>
                     <p className="font-medium">
                       {vendedoresSemVendaHoje.length > 0 
                         ? `${vendedoresSemVendaHoje.length} vendedor(es) sem venda`
                         : "Todos os vendedores venderam hoje"}
                     </p>
                     <p className="text-sm text-muted-foreground">
                       {vendedoresSemVendaHoje.length > 0 
                         ? "Considere verificar a disponibilidade ou apoiar estes vendedores"
                         : "Excelente! Toda a equipe está produzindo"}
                     </p>
                   </div>
                 </div>
               </CardContent>
             </Card>
           </div>
         </TabsContent>
       </Tabs>
     </div>
   );
 }