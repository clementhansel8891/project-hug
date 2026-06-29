import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/core/ui/PageHeader";
import { PageShell } from "@/core/ui/PageShell";
import { WorkspacePanel } from "@/core/ui/WorkspacePanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { evaluate as mathEvaluate } from "mathjs";
import { History, Calculator, Trash2 } from "lucide-react";

const standardKeys = [
  "7", "8", "9", "/", 
  "4", "5", "6", "*", 
  "1", "2", "3", "-", 
  "0", ".", "=", "+"
];

const scientificKeys = [
  "sin", "cos", "tan", "log", 
  "sqrt", "^", "pi", "e", 
  "(", ")", "C", "DEL"
];

type HistoryItem = {
  expression: string;
  result: string;
  timestamp: string;
};

export default function CalculatorTool() {
  const [display, setDisplay] = useState("0");
  const [mode, setMode] = useState<"standard" | "scientific">("standard");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const append = (value: string) => {
    setDisplay((prev) => (prev === "0" ? value : `${prev}${value}`));
  };

  const clear = () => setDisplay("0");
  const del = () => setDisplay((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));

  const evaluate = () => {
    try {
      const result = mathEvaluate(display);
      const formattedResult = Number.isInteger(result) ? result.toString() : result.toFixed(4);
      
      setHistory(prev => [
        { expression: display, result: formattedResult, timestamp: new Date().toLocaleTimeString() },
        ...prev.slice(0, 49)
      ]);
      
      setDisplay(formattedResult);
    } catch {
      setDisplay("Error");
    }
  };

  return (
    <PageShell
      header={
        <PageHeader
          title="Calculator"
          subtitle="Advanced computation suite with forensic audit tape."
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <WorkspacePanel>
            <Tabs value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="standard">Standard</TabsTrigger>
                  <TabsTrigger value="scientific">Scientific</TabsTrigger>
                </TabsList>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Calculator className="h-3 w-3" />
                  Estela Gea Compute Core v2
                </div>
              </div>

              <div className="mt-6 space-y-6">
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
                  <div className="relative rounded-xl border bg-background/50 backdrop-blur-sm p-6 shadow-sm overflow-hidden">
                    <div className="text-xs text-muted-foreground text-right mb-1 h-4 font-mono">
                      {mode === "scientific" ? "RAD" : "DEG"}
                    </div>
                    <div className="text-right text-4xl font-bold font-mono tracking-tighter truncate">
                      {display}
                    </div>
                  </div>
                </div>

                <TabsContent value="standard" className="mt-0">
                  <div className="grid grid-cols-4 gap-3">
                    {(Array.isArray(standardKeys) ? standardKeys : []).map((key) => (
                      <Button
                        key={key}
                        variant={key === "=" ? "default" : "outline"}
                        className={`h-14 text-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${
                          ["/", "*", "-", "+"].includes(key) ? "text-primary border-primary/20 bg-primary/5" : ""
                        }`}
                        onClick={() => {
                          if (key === "=") evaluate();
                          else append(key);
                        }}
                      >
                        {key}
                      </Button>
                    ))}
                    <Button variant="ghost" className="h-14 text-destructive hover:bg-destructive/10" onClick={clear}>
                      CLEAR
                    </Button>
                    <Button variant="ghost" className="h-14" onClick={del}>
                      DEL
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="scientific" className="mt-0">
                   <div className="grid grid-cols-4 gap-3">
                    {(Array.isArray(scientificKeys) ? scientificKeys : []).map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        className="h-14 text-sm font-semibold hover:bg-primary/5 hover:text-primary transition-all"
                        onClick={() => {
                          if (key === "C") clear();
                          else if (key === "DEL") del();
                          else if (["sin", "cos", "tan", "log", "sqrt"].includes(key)) append(`${key}(`);
                          else append(key);
                        }}
                      >
                        {key}
                      </Button>
                    ))}
                    <Button 
                      className="h-14 col-span-2 text-lg font-bold shadow-lg shadow-primary/20" 
                      onClick={evaluate}
                    >
                      EVALUATE
                    </Button>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </WorkspacePanel>
        </div>

        <div className="space-y-6">
          <WorkspacePanel 
            title="History Tape" 
            description="Audit trail of calculations."
            icon={<History className="h-4 w-4" />}
          >
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
                  <History className="h-12 w-12 mb-2 stroke-[1px]" />
                  <p className="text-sm">No calculations yet.</p>
                </div>
              ) : (
                (Array.isArray(history) ? history : []).map((item, i) => (
                  <div key={i} className="group relative rounded-lg border bg-muted/10 p-3 hover:bg-muted/20 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground">{item.timestamp}</span>
                      <button 
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => setHistory(h => (Array.isArray(h) ? h : []).filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{item.expression} =</div>
                    <div className="text-sm font-bold text-foreground font-mono">{item.result}</div>
                  </div>
                ))
              )}
            </div>
            {history.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-4 text-muted-foreground hover:text-destructive"
                onClick={() => setHistory([])}
              >
                Clear Tape
              </Button>
            )}
          </WorkspacePanel>
        </div>
      </div>
    </PageShell>
  );
}
