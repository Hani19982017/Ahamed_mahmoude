import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

type RequireAuthProps = {
  children: ReactNode;
  /** Optional list of roles allowed to view this page. If omitted, any authenticated user passes. */
  allowedRoles?: string[];
};

/**
 * Guards a page behind authentication (and optionally a role whitelist).
 * - Unauthenticated users are redirected to /login.
 * - Authenticated users with a disallowed role see a clear "no permission" screen
 *   so they understand why they can't access the page (instead of being silently
 *   bounced back to the home page).
 */
export default function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  // Only redirect unauthenticated users; for forbidden roles we render the
  // permission notice in-place so the user sees a real explanation.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">جاري التحميل...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const isForbidden =
    allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user?.role ?? "");

  if (isForbidden) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            ليس لديك صلاحية للدخول
          </h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            أنت لا تملك الصلاحية للدخول لهذا القسم. إذا كنت تعتقد أن هذا خطأ،
            تواصل مع مدير النظام.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="w-full bg-[#1a4d6d] text-white hover:bg-[#14394f]"
          >
            العودة للصفحة الرئيسية
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
