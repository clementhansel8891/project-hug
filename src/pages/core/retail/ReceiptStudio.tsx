import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  Settings, 
  Eye, 
  Save, 
  Plus, 
  Trash2, 
  GripVertical,
  Type,
  Trash,
  Barcode as BarcodeIcon,
  QrCode,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2
} from 'lucide-react';
import Barcode from 'react-barcode';
import { useSession } from '@/core/security/session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ReceiptComponent, ReceiptTemplate } from '@/core/types/retail/receiptTemplate';

export default function ReceiptStudio() {
  const session = useSession();
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');
  const [components, setComponents] = useState<ReceiptComponent[]>([
    { id: '1', type: 'header', title: 'Store Branding', visible: true, order: 0, config: { alignment: 'center', bold: true } },
    { id: '2', type: 'transaction_info', title: 'Transaction Telemetry', visible: true, order: 1 },
    { id: '3', type: 'item_list', title: 'Itemized Grid', visible: true, order: 2 },
    { id: '4', type: 'totals_ledger', title: 'Financial Ledger', visible: true, order: 3 },
    { id: '5', type: 'payment_info', title: 'Payment Context', visible: true, order: 4 },
    { id: '6', type: 'qr_code', title: 'Marketing QR', visible: true, order: 5, config: { alignment: 'center' } },
    { id: '8', type: 'barcode', title: 'Transaction Barcode', visible: true, order: 6, config: { alignment: 'center' } },
    { id: '7', type: 'footer_text', title: 'Marketing Footer', visible: true, order: 7, config: { alignment: 'center', content: 'THANK YOU FOR SHOPPING!' } },
  ]);

  const [activeComponentId, setActiveComponentId] = useState<string | null>('1');

  const updateComponent = (id: string, updates: Partial<ReceiptComponent>) => {
    setComponents((Array.isArray(components) ? components : []).map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const activeComponent = useMemo(() => components.find(c => c.id === activeComponentId), [components, activeComponentId]);

  return (
    <div className="min-h-screen bg-muted p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Studio Header */}
        <div className="flex justify-between items-end border-b border-border pb-8">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
              <Printer className="w-10 h-10 text-primary" />
              Receipt Studio
            </h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Thermal Architecture & Hardware Profiling</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" className="h-12 px-6 rounded-xl font-black uppercase italic tracking-widest text-[10px] bg-muted border-border text-white hover:bg-muted/10 gap-2">
                <Eye className="w-4 h-4" /> Hardware Ping
             </Button>
             <Button className="h-12 px-8 rounded-xl font-black uppercase italic tracking-widest text-[10px] bg-primary hover:bg-primary gap-2 shadow-lg shadow-indigo-600/20">
                <Save className="w-4 h-4" /> Push to Terminal
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr_400px] gap-8 h-[calc(100vh-250px)]">
          {/* Left Sidebar: Components Tree */}
          <Card className="bg-muted border-white/5 shadow-2xl overflow-hidden flex flex-col">
            <CardHeader className="p-6 bg-muted text-white shrink-0 border-b border-border">
               <CardTitle className="text-sm font-black uppercase italic tracking-wider">Thermal Stack</CardTitle>
               <CardDescription className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Ordered Layout Nodes</CardDescription>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
               <div className="space-y-2">
                  {components.sort((a, b) => a.order - b.order).map((comp) => (
                    <div 
                      key={comp.id} 
                      className={cn(
                        "group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                        activeComponentId === comp.id ? "bg-primary border-primary" : "bg-muted border-white/5 hover:border-border"
                      )}
                      onClick={() => setActiveComponentId(comp.id)}
                    >
                      <div className="flex items-center gap-3">
                         <GripVertical className="w-4 h-4 text-muted-foreground group-hover:text-muted-foreground" />
                         <div className="space-y-0.5">
                            <p className={cn("text-xs font-black uppercase tracking-tight", activeComponentId === comp.id ? "text-primary" : "text-muted-foreground")}>{comp.title}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">{comp.type}</p>
                         </div>
                      </div>
                      <Switch checked={comp.visible} onCheckedChange={(val) => updateComponent(comp.id, { visible: val })} className="scale-75" />
                    </div>
                  ))}
               </div>
            </ScrollArea>
          </Card>

          {/* Center: Live Thermal Preview */}
          <div className="flex flex-col items-center justify-center overflow-hidden">
             <div className="bg-card p-8 shadow-2xl flex flex-col transition-all duration-300 relative group" style={{ width: paperWidth === '80mm' ? '380px' : '300px', minHeight: '600px' }}>
                <div className="absolute -top-1 left-0 w-full h-1 bg-muted flex gap-1 overflow-hidden opacity-50">
                   {Array.from({ length: 40 }).map((_, i) => <div key={i} className="w-4 h-1 bg-muted shrink-0" />)}
                </div>

                <div className="flex-1 space-y-4 font-mono text-black leading-tight text-[11px] uppercase">
                   {(Array.isArray(components) ? components : []).filter(c => c.visible).sort((a, b) => a.order - b.order).map((comp) => (
                      <div key={comp.id} className={cn("relative", activeComponentId === comp.id && "bg-primary ring-2 ring-indigo-100 rounded p-2 -m-2")}>
                         {comp.type === 'header' && (
                            <div className={cn("space-y-1 py-2 flex flex-col", comp.config?.alignment === 'center' ? "items-center text-center" : "items-start text-left")}>
                               {comp.config?.logoUrl && (
                                 <img src={comp.config.logoUrl} alt="Store Logo" className="max-h-16 object-contain mb-2 grayscale" />
                               )}
                               <p className="text-sm font-bold tracking-tighter">{comp.title !== 'Store Branding' ? comp.title : 'ZENVIX BOUTIQUE'}</p>
                               <p className="text-[9px]">District 8, Jakarta Selatan</p>
                               <p className="text-[8px]">NPWP: 01.234.567.8-901.000</p>
                            </div>
                         )}

                         {comp.type === 'transaction_info' && (
                            <div className="py-2 border-y border-dashed border-border space-y-0.5 text-[9px]">
                               <div className="flex justify-between"><span>ORDER:</span><span>#ZEN-88291</span></div>
                               <div className="flex justify-between"><span>DATE:</span><span>28/04/2026 22:30</span></div>
                               <div className="flex justify-between"><span>CASHIER:</span><span>ALEX_STERLING</span></div>
                            </div>
                         )}

                         {comp.type === 'item_list' && (
                            <div className="py-4 space-y-2">
                               <div className="flex justify-between border-b border-dashed border-border pb-1 font-bold">
                                  <span>ITEM</span><span>QTY</span><span>TOTAL</span>
                               </div>
                               {[
                                 { name: 'SILVER RING V1', qty: 1, price: '850.00' },
                                 { name: 'OUTFIT SHIRT L', qty: 2, price: '1,200.00' }
                               ].map((item, i) => (
                                 <div key={i} className="space-y-0.5">
                                    <p>{item.name}</p>
                                    <div className="flex justify-between text-[9px]">
                                       <span>{item.qty} X {item.price}</span>
                                       <span>{item.price}</span>
                                    </div>
                                 </div>
                               ))}
                            </div>
                         )}

                         {comp.type === 'totals_ledger' && (
                            <div className="py-2 border-t border-dashed border-border space-y-1">
                               <div className="flex justify-between"><span>SUBTOTAL</span><span>2,050.00</span></div>
                               <div className="flex justify-between"><span>TAX (11%)</span><span>225.50</span></div>
                               <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>2,275.50</span></div>
                            </div>
                         )}

                         {comp.type === 'payment_info' && (
                            <div className="py-2 space-y-0.5 text-[9px]">
                               <div className="flex justify-between"><span>METHOD:</span><span>CASH_IDR</span></div>
                               <div className="flex justify-between"><span>RECEIVED:</span><span>2,500.00</span></div>
                               <div className="flex justify-between"><span>CHANGE:</span><span>224.50</span></div>
                            </div>
                         )}

                         {comp.type === 'qr_code' && (
                            <div className="py-4 flex flex-col items-center gap-2">
                               <QrCode className="w-16 h-16 text-muted-foreground" />
                               <p className="text-[7px]">SCAN FOR DIGITAL ARCHIVE</p>
                            </div>
                         )}

                         {comp.type === 'barcode' && (
                            <div className="py-4 flex flex-col items-center">
                               <Barcode 
                                  value="ZEN-88291" 
                                  width={1.2} 
                                  height={40} 
                                  displayValue={false} 
                                  background="transparent"
                               />
                               <p className="text-[7px] mt-1 tracking-widest font-black italic">ZEN-88291</p>
                            </div>
                         )}

                         {comp.type === 'footer_text' && (
                            <div className="text-center pt-4 opacity-50">
                               <p className="text-[9px] font-bold">{comp.config?.content}</p>
                               <p className="text-[7px] mt-2 italic">Zenvix FlowGate™ Fiscal Node</p>
                            </div>
                         )}
                      </div>
                   ))}
                </div>

                <div className="absolute -bottom-1 left-0 w-full h-1 bg-muted flex gap-1 overflow-hidden opacity-50">
                   {Array.from({ length: 40 }).map((_, i) => <div key={i} className="w-4 h-1 bg-muted shrink-0" />)}
                </div>
             </div>

             <div className="mt-8 flex gap-4">
                <Button 
                  variant={paperWidth === '58mm' ? 'default' : 'outline'} 
                  className={cn("h-10 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all", paperWidth === '58mm' ? "bg-primary" : "bg-muted border-border text-white")}
                  onClick={() => setPaperWidth('58mm')}
                >
                   58mm Profiler
                </Button>
                <Button 
                  variant={paperWidth === '80mm' ? 'default' : 'outline'} 
                  className={cn("h-10 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all", paperWidth === '80mm' ? "bg-primary" : "bg-muted border-border text-white")}
                  onClick={() => setPaperWidth('80mm')}
                >
                   80mm Profiler
                </Button>
             </div>
          </div>

          {/* Right Sidebar: Component Config */}
          <Card className="bg-muted border-white/5 shadow-2xl overflow-hidden flex flex-col">
             <CardHeader className="p-6 bg-muted text-white shrink-0 border-b border-border">
                <div className="flex items-center gap-2 mb-1">
                   <Settings className="w-4 h-4 text-muted-foreground" />
                   <CardTitle className="text-sm font-black uppercase italic tracking-wider">Node Config</CardTitle>
                </div>
                <CardDescription className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Thermal Precision Tuning</CardDescription>
             </CardHeader>
             
             <ScrollArea className="flex-1">
                {activeComponent ? (
                   <div className="p-6 space-y-6">
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Block Identity</Label>
                            <Input 
                               value={activeComponent.title} 
                               onChange={(e) => updateComponent(activeComponent.id, { title: e.target.value })}
                               className="h-10 rounded-xl bg-muted border-border text-white font-bold text-xs"
                            />
                         </div>

                         <div className="space-y-2">
                            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Alignment</Label>
                            <div className="flex gap-2">
                               {[
                                 { icon: AlignLeft, val: 'left' },
                                 { icon: AlignCenter, val: 'center' },
                                 { icon: AlignRight, val: 'right' }
                               ].map((align) => (
                                 <Button 
                                    key={align.val}
                                    variant="outline" 
                                    className={cn("flex-1 h-12 bg-muted border-border text-white", activeComponent.config?.alignment === align.val && "bg-primary border-primary")}
                                    onClick={() => updateComponent(activeComponent.id, { config: { ...activeComponent.config, alignment: align.val as any } })}
                                 >
                                    <align.icon className="w-4 h-4" />
                                 </Button>
                               ))}
                            </div>
                         </div>

                         {activeComponent.type === 'header' && (
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Logo Image URL</Label>
                              <Input 
                                 placeholder="https://example.com/logo.png"
                                 className="h-10 rounded-xl bg-muted border-border text-white font-bold text-xs"
                                 value={activeComponent.config?.logoUrl || ''}
                                 onChange={(e) => updateComponent(activeComponent.id, { config: { ...activeComponent.config, logoUrl: e.target.value } })}
                              />
                           </div>
                         )}
                      </div>

                      {activeComponent.type === 'footer_text' && (
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Marketing Copy</Label>
                           <textarea 
                              className="w-full h-24 p-3 rounded-xl bg-muted border border-border text-white font-medium text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                              value={activeComponent.config?.content}
                              onChange={(e) => updateComponent(activeComponent.id, { config: { ...activeComponent.config, content: e.target.value } })}
                           />
                        </div>
                      )}

                      <Separator className="bg-muted" />

                      <div className="p-4 bg-primary border border-primary rounded-2xl">
                         <p className="text-[9px] font-bold text-primary uppercase leading-relaxed tracking-widest">
                            This node is logic-bound to the transaction lifecycle. Values will be dynamically hydrated during checkout.
                         </p>
                      </div>
                   </div>
                ) : (
                   <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center opacity-30">
                      <Settings className="w-12 h-12 mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest">Select a thermal node to tune its telemetry.</p>
                   </div>
                )}
             </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
}
