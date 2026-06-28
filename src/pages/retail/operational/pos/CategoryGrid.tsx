import React from "react";
import {
  Pizza,
  Coffee,
  Wine,
  Package,
  Tag,
  LayoutGrid,
  Smartphone,
  Utensils,
  LucideIcon,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon?: LucideIcon;
}

interface CategoryGridProps {
  categories: Category[];
  onSelect: (category: Category | null) => void;
  activeCategoryId?: string;
}

const iconMap: Record<string, LucideIcon> = {
  Food: Utensils,
  Drinks: Coffee,
  Alcohol: Wine,
  Merch: Package,
  Tech: Smartphone,
  Promo: Tag,
};

export const CategoryGrid: React.FC<CategoryGridProps> = ({
  categories,
  onSelect,
  activeCategoryId,
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
      {/* "All" entry */}
      <button
        onClick={() => onSelect(null)}
        className={`group relative flex flex-col items-center justify-center p-6 rounded-[2rem] border-2 transition-all duration-300 active:scale-95 ${
          !activeCategoryId
            ? "bg-primary border-border text-primary-foreground shadow-2xl shadow-slate-900/30 scale-105 z-10"
            : "bg-secondary/30 backdrop-blur-xl border-border text-muted-foreground hover:border-border hover:bg-secondary/50"
        }`}
      >
        <div
          className={`p-3.5 rounded-xl mb-3 transition-all duration-300 ${!activeCategoryId ? "bg-white/10" : "bg-secondary/20 group-hover:bg-muted shadow-sm"}`}
        >
          <LayoutGrid className="w-7 h-7" />
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.2em] italic text-center">
          ALL SKUS
        </span>
      </button>

      {(Array.isArray(categories) ? categories : []).map((cat, i) => {
        const Icon = iconMap[cat.name] || Package;
        const isActive = activeCategoryId === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat)}
            className={`group relative flex flex-col items-center justify-center p-6 rounded-[2rem] border-2 transition-all duration-500 active:scale-95 ${
              isActive
                ? "bg-primary border-primary text-primary-foreground shadow-2xl shadow-indigo-500/30 scale-105 z-10"
                : "bg-secondary/30 backdrop-blur-xl border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-secondary/50"
            }`}
            style={{ transitionDelay: `${i * 50}ms` }}
          >
            <div
              className={`p-3.5 rounded-xl mb-3 transition-all duration-300 ${
                isActive
                  ? "bg-white/20"
                  : "bg-secondary/20 group-hover:bg-primary/5 group-hover:text-primary shadow-sm"
              }`}
            >
              <Icon className="w-7 h-7" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] italic text-center">
              {cat.name}
            </span>
            {isActive && (
              <div className="absolute -inset-1 bg-primary/20 blur-xl -z-10 rounded-full animate-pulse" />
            )}
          </button>
        );
      })}
    </div>
  );
};
