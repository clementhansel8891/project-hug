import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Mail, ChevronRight, CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import { apiRequest } from "@/core/api/apiClient";
import { useToast } from "@/hooks/use-toast";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "EMAIL" | "RESET" | "SUCCESS";

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [step, setStep] = useState<Step>("EMAIL");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleVerifyEmail = async () => {
    if (!email) return;
    setIsLoading(true);
    try {
      const response = await apiRequest<{ exists?: boolean }>("/v1/auth/verify-email", "POST", null, { email });
      if (response.exists) {
        setStep("RESET");
      } else {
        toast({
          title: "Account Not Found",
          description: "We couldn't find an account with that email address.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Invalid",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest<unknown>("/v1/auth/reset-password-direct", "POST", null, {
        email,
        newPassword,
      });
      setStep("SUCCESS");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep("EMAIL");
    setEmail("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogOverlay className="bg-background/40 backdrop-blur-md" />
      <DialogContent className="sm:max-w-[440px] glass-morphism border-border dark:border-white/5 rounded-[2.5rem] shadow-2xl p-0 overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-muted flex">
          <div className={`h-full bg-primary transition-all duration-500 ${step === 'EMAIL' ? 'w-1/3' : step === 'RESET' ? 'w-2/3' : 'w-full'}`} />
        </div>

        <div className="p-10 space-y-8">
          <DialogHeader className="space-y-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all shadow-xl ${
              step === 'SUCCESS' ? 'bg-success/10 text-success shadow-success/20' : 'bg-primary/10 text-primary shadow-primary/20'
            }`}>
              {step === 'EMAIL' && <Mail className="w-8 h-8" />}
              {step === 'RESET' && <KeyRound className="w-8 h-8" />}
              {step === 'SUCCESS' && <CheckCircle2 className="w-8 h-8" />}
            </div>
            <DialogTitle className="text-3xl font-black italic tracking-tighter uppercase text-foreground leading-none">
              {step === 'EMAIL' && "Account Recovery"}
              {step === 'RESET' && "Secure Reset"}
              {step === 'SUCCESS' && "All Set!"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Forgot password recovery and reset flow.
            </DialogDescription>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-relaxed ml-1 opacity-70">
              {step === 'EMAIL' && "Enter your work email to verify your identity."}
              {step === 'RESET' && "Establish a new secure credential for your workspace."}
              {step === 'SUCCESS' && "Your password has been updated successfully."}
            </p>
          </DialogHeader>

          {step === 'EMAIL' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Work Email</label>
                <div className="relative">
                  <Input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 px-5 bg-background/50 border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary font-bold transition-all"
                  />
                </div>
              </div>
              <Button
                onClick={handleVerifyEmail}
                disabled={isLoading || !email}
                className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black italic tracking-widest uppercase gap-3 shadow-xl shadow-primary/20 active:scale-95 transition-all"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ChevronRight className="w-5 h-5" /></>}
              </Button>
            </div>
          )}

          {step === 'RESET' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">New Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-14 px-5 bg-background/50 border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary font-bold transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Confirm Password</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-14 px-5 bg-background/50 border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:border-primary font-bold transition-all"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 flex gap-3">
                <ShieldAlert className="w-5 h-5 text-warning shrink-0" />
                <p className="text-[10px] font-black text-warning leading-relaxed uppercase tracking-tight opacity-90">
                  Choose a strong password to protect your corporate identity and access.
                </p>
              </div>

              <Button
                onClick={handleResetPassword}
                disabled={isLoading || !newPassword || !confirmPassword}
                className="w-full h-14 bg-foreground text-background hover:bg-foreground/90 rounded-2xl font-black italic tracking-widest uppercase gap-3 shadow-xl active:scale-95 transition-all"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
              </Button>
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-300">
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div className="p-5 bg-success/10 text-success rounded-3xl animate-pulse">
                  <CheckCircle2 className="w-14 h-14" />
                </div>
                <div>
                  <h3 className="text-2xl font-black italic tracking-tighter text-foreground uppercase">Update Confirmed</h3>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">Identity Access Restored</p>
                </div>
              </div>

              <Button
                onClick={handleClose}
                className="w-full h-14 bg-success hover:bg-success/90 text-success-foreground rounded-2xl font-black italic tracking-widest uppercase shadow-xl shadow-success/20 active:scale-95 transition-all"
              >
                Back to Login
              </Button>
            </div>
          )}

          <div className="pt-4 text-center">
            <button
              onClick={handleClose}
              className="text-[10px] font-black uppercase text-muted-foreground hover:text-foreground tracking-widest transition-colors"
            >
              Cancel and Return
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
