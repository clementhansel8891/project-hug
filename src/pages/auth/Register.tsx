import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ArrowRight } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/shared/GlassCard";
import { Button } from "@/components/ui/button";

const registerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().min(1, "Work email is required").email("Enter a valid email address"),
  phone: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function Register() {
  const { registerUser, login } = useAuth();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { first_name: "", last_name: "", email: "", phone: "", password: "" },
  });

  const onSubmit = async (values: RegisterValues) => {
    setAuthError("");
    const result = await registerUser(values);
    if (result.success) {
      // Auto login after successful registration
      const loginResult = await login({
        email: values.email,
        password: values.password,
      });
      if (loginResult.success) {
        navigate("/core/dashboard");
      } else {
        navigate("/auth/login"); // Fallback if auto-login fails
      }
    } else {
      // Feedback_Message on failed submit; react-hook-form preserves entered input.
      setAuthError(result.error || "Registration failed");
    }
  };

  const fieldClass =
    "w-full px-5 py-3.5 rounded-2xl border border-border bg-background/50 backdrop-blur-sm shadow-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-300 font-medium";
  const labelClass = "text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1";
  const errorClass = "text-destructive text-xs font-bold ml-1 mt-1";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden py-12 px-4">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px] animate-pulse pointer-events-none" />

      <GlassCard
        variant="morphism"
        className="max-w-xl w-full rounded-3xl shadow-2xl border border-border dark:border-white/5 overflow-hidden relative z-10 p-1 transition-all duration-500"
      >
        <div className="bg-background/40 backdrop-blur-md rounded-[1.4rem] p-8 sm:p-10">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-14 h-14 bg-gradient-to-tr from-primary to-primary/70 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 mb-6 group transition-transform hover:scale-110 duration-500">
              <svg className="w-8 h-8 text-primary-foreground group-hover:rotate-12 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-foreground mb-2 uppercase italic">Register</h2>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-[0.2em] max-w-xs mx-auto">Initialize your isolated enterprise partition</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {authError && (
              <div
                role="alert"
                className="p-4 bg-destructive/10 border-l-4 border-destructive text-destructive text-sm rounded-r-md animate-in fade-in slide-in-from-top-1 font-medium"
              >
                {authError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="reg-first-name" className={labelClass}>First Name</label>
                <input
                  id="reg-first-name"
                  type="text"
                  autoComplete="given-name"
                  aria-invalid={!!errors.first_name}
                  className={fieldClass}
                  {...register("first_name")}
                />
                {errors.first_name && <p className={errorClass}>{errors.first_name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reg-last-name" className={labelClass}>Last Name</label>
                <input
                  id="reg-last-name"
                  type="text"
                  autoComplete="family-name"
                  aria-invalid={!!errors.last_name}
                  className={fieldClass}
                  {...register("last_name")}
                />
                {errors.last_name && <p className={errorClass}>{errors.last_name.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-email" className={labelClass}>Work Email</label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                className={fieldClass}
                placeholder="name@company.com"
                {...register("email")}
              />
              {errors.email && <p className={errorClass}>{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-phone" className={labelClass}>Phone Number (Optional)</label>
              <input
                id="reg-phone"
                type="tel"
                autoComplete="tel"
                className={fieldClass}
                placeholder="+1 (555) 000-0000"
                {...register("phone")}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="reg-password" className={labelClass}>Access Credential</label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                className={fieldClass}
                placeholder="Min 8 characters"
                {...register("password")}
              />
              {errors.password && <p className={errorClass}>{errors.password.message}</p>}
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
                  <span>Provisioning...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-border/50 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Existing Member?{" "}
              <Link to="/auth/login" className="text-primary hover:text-primary/80 transition-colors ml-1">
                Sign in to console
              </Link>
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
