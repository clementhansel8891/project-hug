import React, { useState, useEffect } from "react";
import { 
  Play, 
  Code2, 
  Braces, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Copy,
  Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/core/security/session";

// Import the Simulated Gateway directly (in real app, this would be an HTTP fetch)
import { retailGateway } from "@/modules/retail/api/RetailPublicGateway";
import type {
  ApiAuthHeaders,
  ApiErrorResponse,
  PublicOrderResponseDTO,
  PublicProductDTO,
} from "@/core/types/retail/api";

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
  typeof value === "object" &&
  value !== null &&
  "error" in value &&
  "code" in value &&
  typeof (value as Record<string, unknown>).code === "number";

const toApiErrorResponse = (value: unknown): ApiErrorResponse => {
  if (isApiErrorResponse(value)) {
    return value;
  }

  if (value instanceof Error) {
    return {
      error: value.message,
      code: 500,
      details: value.stack ?? value.message,
    };
  }

  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    return {
      error: typeof obj.error === "string" ? obj.error : "Internal Server Error",
      code: typeof obj.code === "number" ? obj.code : 500,
      details: typeof obj.details === "string" ? obj.details : "No additional details provided",
    };
  }

  if (typeof value === "string") {
    return {
      error: value,
      code: 500,
      details: value,
    };
  }

  return {
    error: "Internal Server Error",
    code: 500,
    details: "Unknown error",
  };
};

