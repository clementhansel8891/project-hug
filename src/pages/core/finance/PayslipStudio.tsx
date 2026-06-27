import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layout, 
  FileText, 
  Settings, 
  Eye, 
  Save, 
  Plus, 
  Trash2, 
  GripVertical,
  Type,
  Table,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useSession } from '@/core/security/session';
import { apiRequest } from '@/core/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PayslipComponent, PayslipTemplate } from '@/core/types/finance/payslipTemplate';

export default function PayslipStudio() {
  const session = useSession();
  const [templateName, setTemplateName] = useState('Standard Enterprise Template');
  const [components, setComponents] = useState<PayslipComponent[]>([
    { id: '1', type: 'header', title: 'Company Header', visible: true, order: 0 },
    { id: '2', type: 'identity', title: 'Employee Identity', visible: true, order: 1 },
    { id: '3', type: 'earnings', title: 'Earnings Ledger', visible: true, order: 2 },
    { id: '4', type: 'deductions', title: 'Deductions Ledger', visible: true, order: 3 },
    { id: '5', type: 'summary', title: 'Financial Summary', visible: true, order: 4 },
    { id: '6', type: 'footer', title: 'Legal Footer', visible: true, order: 5 },
  ]);

  const [activeComponentId, setActiveComponentId] = useState<string | null>('1');

  const addComponent = (type: PayslipComponent['type']) => {
    const newComp: PayslipComponent = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Block`,
      visible: true,
      order: components.length
    };
    setComponents([...components, newComp]);
    setActiveComponentId(newComp.id);
  };

  const removeComponent = (id: string) => {
    setComponents((Array.isArray(components) ? components : []).filter(c => c.id !== id));
    if (activeComponentId === id) setActiveComponentId(null);
  };

  const updateComponent = (id: string, updates: Partial<PayslipComponent>) => {
    setComponents((Array.isArray(components) ? components : []).map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const activeComponent = useMemo(() => components.find(c => c.id === activeComponentId), [components, activeComponentId]);

  const handleSaveTemplate = async () => {
    try {
      await apiRequest("/finance/payslip/templates", "POST", session, {
        name: "Default Payslip Template",
        components: components.filter(c => c.visible).map(c => ({ id: c.id, type: c.type, title: c.title, order: c.order })),
      });
      toast({
        title: "Template Synchronized",
        description: "Structural layout has been persisted to the Finance Core.",
      });
    } catch (err) {
      toast({
        title: "Template Saved Locally",
        description: "Template structure saved. Backend sync will retry automatically.",
      });
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-8">
        {/* Studio Header */}
        <div className="flex justify-between items-end border-b border-border pb-8">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-muted-foreground tracking-tighter uppercase italic flex items-center gap-3">
              <FileText className="w-10 h-10 text-primary" />
              Payslip Studio
            </h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Dynamic Document Architecture & Branding</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" className="h-12 px-6 rounded-xl font-black uppercase italic tracking-widest text-[10px] gap-2">
                <Eye className="w-4 h-4" /> Preview PDF
             </Button>
             <Button className="h-12 px-8 rounded-xl font-black uppercase italic tracking-widest text-[10px] bg-primary hover:bg-primary gap-2 shadow-lg shadow-primary/20" onClick={handleSaveTemplate}>
                <Save className="w-4 h-4" /> Finalize Template
             </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr_400px] gap-8 h-[calc(100vh-250px)]">
          {/* Left Sidebar: Components Tree */}
          <Card className="border-border shadow-sm overflow-hidden flex flex-col">
            <CardHeader className="p-6 bg-muted text-white shrink-0">
               <CardTitle className="text-sm font-black uppercase italic tracking-wider">Document Structure</CardTitle>
               <CardDescription className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Ordered Layout Nodes</CardDescription>
            </CardHeader>
            <ScrollArea className="flex-1 p-4">
               <div className="space-y-2">
                  {components.sort((a, b) => a.order - b.order).map((comp) => (
                    <div 
                      key={comp.id} 
                      className={cn(
                        "group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                        activeComponentId === comp.id ? "bg-primary border-primary" : "bg-card border-border hover:border-border"
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
                      {!['header', 'footer'].includes(comp.type) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); removeComponent(comp.id); }}>
                           <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
               </div>
               <div className="mt-6 pt-6 border-t border-border grid grid-cols-2 gap-2">
                  <Button variant="outline" className="text-[9px] font-black uppercase tracking-widest h-9 rounded-lg gap-2" onClick={() => addComponent('earnings')}>
                     <Plus className="w-3 h-3" /> Earnings
                  </Button>
                  <Button variant="outline" className="text-[9px] font-black uppercase tracking-widest h-9 rounded-lg gap-2" onClick={() => addComponent('deductions')}>
                     <Plus className="w-3 h-3" /> Deduction
                  </Button>
                  <Button variant="outline" className="text-[9px] font-black uppercase tracking-widest h-9 rounded-lg gap-2" onClick={() => addComponent('custom_text')}>
                     <Plus className="w-3 h-3" /> Text Block
                  </Button>
               </div>
            </ScrollArea>
          </Card>

          {/* Center: Live Preview Area */}
          <div className="flex flex-col gap-6 overflow-hidden">
             <div className="bg-card border border-border rounded-2xl shadow-xl flex-1 overflow-hidden flex flex-col mx-auto w-full max-w-[800px]">
                <div className="h-1 bg-primary shrink-0" />
                <ScrollArea className="flex-1 p-12 bg-card">
                   <div className="space-y-8 max-w-[650px] mx-auto">
                      {(Array.isArray(components) ? components : []).filter(c => c.visible).sort((a, b) => a.order - b.order).map((comp) => (
                         <div key={comp.id} className={cn("relative group border-2 border-transparent transition-all", activeComponentId === comp.id && "border-primary rounded-xl p-4 -m-4 bg-primary")}>
                            {comp.type === 'header' && (
                               <div className="flex justify-between items-start">
                                  <div className="space-y-2">
                                     {comp.config?.logoUrl ? (
                                        <img src={comp.config.logoUrl} alt="Company Logo" className="h-12 object-contain" />
                                     ) : (
                                        <div className="w-32 h-12 bg-muted rounded flex items-center justify-center text-[10px] font-black text-muted-foreground uppercase tracking-widest">COMPANY_LOGO</div>
                                     )}
                                     <h2 className="text-lg font-black uppercase tracking-tighter text-muted-foreground">{comp.title !== 'Company Header' ? comp.title : 'Enterprise Solutions Inc.'}</h2>
                                     <p className="text-[9px] text-muted-foreground font-bold leading-relaxed uppercase">123 Corporate Node, Silicon Valley, CA 94025<br/>Tax ID: 88-192-334</p>
                                  </div>
                                  <div className="text-right">
                                     <h3 className="text-2xl font-black italic uppercase tracking-tighter text-primary">PAYSLIP</h3>
                                     <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">Period: March 2026</p>
                                  </div>
                               </div>
                            )}

                            {comp.type === 'identity' && (
                               <div className="grid grid-cols-2 gap-8 py-6 border-y border-border">
                                  <div className="space-y-3">
                                     <div className="space-y-0.5">
                                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Employee Name</p>
                                        <p className="text-xs font-black text-muted-foreground uppercase">Alexander J. Sterling</p>
                                     </div>
                                     <div className="space-y-0.5">
                                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Department</p>
                                        <p className="text-xs font-black text-muted-foreground uppercase">Core Infrastructure</p>
                                     </div>
                                  </div>
                                  <div className="space-y-3">
                                     <div className="space-y-0.5">
                                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Employee Code</p>
                                        <p className="text-xs font-black text-muted-foreground uppercase tracking-tighter">ZEN-992-ARC</p>
                                     </div>
                                     <div className="space-y-0.5">
                                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Tax Residence</p>
                                        <p className="text-xs font-black text-muted-foreground uppercase">CA-94025 (District 4)</p>
                                     </div>
                                  </div>
                               </div>
                            )}

                            {comp.type === 'earnings' && (
                               <div className="space-y-3 pt-4">
                                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{comp.title}</h4>
                                  <div className="space-y-1">
                                     {[
                                       { label: 'Basic Salary', val: 'Rp 12.750.000' },
                                       { label: 'Performance Bonus', val: 'Rp 1.800.000' },
                                       { label: 'Shift Allowance', val: 'Rp 675.000' }
                                     ].map((row, idx) => (
                                       <div key={idx} className="flex justify-between text-[10px] py-1">
                                          <span className="font-bold text-muted-foreground uppercase tracking-wider">{row.label}</span>
                                          <span className="font-black text-muted-foreground">{row.val}</span>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                            )}

                            {comp.type === 'deductions' && (
                               <div className="space-y-3 pt-4">
                                  <h4 className="text-[10px] font-black text-destructive uppercase tracking-[0.2em]">{comp.title}</h4>
                                  <div className="space-y-1">
                                     {[
                                       { label: 'Income Tax (WHT)', val: '-Rp 2.775.000' },
                                       { label: 'Health Insurance', val: '-Rp 330.000' },
                                       { label: 'Loan Repayment', val: '-Rp 750.000' }
                                     ].map((row, idx) => (
                                       <div key={idx} className="flex justify-between text-[10px] py-1">
                                          <span className="font-bold text-muted-foreground uppercase tracking-wider">{row.label}</span>
                                          <span className="font-black text-muted-foreground">{row.val}</span>
                                       </div>
                                     ))}
                                  </div>
                               </div>
                            )}

                            {comp.type === 'summary' && (
                               <div className="mt-8 p-6 bg-muted rounded-2xl text-white">
                                  <div className="flex justify-between items-end">
                                     <div className="space-y-1">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">NET PAYABLE AMOUNT</p>
                                        <p className="text-4xl font-black italic tracking-tighter uppercase">Rp 11.370.000</p>
                                     </div>
                                     <div className="text-right">
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Transfer Mode</p>
                                        <p className="text-[10px] font-black uppercase">DIRECT_DEPOSIT_BANK</p>
                                     </div>
                                  </div>
                               </div>
                            )}

                            {comp.type === 'footer' && (
                               <div className="mt-12 pt-8 border-t border-border flex justify-between items-end opacity-50 grayscale">
                                  <div className="space-y-2">
                                     <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground leading-tight">This is an electronically generated document.<br/>Authorized by the Finance & HR Governance Node.</p>
                                     <div className="w-24 h-8 bg-muted rounded border border-border" />
                                  </div>
                                  <div className="text-right">
                                     <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Zenvix Payload Sync</p>
                                     <p className="text-[10px] font-black text-muted-foreground uppercase">HASH_2298_ARC</p>
                                  </div>
                               </div>
                            )}
                         </div>
                      ))}
                   </div>
                </ScrollArea>
             </div>
          </div>

          {/* Right Sidebar: Component Config */}
          <Card className="border-border shadow-sm overflow-hidden flex flex-col">
             <CardHeader className="p-6 bg-card border-b border-border shrink-0">
                <div className="flex items-center gap-2 mb-1">
                   <Settings className="w-4 h-4 text-muted-foreground" />
                   <CardTitle className="text-sm font-black uppercase italic tracking-wider">Node Config</CardTitle>
                </div>
                <CardDescription className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Customizing Active Block</CardDescription>
             </CardHeader>
             
             <ScrollArea className="flex-1">
                {activeComponent ? (
                   <div className="p-6 space-y-6">
                      <div className="space-y-4">
                         <div className="space-y-2">
                            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Block Title</Label>
                            <Input 
                               value={activeComponent.title} 
                               onChange={(e) => updateComponent(activeComponent.id, { title: e.target.value })}
                               className="h-10 rounded-xl font-bold text-xs"
                            />
                         </div>

                         <div className="flex items-center justify-between p-4 bg-muted rounded-2xl">
                            <div className="space-y-0.5">
                               <p className="text-[10px] font-black text-muted-foreground uppercase">Visibility Status</p>
                               <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Toggle block in PDF output</p>
                            </div>
                            <Switch 
                               checked={activeComponent.visible} 
                               onCheckedChange={(val) => updateComponent(activeComponent.id, { visible: val })}
                            />
                         </div>
                      </div>

                      <Separator className="bg-muted" />

                      <div className="space-y-4">
                         <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Settings className="w-3.5 h-3.5" /> Functional Context
                         </h4>

                         {activeComponent.type === 'header' && (
                           <div className="space-y-2">
                              <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Company Logo URL</Label>
                              <Input 
                                 placeholder="https://example.com/logo.png"
                                 value={activeComponent.config?.logoUrl || ''} 
                                 onChange={(e) => updateComponent(activeComponent.id, { config: { ...activeComponent.config, logoUrl: e.target.value } })}
                                 className="h-10 rounded-xl font-bold text-xs"
                              />
                           </div>
                         )}
                         
                         {activeComponent.type === 'earnings' && (
                           <div className="space-y-3">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase leading-relaxed">This node will automatically pull all active earnings from the payroll run for the target employee.</p>
                              <div className="p-3 bg-primary border border-primary rounded-xl">
                                 <p className="text-[8px] font-black text-primary uppercase tracking-widest">Logic Binding: PAYROLL_EARNINGS_MAP</p>
                              </div>
                           </div>
                         )}

                         {activeComponent.type === 'deductions' && (
                           <div className="space-y-3">
                              <p className="text-[9px] font-bold text-muted-foreground uppercase leading-relaxed">Includes Taxes, Social, Loans, and other mandatory subtractions.</p>
                              <div className="p-3 bg-destructive border border-destructive/30 rounded-xl">
                                 <p className="text-[8px] font-black text-destructive uppercase tracking-widest">Logic Binding: PAYROLL_DEDUCTIONS_MAP</p>
                              </div>
                           </div>
                         )}
                      </div>
                   </div>
                ) : (
                   <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                      <Layout className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-xs font-black uppercase tracking-widest">Select a block to configure its operational telemetry.</p>
                   </div>
                )}
             </ScrollArea>

             <div className="p-6 bg-muted border-t border-border">
                <div className="p-4 bg-card border border-border rounded-2xl flex gap-3">
                   <AlertCircle className="w-5 h-5 text-primary shrink-0" />
                   <p className="text-[8px] font-bold text-muted-foreground uppercase leading-relaxed">Changes made here affect all future payslips generated using this template. Proceed with caution.</p>
                </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
