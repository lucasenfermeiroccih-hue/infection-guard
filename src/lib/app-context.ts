import { createContext, useContext } from "react";

export interface AppCtx {
  isAdmin: boolean;
}

export const AppContext = createContext<AppCtx>({ isAdmin: false });
export const useAppCtx = () => useContext(AppContext);
