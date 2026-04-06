"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type NavbarConfig = {
  searchQuery?: string;
  onSearchClick?: () => void;
  cookieValue?: string;
  cookieValueSaved?: string;
  onCookieChange?: (value: string) => void;
  onSaveCookie?: () => void;
  huaweiCartsLoading?: boolean;
  loadHuaweiCarts?: () => void;
  showHuaweiCarts?: boolean;
};

const NavbarContext = createContext<{
  config: NavbarConfig;
  setConfig: (config: NavbarConfig) => void;
}>({ config: {}, setConfig: () => {} });

export function NavbarProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<NavbarConfig>({});
  return (
    <NavbarContext.Provider value={{ config, setConfig }}>
      {children}
    </NavbarContext.Provider>
  );
}

export function useNavbar() {
  return useContext(NavbarContext);
}