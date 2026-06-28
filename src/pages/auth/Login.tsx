import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowRight } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";
import { ForgotPasswordModal } from "./ForgotPasswordModal";

const loginSchema = z.object({
  email: z.string().min(1, "Work email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState("");
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setAuthError("");
    const result = await login(values);
    if (result.success) {
      // Use redirect path from routing info, or default to dashboard
      const redirectPath = (result as any).redirect_to || "/core/dashboard";
      const message = (result as any).message;
      
      console.log("[Login] Redirecting to:", redirectPath);
      if (message) {
        console.log("[Login] Shift status:", message);
        // You could show a toast here if you have a toast system
      }
      navigate(redirectPath);
    } else {
      // Feedback_Message on failed submit; react-hook-form preserves entered input.
      setAuthError(result.error || "Failed to login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px] animate-pulse pointer-events-none" />

      <GlassCard
        variant="morphism"
        className="max-w-md w-full rounded-3xl shadow-2xl border border-border overflow-hidden relative z-10 p-1"
      >
        <div className="bg-background/40 backdrop-blur-md rounded-[1.4rem] p-8 sm:p-10">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-14 h-14 bg-gradient-to-tr from-primary to-primary/70 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 mb-6 group transition-transform hover:scale-110 duration-500">
              <svg className="w-8 h-8 text-primary-foreground group-hover:rotate-12 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-foreground mb-2">ZENVIX</h2>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em]">Intelligent Workspace</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {authError && (
              <div
                role="alert"
                className="p-3 bg-destructive/10 border-l-4 border-destructive text-destructive text-sm rounded-r-md animate-in fade-in slide-in-from-top-1"
              >
                {authError}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1"
              >
                Work Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                className="w-full px-5 py-3.5 rounded-2xl border border-border bg-background/50 backdrop-blur-sm shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300 font-medium"
                placeholder="name@company.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-destructive text-xs font-bold ml-1 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label
                  htmlFor="login-password"
                  className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-[10px] font-black uppercase text-primary hover:text-primary/80 transition-colors tracking-widest"
                >
                  Recovery
                </button>
              </div>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                className="w-full px-5 py-3.5 rounded-2xl border border-border bg-background/50 backdrop-blur-sm shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300 font-medium"
                placeholder="••••••••"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-destructive text-xs font-bold ml-1 mt-1">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/30 mt-4 tracking-[0.15em]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Initialize Access</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-border/50 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              New to Zenvix?{" "}
              <Link to="/auth/register" className="text-primary hover:text-primary/80 transition-colors ml-1">
                Create Organization
              </Link>
            </p>
          </div>
        </div>
      </GlassCard>

      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
      />
    </div>
  );
}
