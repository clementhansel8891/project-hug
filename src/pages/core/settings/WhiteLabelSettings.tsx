import React, { useState, useEffect } from "react";
import { 
  Palette, 
  Upload, 
  Globe, 
  Shield, 
  Save, 
  RefreshCcw,
  Layout,
  Type,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function WhiteLabelSettings() {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    logoUrl: "https://api.zenvix.ai/placeholder-logo.png",
    primaryColor: "#6366f1",
    agencyName: "Zenvix Marketing Pro",
    customDomain: "",
    enableWhiteLabel: true,
    removePoweredBy: false,
    customCss: "",
  });

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("White-label settings updated successfully");
    }, 1000);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Agency White-Labeling</h1>
          <p className="text-muted-foreground mt-2">Personalize the Zenvix experience for your clients and sub-accounts.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Reset
          </Button>
          <Button onClick={handleSave} loading={loading} className="gap-2 bg-primary hover:bg-primary">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="branding" className="w-full">
            <TabsList className="bg-muted dark:bg-muted p-1 rounded-xl mb-6">
              <TabsTrigger value="branding" className="rounded-lg gap-2">
                <Palette className="h-4 w-4" /> Branding
              </TabsTrigger>
              <TabsTrigger value="domain" className="rounded-lg gap-2">
                <Globe className="h-4 w-4" /> Domain & SEO
              </TabsTrigger>
              <TabsTrigger value="advanced" className="rounded-lg gap-2">
                <Shield className="h-4 w-4" /> Security & Advanced
              </TabsTrigger>
            </TabsList>

            <TabsContent value="branding" className="space-y-6">
              <Card className="border-border/60 dark:border-border/60 shadow-sm overflow-hidden bg-white/50 dark:bg-muted backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layout className="h-5 w-5 text-primary" />
                    Visual Identity
                  </CardTitle>
                  <CardDescription>Configure how your agency appears to clients.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Agency Name</Label>
                      <Input 
                        value={config.agencyName} 
                        onChange={(e) => setConfig({...config, agencyName: e.target.value})}
                        placeholder="e.g. Acme Marketing Solutions"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Primary Brand Color</Label>
                      <div className="flex gap-2">
                        <Input 
                          type="color" 
                          value={config.primaryColor} 
                          onChange={(e) => setConfig({...config, primaryColor: e.target.value})}
                          className="w-12 p-1 h-10"
                        />
                        <Input 
                          value={config.primaryColor} 
                          onChange={(e) => setConfig({...config, primaryColor: e.target.value})}
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Agency Logo</Label>
                    <div className="flex items-center gap-6 p-4 border-2 border-dashed border-border dark:border-border rounded-xl bg-muted dark:bg-muted">
                      <div className="h-16 w-16 bg-white dark:bg-muted rounded-lg flex items-center justify-center border border-border dark:border-border shadow-sm overflow-hidden">
                        <img src={config.logoUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">SVG, PNG, or JPG (max. 800x400px)</p>
                      </div>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Upload className="h-4 w-4" /> Upload
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 dark:border-border/60 shadow-sm bg-white/50 dark:bg-muted backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Type className="h-5 w-5 text-primary" />
                    Custom Typography & Styles
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Custom CSS</Label>
                    <textarea 
                      className="w-full min-h-[120px] p-3 rounded-lg border border-border dark:border-border bg-white dark:bg-muted font-mono text-sm"
                      placeholder="/* Add custom dashboard styles here */"
                      value={config.customCss}
                      onChange={(e) => setConfig({...config, customCss: e.target.value})}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="domain" className="space-y-6">
              <Card className="border-border/60 dark:border-border/60 shadow-sm bg-white/50 dark:bg-muted backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    Custom Domain Configuration
                  </CardTitle>
                  <CardDescription>Host the dashboard on your own subdomain with full SSL support.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Subdomain / Custom Domain</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="app.myagency.com" 
                        value={config.customDomain}
                        onChange={(e) => setConfig({...config, customDomain: e.target.value})}
                      />
                      <Button variant="outline" className="gap-2">
                        <RefreshCcw className="h-4 w-4" /> Verify DNS
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border dark:border-border overflow-hidden">
                    <div className="bg-muted dark:bg-muted p-3 border-b border-border dark:border-border">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Required DNS Records</p>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-mono text-primary">CNAME</span>
                          <span className="text-muted-foreground">Value: lb.zenvix.ai</span>
                        </div>
                        <div className="h-10 bg-white dark:bg-muted border rounded flex items-center px-3 justify-between">
                          <code className="text-xs">{config.customDomain || "app.your-agency.com"}</code>
                          <Badge variant="outline" className="text-[10px] text-warning border-warning bg-warning">Pending</Badge>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-warning dark:bg-warning border border-warning/50 dark:border-warning/50 rounded-lg">
                        <div className="flex gap-3">
                          <Shield className="h-5 w-5 text-warning shrink-0" />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-warning dark:text-warning">SSL Certificate Generation</p>
                            <p className="text-[11px] text-warning dark:text-warning leading-relaxed">
                              Once DNS is verified, we will automatically provision an SSL certificate for your domain. This process can take up to 24 hours.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted dark:bg-muted p-4">
                   <p className="text-[11px] text-muted-foreground">
                     Note: Full custom domain routing requires infrastructure-level proxy configuration. Our team will finalize the setup within 48 hours of DNS verification.
                   </p>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
               <Card className="border-border/60 dark:border-border/60 shadow-sm bg-white/50 dark:bg-muted backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Advanced Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-base">Enable White-Labeling</Label>
                      <p className="text-sm text-muted-foreground">Apply custom branding to all sub-accounts.</p>
                    </div>
                    <Switch 
                      checked={config.enableWhiteLabel} 
                      onCheckedChange={(checked) => setConfig({...config, enableWhiteLabel: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-base">Remove "Powered by Zenvix"</Label>
                      <p className="text-sm text-muted-foreground">Hide Zenvix branding from footer and login pages.</p>
                    </div>
                    <Switch 
                      checked={config.removePoweredBy} 
                      onCheckedChange={(checked) => setConfig({...config, removePoweredBy: checked})}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Preview */}
        <div className="space-y-6">
          <Card className="border-border/60 dark:border-border/60 shadow-lg sticky top-8 bg-white dark:bg-muted overflow-hidden">
            <CardHeader className="border-b border-border dark:border-border py-3 bg-muted dark:bg-muted">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="aspect-[4/5] w-full bg-muted dark:bg-muted p-4">
                <div className="h-full w-full bg-white dark:bg-muted rounded-lg shadow-2xl border border-border dark:border-border overflow-hidden flex flex-col">
                  {/* Top Nav Preview */}
                  <div className="h-10 border-b border-border dark:border-border px-3 flex items-center justify-between">
                    <img src={config.logoUrl} className="h-5 object-contain" alt="Logo" />
                    <div className="flex gap-1">
                      <div className="h-4 w-4 rounded-full bg-muted dark:bg-muted" />
                      <div className="h-4 w-4 rounded-full bg-muted dark:bg-muted" />
                    </div>
                  </div>
                  
                  {/* Content Preview */}
                  <div className="flex-1 p-4 space-y-4">
                    <div className="h-6 w-24 rounded bg-muted dark:bg-muted" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-20 rounded-xl bg-muted dark:bg-muted border border-border dark:border-border flex flex-col p-3 gap-2">
                         <div className="h-3 w-12 rounded bg-muted dark:bg-muted" />
                         <div className="h-5 w-16 rounded bg-muted dark:bg-muted" style={{ backgroundColor: config.primaryColor + '44' }} />
                      </div>
                      <div className="h-20 rounded-xl bg-muted dark:bg-muted border border-border dark:border-border" />
                    </div>
                    <div className="h-32 rounded-xl border border-dashed border-border dark:border-border flex flex-col items-center justify-center gap-3">
                       <Button size="sm" style={{ backgroundColor: config.primaryColor }}>Preview Button</Button>
                       <p className="text-[10px] text-muted-foreground">Branding preview active</p>
                    </div>
                  </div>

                  {/* Powered By Footer */}
                  {!config.removePoweredBy && (
                    <div className="h-6 flex items-center justify-center text-[8px] text-muted-foreground border-t border-border dark:border-border">
                      Powered by Zenvix AI
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="py-4 px-6 bg-muted dark:bg-muted">
              <p className="text-xs text-muted-foreground leading-relaxed text-center w-full">
                This preview shows how your branding will appear in the main client dashboard.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