const DeveloperConsole = ({
  defaultClientId = "",
  defaultClientSecret = "",
}: {
  defaultClientId?: string;
  defaultClientSecret?: string;
}) => {
  const { toast } = useToast();
  const session = useSession();
  
  // Request State
  const [method, setMethod] = useState("GET");
  const [endpoint, setEndpoint] = useState("/products");
  const [clientId, setClientId] = useState(defaultClientId);
  const [clientSecret, setClientSecret] = useState(defaultClientSecret);

  useEffect(() => {
    if (defaultClientId) {
      setClientId(defaultClientId);
    }
    if (defaultClientSecret) {
      setClientSecret(defaultClientSecret);
    }
  }, [defaultClientId, defaultClientSecret]);
  const [requestBody, setRequestBody] = useState(JSON.stringify({
    externalReference: "ORD-EXT-001",
    items: [
      { sku: "COF-AR-001", quantity: 2 }
    ],
    customer: {
      name: "John Doe",
      email: "john@example.com"
    },
    paymentStatus: "PAID",
    paymentMethod: "card"
  }, null, 2));

  // Response State
  const [response, setResponse] = useState<PublicProductDTO[] | PublicOrderResponseDTO | ApiErrorResponse | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const endpoints = [
    { value: "/products", method: "GET", label: "Get Inventory" },
    { value: "/orders", method: "POST", label: "Create Order" },
    { value: "/orders/:id", method: "GET", label: "Get Order Status" },
  ];

  const handleEndpointChange = (val: string) => {
    setEndpoint(val);
    const ep = endpoints.find(e => e.value === val);
    if (ep) setMethod(ep.method);
  };

  const executeRequest = async () => {
    setIsLoading(true);
    setResponse(null);
    setStatus(null);

    // Simulate Network Latency
    await new Promise(r => setTimeout(r, 600));

    try {
      const headers: ApiAuthHeaders = {
        "x-client-id": clientId || undefined,
        "x-client-secret": clientSecret || undefined,
      };

      let result: PublicProductDTO[] | PublicOrderResponseDTO | ApiErrorResponse;
      // Routing Logic (Gateway Dispatcher)
      if (endpoint === "/products" && method === "GET") {
        result = await retailGateway.getProducts(session.tenant_id, headers);
      } else if (endpoint === "/orders" && method === "POST") {
        const body = JSON.parse(requestBody);
        result = await retailGateway.createOrder(session.tenant_id, headers, body);
      } else {
        throw { code: 404, error: "Not Found", details: "Endpoint not implemented in simulation" };
      }

      if (isApiErrorResponse(result)) {
         throw result;
      }

      setResponse(result);
      setStatus(200);
      toast({ title: "Request Successful", description: `API returned 200 OK` });

    } catch (error: unknown) {
      console.error(error);
      const normalizedError = toApiErrorResponse(error);
      setStatus(normalizedError.code);
      setResponse(normalizedError);
      toast({
        title: "Request Failed",
        description: normalizedError.details || normalizedError.error,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
      {/* Request Panel */}
      <div className="space-y-4 flex flex-col h-full">
        <div className="space-y-4 bg-secondary/5 p-6 rounded-3xl border border-border flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Request Configuration</span>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-2">
            <div className="bg-muted/20 rounded-xl flex items-center justify-center font-black text-muted-foreground">
               {method}
            </div>
            <Select value={endpoint} onValueChange={handleEndpointChange}>
              <SelectTrigger className="h-12 rounded-xl font-mono text-xs font-bold">
                 <SelectValue />
              </SelectTrigger>
              <SelectContent>
                 {(Array.isArray(endpoints) ? endpoints : []).map(ep => (
                   <SelectItem key={ep.value} value={ep.value}>
                      <span className="font-mono">{ep.value}</span> 
                      <span className="text-muted-foreground ml-2 text-[10px] uppercase">({ep.label})</span>
                   </SelectItem>
                 ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
             <div className="flex justify-between">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Client Credentials</Label>
             </div>
             <div className="grid grid-cols-1 gap-2">
               <Input
                 placeholder="Channel Client ID"
                 value={clientId}
                 onChange={e => setClientId(e.target.value)}
                 className="h-10 font-mono text-xs rounded-lg"
               />
               <Input
                 placeholder="Channel Client Secret"
                 value={clientSecret}
                 onChange={e => setClientSecret(e.target.value)}
                 type="password"
                 className="h-10 font-mono text-xs rounded-lg"
               />
             </div>
          </div>

          {method === "POST" && (
            <div className="flex-1 flex flex-col min-h-[200px]">
              <div className="flex justify-between mb-2">
                 <Label className="text-[10px] font-black uppercase text-muted-foreground">Request Body (JSON)</Label>
                 <Braces className="w-3 h-3 text-muted-foreground" />
              </div>
              <textarea
                className="flex-1 w-full bg-secondary text-primary/80 font-mono text-xs p-4 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                value={requestBody}
                onChange={e => setRequestBody(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}
        </div>

        <Button 
          onClick={executeRequest}
          disabled={isLoading}
          className="h-14 bg-primary hover:bg-primary/95 text-foreground rounded-2xl font-black italic uppercase tracking-widest shadow-xl"
        >
           {isLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2 fill-current" />}
           Send Request
        </Button>
      </div>

      {/* Response Panel */}
      <div className="bg-secondary rounded-3xl border border-border text-foreground p-6 flex flex-col h-full overflow-hidden">
         <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
               <Code2 className="w-5 h-5 text-primary" />
               <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Response Output</span>
            </div>
            {status && (
               <div className={`px-2 py-1 rounded-md text-[10px] font-black ${status >= 200 && status < 300 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                  HTTP {status}
               </div>
            )}
         </div>

         <div className="flex-1 bg-black/50 rounded-xl p-4 overflow-auto border border-border relative group">
            <Button 
              size="icon" 
              variant="ghost" 
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => {
                if (response) {
                   navigator.clipboard.writeText(JSON.stringify(response, null, 2));
                   toast({ title: "Copied JSON" });
                }
              }}
            >
               <Copy className="w-4 h-4 text-muted-foreground" />
            </Button>
            
            {response ? (
               <pre className="text-xs font-mono text-primary/90 leading-relaxed">
                  {JSON.stringify(response, null, 2)}
               </pre>
            ) : (
               <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Server className="w-12 h-12 mb-4 opacity-20" />
                  <div className="font-bold uppercase text-[10px] tracking-widest">Awaiting Request</div>
               </div>
            )}
         </div>
         
         {status === 200 && (
            <div className="mt-4 p-3 bg-success/20 border border-success/50 rounded-lg flex items-start gap-3">
               <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
               <div className="text-[10px] text-success">
                  <span className="font-bold">Success:</span> Logic executed successfully. Inventory/Orders have been updated in the internal system.
               </div>
            </div>
         )}
         {status && status >= 400 && (
            <div className="mt-4 p-3 bg-destructive/20 border border-destructive/50 rounded-lg flex items-start gap-3">
               <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
               <div className="text-[10px] text-destructive">
                  <span className="font-bold">Error:</span> {response?.details || "Request failed"}
               </div>
            </div>
         )}
      </div>
    </div>
  );
};

export default DeveloperConsole;
