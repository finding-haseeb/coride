import { useEffect, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Dock, DockIcon } from "@/components/ui/dock";
import { Map, MessageCircle, User, Home, Moon, Sun, Bell } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { SosButton } from "@/components/safety/SosButton";

const navItems = [
  { href: "/map", icon: Map, label: "Map" },
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/", icon: Home, label: "Home" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/profile", icon: User, label: "Profile" },
];

const POLL_MS = 20_000;

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { unread, refresh, reset } = useNotificationStore();

  // Poll for notifications while logged in; pause when the tab is hidden.
  useEffect(() => {
    if (!isAuthenticated) {
      reset();
      return;
    }
    refresh();
    const id = window.setInterval(() => refresh(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAuthenticated, refresh, reset]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains("dark");
  });

  const toggleDarkMode = () => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.remove("dark");
      setIsDarkMode(false);
    } else {
      root.classList.add("dark");
      setIsDarkMode(true);
    }
  };

  // Hide dock on Auth pages or if we want specific full-screen pages
  const isMapPage = location.pathname.startsWith("/map");
  const isChatPage = location.pathname.startsWith("/chat");
  const hideDock = location.pathname.startsWith("/auth");
  // The chat page has its own SOS button in the conversation header.
  const showSos = isAuthenticated && isMapPage;

  return (
    <div className="relative h-[100dvh] w-full bg-background font-sans text-foreground flex flex-col overflow-hidden transition-colors duration-500">
      {/* Main Content Area */}
      {/* The map draws under the dock; every other page keeps room for it so
          the dock never covers content such as the chat message box. */}
      <main
        className={`flex-1 w-full overflow-x-hidden relative ${
          isMapPage ? "overflow-hidden" : isChatPage ? "overflow-hidden pb-[84px]" : "overflow-y-auto pb-[80px]"
        }`}
      >
        {children || <Outlet />}
      </main>

      {showSos && (
        <div className="pointer-events-none fixed right-4 top-4 z-[1100]">
          <SosButton />
        </div>
      )}

      {/* Global Dock Navigation */}
      {!hideDock && (
        <div className="fixed inset-0 z-[999] pointer-events-none flex items-end justify-center pb-6">
          <motion.div 
            drag 
            dragMomentum={false}
            className="pointer-events-auto cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
          >
            <Dock direction="middle" className="bg-card/80 backdrop-blur-2xl border border-border shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
                return (
                  <DockIcon key={item.href}>
                    <Link
                      to={item.href}
                      className={`relative flex h-full w-full items-center justify-center rounded-full transition-all duration-300 hover:-translate-y-2 ${
                        isActive ? "text-primary bg-primary/10" : "text-foreground/60 hover:text-primary hover:bg-foreground/5"
                      }`}
                      aria-label={item.label}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.href === "/notifications" && unread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </Link>
                  </DockIcon>
                );
              })}
              <DockIcon>
                <button
                  onClick={toggleDarkMode}
                  className="flex h-full w-full items-center justify-center rounded-full transition-all duration-300 hover:-translate-y-2 text-foreground/60 hover:text-primary hover:bg-foreground/5"
                  aria-label="Toggle Dark Mode"
                >
                  {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>
              </DockIcon>
            </Dock>
          </motion.div>
        </div>
      )}
    </div>
  );
}
